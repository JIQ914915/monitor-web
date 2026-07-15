<template>
  <div class="pg-realtime-page">
    <!-- 无实例选中提示 -->
    <InstanceEmpty v-if="!inst" />

    <template v-else>
      <InstanceBanner
        :inst="inst"
        :owner-a-name="ownerAName"
        :owner-b-name="ownerBName"
        :group-name="groupName"
        :health-score="healthData && healthData.score >= 0 ? healthData.score : undefined"
        @open-health="showHealthDialog = true"
        @toggle="handleToggle"
      />

      <!-- 能力降级提示：一期未覆盖能力（Top SQL / 慢SQL样本等）在此说明 -->
      <CapabilityBanner :instance-id="inst.id" />

      <PgSessionPanel :instance-id="inst.id" />

      <!-- 关键状态卡片 -->
      <div class="stat-row">
        <div class="stat-card" v-for="s in statCards" :key="s.label">
          <div class="stat-label">
            {{ s.label }}
            <el-tooltip v-if="s.tip" :content="s.tip" placement="top" :show-after="150">
              <el-icon class="stat-tip"><QuestionFilled /></el-icon>
            </el-tooltip>
          </div>
          <div class="stat-value" :class="s.status">{{ s.value }}</div>
          <div v-if="s.sub" class="stat-sub">{{ s.sub }}</div>
        </div>
      </div>

      <el-card shadow="never" class="chart-card" v-loading="loading">
        <div class="chart-section">
          <div class="section-title">连接与事务</div>
          <div class="chart-grid">
            <TrendChart title="连接数"
              :series="[
                { name: '当前连接数', color: '#0C7C97', data: charts.connTotal },
                { name: '活跃连接数', color: '#6366F1', data: charts.connActive },
                { name: '事务中空闲', color: '#E08600', data: charts.connIdleInTrx }
              ]"
              v-bind="annoMerged(['connTotal', 'connActive', 'connIdleInTrx'])"
              tip="当前连接数=客户端连接总数（含空闲）；活跃连接数=正在执行语句的连接；事务中空闲=开了事务却闲置的连接，长期偏高会阻碍 VACUUM 引发表膨胀" />
            <TrendChart title="连接使用率" :data="charts.connUsage" unit="%" color="#6B7280" v-bind="anno('connUsage')"
              tip="当前连接数占 max_connections 上限的百分比，接近 100% 时新连接将被拒绝" />
            <TrendChart title="最长事务时长" :data="charts.trxMaxSeconds" unit="s" color="#E74C3C" v-bind="anno('trxMaxSeconds')"
              tip="当前运行时间最长的事务已持续的秒数。PostgreSQL 中长事务会阻止 VACUUM 清理旧版本行，导致表膨胀、查询变慢" />
            <TrendChart title="事务中空闲最长时长" :data="charts.idleInTrxMax" unit="s" color="#E08600" v-bind="anno('idleInTrxMax')"
              tip="开启事务后闲置最久的连接已持续的秒数，典型原因是应用拿到连接后忘记提交/回滚" />
          </div>
        </div>

        <div class="chart-section">
          <div class="section-title">吞吐与缓存</div>
          <div class="chart-grid">
            <TrendChart title="TPS 趋势"
              :series="[
                { name: '提交/秒', color: '#15A36A', data: charts.commitRate },
                { name: '回滚/秒', color: '#E5484D', data: charts.rollbackRate }
              ]"
              v-bind="annoMerged(['commitRate', 'rollbackRate'])"
              tip="每秒提交与回滚的事务数。回滚占比突增通常意味着应用在报错" />
            <TrendChart title="缓存命中率" :data="charts.cacheHitRate" unit="%" color="#15A36A" v-bind="anno('cacheHitRate')"
              tip="shared_buffers 命中率，健康值一般在 95% 以上；持续偏低说明频繁读磁盘，需检查缓存配置或是否存在大表扫描" />
            <TrendChart title="行读写速率" unit="/s"
              :series="[
                { name: '读取', color: '#0C7C97', data: charts.tupFetched },
                { name: '插入', color: '#15A36A', data: charts.tupInserted },
                { name: '更新', color: '#E08600', data: charts.tupUpdated },
                { name: '删除', color: '#E5484D', data: charts.tupDeleted }
              ]"
              tip="每秒读取/插入/更新/删除的行数，反映业务读写形态" />
            <TrendChart title="临时文件" 
              :series="[
                { name: '新增文件数/分钟', color: '#6366F1', data: charts.tempFiles }
              ]"
              v-bind="anno('tempFiles')"
              tip="排序、哈希超过 work_mem 后落盘产生的临时文件数量，持续产生说明存在需要优化的大查询或 work_mem 偏小" />
          </div>
        </div>

        <div class="chart-section">
          <div class="section-title">锁与死锁</div>
          <div class="chart-grid">
            <TrendChart title="锁等待"
              :series="[
                { name: '等待中锁请求', color: '#E5484D', data: charts.locksWaiting },
                { name: '被阻塞会话', color: '#9B59B6', data: charts.blockedSessions }
              ]"
              v-bind="annoMerged(['locksWaiting', 'blockedSessions'])"
              tip="等待中的锁请求数与因等锁被卡住的会话数，持续大于 0 说明存在锁竞争" />
            <TrendChart title="死锁次数" :data="charts.deadlocks" color="#B91C1C" v-bind="anno('deadlocks')"
              tip="每分钟新增的死锁次数。PostgreSQL 会自动回滚其中一个事务，业务侧会收到报错；频发时需梳理事务加锁顺序" />
          </div>
        </div>

        <div class="chart-section">
          <div class="section-title">复制与高可用</div>
          <el-empty
            v-if="isReplica === false && !charts.replicaCount.length"
            description="当前实例为主库且未检测到下游从库连接"
            :image-size="60"
          />
          <div v-else class="chart-grid">
            <TrendChart v-if="isReplica" title="复制回放延迟" :data="charts.replLag" unit="s" color="#E74C3C" v-bind="anno('replLag')"
              tip="从库最后回放事务距今的秒数。注意：主库长时间无写入时该值也会自然增长，需结合主库 TPS 判断" />
            <TrendChart v-else title="下游从库数" :data="charts.replicaCount" color="#0C7C97" v-bind="anno('replicaCount')"
              tip="主库上连接中的流复制从库数量，数量减少说明有从库掉线" />
          </div>
        </div>

        <div class="chart-section">
          <div class="section-title">容量趋势（小时级）</div>
          <div class="chart-grid">
            <TrendChart title="库容量"
              value-format="bytes"
              :series="[
                { name: '监控库大小', color: '#0C7C97', data: charts.dbSize },
                { name: '实例总容量', color: '#6366F1', data: charts.totalSize }
              ]"
              tip="监控连接所在库与实例内全部业务库的磁盘占用（每小时采集一次，新接入实例需等待 1 小时）" />
          </div>
        </div>
      </el-card>
    </template>
    <!-- 健康评分弹窗 -->
    <HealthScoreDialog v-model="showHealthDialog" :data="healthData" />
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { QuestionFilled } from '@element-plus/icons-vue'
import { useInstanceStore } from '@/stores/instance'
import InstanceEmpty from '@/components/InstanceEmpty.vue'
import CapabilityBanner from '@/components/CapabilityBanner.vue'
import PgSessionPanel from '@/views/monitor/pg/realtime/components/PgSessionPanel.vue'
import TrendChart, { type ThresholdLine, type EventMarker } from '@/components/TrendChart.vue'
import InstanceBanner from '@/views/monitor/shared/realtime/components/InstanceBanner.vue'
import { toggleInstance } from '@/api/instance'
import { listUserOptions } from '@/api/user'
import { listGroupOptions } from '@/api/group'
import {getMetricTrend, getMetricLatest, pageAlertEvents, getHealthScore} from '@/api/metric'
import { pageAlertRules } from '@/api/alert'
import { PG } from '@/constants/pg-metrics'
import { useAutoRefresh } from '@/composables/useAutoRefresh'
import type {HealthScoreVo, TrendPoint} from '@/types/monitor'
import type { AlertRuleVo } from '@/types/alert'
import type { UserOption, GroupOption } from '@/types'
import HealthScoreDialog from '@/views/monitor/shared/realtime/components/HealthScoreDialog.vue'

const instanceStore = useInstanceStore()
const inst = computed(() => instanceStore.current)

const loading = ref(false)
const showHealthDialog = ref(false)
const healthData = ref<HealthScoreVo | null>(null)

/** 复制角色：true 从库 / false 主库 / null 未知 */
const isReplica = ref<boolean | null>(null)

const charts = reactive<Record<string, TrendPoint[]>>({
  connTotal: [], connActive: [], connIdleInTrx: [], connUsage: [],
  trxMaxSeconds: [], idleInTrxMax: [],
  commitRate: [], rollbackRate: [], cacheHitRate: [],
  tupFetched: [], tupInserted: [], tupUpdated: [], tupDeleted: [],
  tempFiles: [], locksWaiting: [], blockedSessions: [], deadlocks: [],
  replLag: [], replicaCount: [],
  dbSize: [], totalSize: []
})

/** 分钟级图表 key → 指标编码 */
const METRIC_MAP: Record<string, string> = {
  connTotal:       PG.CONN_TOTAL,
  connActive:      PG.CONN_ACTIVE,
  connIdleInTrx:   PG.CONN_IDLE_IN_TRX,
  connUsage:       PG.CONN_USAGE,
  trxMaxSeconds:   PG.TRX_MAX_SECONDS,
  idleInTrxMax:    PG.TRX_IDLE_IN_TRX_MAX_SECONDS,
  commitRate:      PG.RATE_XACT_COMMIT,
  rollbackRate:    PG.RATE_XACT_ROLLBACK,
  cacheHitRate:    PG.CACHE_HIT_RATE,
  tupFetched:      PG.RATE_TUP_FETCHED,
  tupInserted:     PG.RATE_TUP_INSERTED,
  tupUpdated:      PG.RATE_TUP_UPDATED,
  tupDeleted:      PG.RATE_TUP_DELETED,
  tempFiles:       PG.DELTA_TEMP_FILES,
  locksWaiting:    PG.LOCKS_WAITING,
  blockedSessions: PG.BLOCKED_SESSIONS,
  deadlocks:       PG.DELTA_DEADLOCKS,
  replLag:         PG.REPL_LAG_SECONDS,
  replicaCount:    PG.REPL_REPLICA_COUNT
}

/** 小时级图表 key → 指标编码（容量） */
const HOURLY_MAP: Record<string, string> = {
  dbSize:    PG.CAPACITY_DB_SIZE,
  totalSize: PG.CAPACITY_TOTAL_SIZE
}

// ── 关键状态卡片 ──────────────────────────────────────────────────────────
const latest = ref<Record<string, number | null>>({})

const statCards = computed(() => {
  const v = latest.value
  const avail = v[PG.AVAILABILITY]
  const usage = v[PG.CONN_USAGE]
  const hit = v[PG.CACHE_HIT_RATE]
  const blocked = v[PG.BLOCKED_SESSIONS]
  const tps = v[PG.TPS]
  const uptime = v[PG.UPTIME]
  return [
    {
      label: '运行状态',
      value: avail == null ? '暂无数据' : avail >= 1 ? '运行正常' : '连接失败',
      status: avail == null ? 'muted' : avail >= 1 ? 'ok' : 'danger',
      sub: uptime != null ? `已运行 ${fmtUptime(uptime)}` : '',
      tip: '基于分钟级连接探测：连接失败时请检查 postgres 进程与网络'
    },
    {
      label: '连接使用率',
      value: usage == null ? '—' : `${usage}%`,
      status: usage == null ? 'muted' : usage >= 90 ? 'danger' : usage >= 75 ? 'warn' : 'ok',
      sub: v[PG.CONN_TOTAL] != null && v[PG.CONN_MAX] != null
        ? `${v[PG.CONN_TOTAL]} / ${v[PG.CONN_MAX]}` : '',
      tip: '当前连接数占 max_connections 的比例'
    },
    {
      label: 'TPS',
      value: tps == null ? '—' : String(tps),
      status: 'muted',
      sub: '',
      tip: '每秒事务数（提交+回滚）'
    },
    {
      label: '缓存命中率',
      value: hit == null ? '—' : `${hit}%`,
      status: hit == null ? 'muted' : hit < 90 ? 'warn' : 'ok',
      sub: '',
      tip: 'shared_buffers 命中率，健康值一般在 95% 以上'
    },
    {
      label: '被阻塞会话',
      value: blocked == null ? '—' : String(blocked),
      status: blocked == null ? 'muted' : blocked > 0 ? 'warn' : 'ok',
      sub: '',
      tip: '因等锁被卡住的会话数，持续大于 0 需排查长事务'
    }
  ]
})

function fmtUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400)
  const h = Math.floor((seconds % 86400) / 3600)
  if (d > 0) return `${d} 天 ${h} 小时`
  const m = Math.floor((seconds % 3600) / 60)
  return h > 0 ? `${h} 小时 ${m} 分钟` : `${m} 分钟`
}

// ── 告警阈值线 + 事件标注（与 MySQL 实时概况同一套增强） ─────────────────
const TREND_WINDOW_MS = 3600_000

const CHART_KEYS_BY_CODE = new Map<string, string[]>()
for (const [key, code] of Object.entries(METRIC_MAP)) {
  const keys = CHART_KEYS_BY_CODE.get(code) ?? []
  keys.push(key)
  CHART_KEYS_BY_CODE.set(code, keys)
}

const thresholdsByKey = ref<Record<string, ThresholdLine[]>>({})
const markersByKey = ref<Record<string, EventMarker[]>>({})
let ruleById = new Map<number, AlertRuleVo>()

function anno(key: string) {
  return {
    thresholds: thresholdsByKey.value[key] ?? [],
    markers: markersByKey.value[key] ?? []
  }
}

function annoMerged(keys: string[]) {
  const thresholds = keys.flatMap(k => thresholdsByKey.value[k] ?? [])
  const seen = new Set<number>()
  const markers: EventMarker[] = []
  for (const k of keys) {
    for (const m of markersByKey.value[k] ?? []) {
      if (seen.has(m.ts)) continue
      seen.add(m.ts)
      markers.push(m)
    }
  }
  return { thresholds, markers }
}

async function loadAnnotations(instanceId: number) {
  thresholdsByKey.value = {}
  markersByKey.value = {}
  ruleById = new Map()
  try {
    const res = await pageAlertRules({ instanceId, enabled: true, pageNum: 1, pageSize: 100 })
    const thrMap: Record<string, ThresholdLine[]> = {}
    for (const r of res.list ?? []) {
      ruleById.set(r.id, r)
      if (r.threshold == null || r.conditionLocked || !r.metricCodes?.length) continue
      const label = `${r.operator ?? ''} ${r.threshold}${r.unit ?? ''}`
      for (const code of r.metricCodes) {
        for (const key of CHART_KEYS_BY_CODE.get(code) ?? []) {
          const lines = thrMap[key] ?? (thrMap[key] = [])
          lines.push({ value: r.threshold, label })
        }
      }
    }
    thresholdsByKey.value = thrMap

    const from = Date.now() - TREND_WINDOW_MS
    const events = await pageAlertEvents({
      instanceId,
      statuses: ['pending', 'confirmed', 'handling', 'recovered', 'ignored', 'closed'],
      pageNum: 1,
      pageSize: 100
    })
    const mkMap: Record<string, EventMarker[]> = {}
    for (const e of events.list ?? []) {
      const ts = new Date(e.triggerTime).getTime()
      if (!Number.isFinite(ts) || ts < from) continue
      const codes = ruleById.get(e.ruleId)?.metricCodes ?? []
      const keys = new Set(codes.flatMap(c => CHART_KEYS_BY_CODE.get(c) ?? []))
      for (const key of keys) {
        const arr = mkMap[key] ?? (mkMap[key] = [])
        arr.push({ ts, label: e.ruleName || '' })
      }
    }
    markersByKey.value = mkMap
  } catch {
    // 阈值线/事件标注属增强信息，失败不影响主图
  }
}

// ── 数据加载 ──────────────────────────────────────────────────────────────
async function loadLatest(instanceId: number) {
  try {
    const res = await getMetricLatest(instanceId, [
      PG.AVAILABILITY, PG.UPTIME, PG.CONN_TOTAL, PG.CONN_MAX, PG.CONN_USAGE,
      PG.TPS, PG.CACHE_HIT_RATE, PG.BLOCKED_SESSIONS, PG.REPL_IS_REPLICA
    ])
    latest.value = res.values ?? {}
    const rep = latest.value[PG.REPL_IS_REPLICA]
    isReplica.value = rep == null ? null : rep >= 1
  } catch {
    latest.value = {}
    isReplica.value = null
  }
}

async function loadAll(silent = false) {
  const instanceId = inst.value?.id
  if (!instanceId) return
  if (!silent) {
    loading.value = true
  }
  try {
    // 小时级容量取最近 7 天窗口，分钟级默认最近 1 小时
    const capFrom = Date.now() - 7 * 86400_000
    await Promise.allSettled([
      ...Object.entries(METRIC_MAP).map(async ([key, code]) => {
        const res = await getMetricTrend(instanceId, code)
        charts[key] = res.points ?? []
      }),
      ...Object.entries(HOURLY_MAP).map(async ([key, code]) => {
        const res = await getMetricTrend(instanceId, code, capFrom, Date.now(), '1h')
        charts[key] = res.points ?? []
      }),
      loadLatest(instanceId),
      loadAnnotations(instanceId)
    ])
  } finally {
    if (!silent) {
      loading.value = false
    }
  }
}

// ── 负责人 & 分组名称 ─────────────────────────────────────────────────────
const userOptions = ref<UserOption[]>([])
const groupOptions = ref<GroupOption[]>([])

const ownerAName = computed(() => {
  if (!inst.value?.ownerAId) return ''
  return userOptions.value.find(u => u.id === inst.value!.ownerAId)?.name ?? `#${inst.value.ownerAId}`
})
const ownerBName = computed(() => {
  if (!inst.value?.ownerBId) return ''
  return userOptions.value.find(u => u.id === inst.value!.ownerBId)?.name ?? `#${inst.value.ownerBId}`
})
const groupName = computed(() => {
  if (!inst.value?.groupIds?.length) return ''
  const names = inst.value.groupIds
    .map(id => groupOptions.value.find(g => g.id === id)?.name)
    .filter(Boolean)
  return names.join(' / ') || ''
})

async function loadMeta() {
  const [users, groups] = await Promise.allSettled([listUserOptions(), listGroupOptions()])
  if (users.status === 'fulfilled') userOptions.value = users.value
  if (groups.status === 'fulfilled') groupOptions.value = groups.value
}

async function loadHealth(instanceId: number) {
  try { healthData.value = await getHealthScore(instanceId) } catch { healthData.value = null }
}

async function handleToggle(status: 'normal' | 'paused') {
  if (!inst.value) return
  try {
    await toggleInstance(inst.value.id, status)
    ElMessage.success(status === 'normal' ? '已开启监控采集' : '已暂停监控采集')
    instanceStore.setCurrent({ ...inst.value, status })
  } catch { /* request.ts 已处理 */ }
}

watch(showHealthDialog, async (open) => {
  if (open && inst.value) await loadHealth(inst.value.id)
})

watch(() => inst.value?.id, (id) => {
  if (id) {
    isReplica.value = null
    loadAll()
  }
}, { immediate: true })

useAutoRefresh(() => loadAll(true))
loadMeta()
</script>

<style scoped>
.pg-realtime-page {
  display: flex;
  flex-direction: column;
  gap: var(--density-gap, 16px);
  min-height: 400px;
}
.stat-row {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 12px;
}
.stat-card {
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
  padding: 12px 16px;
  background: var(--el-bg-color);
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.stat-label {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  display: flex;
  align-items: center;
  gap: 4px;
}
.stat-tip {
  color: var(--el-text-color-placeholder);
  cursor: help;
}
.stat-value {
  font-size: 20px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}
.stat-value.ok { color: #15A36A; }
.stat-value.warn { color: #E08600; }
.stat-value.danger { color: #E5484D; }
.stat-value.muted { color: var(--el-text-color-secondary); }
.stat-sub {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
.chart-card > :deep(.el-card__body) {
  display: flex;
  flex-direction: column;
  gap: 24px;
}
.chart-section {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.section-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--el-text-color-primary);
  padding-left: 8px;
  border-left: 3px solid var(--el-color-primary);
}
.chart-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
}
@media (max-width: 1200px) {
  .stat-row {
    grid-template-columns: repeat(2, 1fr);
  }
  .chart-grid {
    grid-template-columns: 1fr;
  }
}
</style>
