<template>
  <div class="perf-tab" v-loading="loading">
    <template v-if="!loading">
      <div v-if="hasAnnotations" class="chart-legend-hint">
        图例说明：<span class="hint-threshold">╌╌ 红色虚线</span>为该实例已启用告警规则的阈值；
        <span class="hint-marker">┆ 橙色竖线</span>为最近 1 小时告警事件的触发时间（鼠标移到竖线附近，提示框中会显示触发的规则与时间）
      </div>
      <div class="chart-section">
        <div class="section-title">基础性能</div>
        <div class="chart-grid">
          <TrendChart title="QPS 趋势" :data="charts.qps" color="#0C7C97" v-bind="anno('qps')"
            tip="每秒执行的查询数（Queries Per Second），反映数据库整体繁忙程度" />
          <TrendChart title="TPS 趋势" :data="charts.tps" color="#15A36A" v-bind="anno('tps')"
            tip="每秒提交/回滚的事务数（Transactions Per Second），反映写入业务量" />
          <TrendChart title="平均响应时间" :data="charts.latency" unit="ms" color="#E08600" v-bind="anno('latency')"
            tip="语句平均执行耗时，持续升高说明数据库变慢，需结合慢SQL与锁等待排查" />
          <TrendChart title="慢 SQL 数量" :data="charts.slowSql" color="#E5484D" v-bind="anno('slowSql')"
            tip="每分钟新增的慢查询条数（执行时间超过 long_query_time 阈值的语句）" />
          <TrendChart title="内存临时表" :data="charts.tmpTables" color="#15A36A" v-bind="anno('tmpTables')"
            tip="每分钟新建的内存临时表数量。排序、分组、去重等操作会创建临时表，属正常现象" />
          <TrendChart title="磁盘临时表" :data="charts.tmpDiskTables" color="#6366F1" v-bind="anno('tmpDiskTables')"
            tip="每分钟落盘的临时表数量。临时表超过内存上限被写到磁盘，数量持续偏高说明 SQL 需要优化或 tmp_table_size 偏小" />
        </div>
      </div>

      <div class="chart-section">
        <div class="section-title">连接趋势</div>
        <div class="chart-grid">
          <TrendChart title="连接数"
            :series="[
              { name: '当前连接数', color: '#0C7C97', data: charts.connections },
              { name: '活跃连接数', color: '#6366F1', data: charts.activeSessions }
            ]"
            v-bind="annoMerged(['connections', 'activeSessions'])"
            tip="当前连接数=保持连接的客户端总数（含空闲连接）；活跃连接数=正在执行语句的连接数，持续偏高说明数据库处理能力吃紧" />
          <TrendChart title="连接使用率" :data="charts.connUsage" unit="%" color="#6B7280" v-bind="anno('connUsage')"
            tip="当前连接数占 max_connections 上限的百分比，接近 100% 时新连接将被拒绝" />
          <TrendChart title="连接失败次数" :data="charts.abortedConnects" color="#E5484D" v-bind="anno('abortedConnects')"
            tip="每分钟连接建立失败的次数（密码错误、权限不足、握手超时等），突增时检查应用配置或网络" />
          <TrendChart title="连接数打满被拒" :data="charts.connRejected" color="#9B59B6" v-bind="anno('connRejected')"
            tip="每分钟因连接数达到 max_connections 上限而被拒绝的连接数，出现即说明连接池耗尽，需立即处理" />
        </div>
      </div>

      <div class="chart-section">
        <div class="section-title">锁与事务</div>
        <div class="chart-grid">
          <TrendChart title="锁等待数" :data="charts.lockWaits" color="#E5484D" v-bind="anno('lockWaits')"
            tip="当前正在等待行锁的请求数，持续大于 0 说明存在锁竞争" />
          <TrendChart title="阻塞会话数" :data="charts.blockedSessions" color="#9B59B6" v-bind="anno('blockedSessions')"
            tip="当前被其他事务的锁卡住无法继续执行的会话数" />
          <TrendChart title="死锁次数" :data="charts.deadlocks" color="#B91C1C" v-bind="anno('deadlocks')"
            tip="每分钟发生的死锁次数。死锁会导致其中一个事务被强制回滚、业务报错，频发时需梳理事务访问顺序" />
          <TrendChart title="锁等待超时次数" :data="charts.lockTimeouts" color="#E08600" v-bind="anno('lockTimeouts')"
            tip="每分钟因等锁超过 innodb_lock_wait_timeout 而报错的次数，业务已实际受影响" />
          <TrendChart title="活跃事务数" :data="charts.activeTrx" color="#0C7C97" v-bind="anno('activeTrx')"
            tip="当前未提交的事务总数" />
          <TrendChart title="最长事务时长" :data="charts.maxTrxSeconds" unit="s" color="#E74C3C" v-bind="anno('maxTrxSeconds')"
            tip="当前运行时间最长的事务已持续的秒数。大事务是锁堆积和复制延迟的常见根因，持续增长时需定位来源会话" />
        </div>
      </div>

      <div class="chart-section">
        <div class="section-title">InnoDB 趋势</div>
        <div class="chart-grid">
          <TrendChart title="Buffer Pool 命中率" :data="charts.bpHitRate" unit="%" color="#15A36A" v-bind="anno('bpHitRate')"
            tip="读请求直接命中内存缓存的比例，健康值一般在 99% 以上；下降说明频繁读磁盘，数据库会明显变慢" />
          <TrendChart title="脏页比例" :data="charts.dirtyRatio" unit="%" color="#E08600" v-bind="anno('dirtyRatio')"
            tip="缓存中已修改但尚未写回磁盘的页占比，持续偏高说明写入压力大或刷盘跟不上" />
          <TrendChart title="Buffer Pool 使用率" :data="charts.bpUsage" unit="%" color="#0C7C97" v-bind="anno('bpUsage')"
            tip="缓存池已使用的比例。刚重启时较低属预热期；长期接近 100% 且命中率下降，说明内存不足以承载热数据" />
          <TrendChart title="Undo 历史链长度" :data="charts.historyList" color="#9B59B6" v-bind="anno('historyList')"
            tip="待清理的旧版本数据（undo）数量。长事务会阻止清理使其持续增长，导致空间膨胀、查询变慢；持续上涨时排查长事务" />
        </div>
      </div>

      <div class="chart-section">
        <div class="section-title">访问模式与网络</div>
        <div class="chart-grid">
          <TrendChart title="网络流量" unit="/s" value-format="bytes"
            :series="[
              { name: '接收', color: '#0C7C97', data: charts.netRecv },
              { name: '发送', color: '#15A36A', data: charts.netSent }
            ]"
            tip="每秒收发的网络字节数：接收反映请求/写入流量，发送反映返回结果集流量；发送突增常见于大结果集查询或全量导出" />
          <TrendChart title="行读取方式（Handler）" unit="/s"
            :series="[
              { name: '索引读', color: '#15A36A', data: charts.handlerKey },
              { name: '顺序扫描读', color: '#E5484D', data: charts.handlerRndNext }
            ]"
            tip="每秒按索引定位读取的行数 vs 顺序扫描读取的行数。顺序扫描读远高于索引读说明大量查询在做全表扫描，需要补索引" />
          <TrendChart title="全表扫描与无索引 JOIN" unit="/s"
            :series="[
              { name: '全表扫描 SELECT', color: '#E08600', data: charts.selScan },
              { name: '无索引 JOIN', color: '#B91C1C', data: charts.selFullJoin }
            ]"
            tip="每秒对首表做全表扫描的 SELECT 数与未走索引的 JOIN 数。无索引 JOIN 大于 0 即值得优化，全表扫描持续偏高需结合 Top SQL 定位" />
          <TrendChart title="表打开速率" unit="/s" :data="charts.openedTables" color="#6366F1"
            tip="每秒新打开表的次数：持续偏高说明表缓存（table_open_cache）偏小、命中不足，每次打开表有额外磁盘开销" />
        </div>
      </div>

      <div class="chart-section">
        <div class="section-title">等待事件分析</div>
        <el-empty
          v-if="!hasWaitsData"
          description="等待事件分析依赖 performance_schema（MySQL 5.7/8.0），当前实例暂无等待事件数据"
          :image-size="60"
        />
        <template v-else>
          <div class="chart-grid">
            <TrendChart title="等待事件耗时分布" unit="ms"
              :series="[
                { name: '文件 IO', color: '#0C7C97', data: charts.waitsIoFile },
                { name: '表 IO', color: '#15A36A', data: charts.waitsIoTable },
                { name: '锁', color: '#E5484D', data: charts.waitsLock },
                { name: '其他', color: '#6B7280', data: charts.waitsOther }
              ]"
              tip="每分钟内数据库各类等待的累计耗时：文件 IO 高=磁盘瓶颈；表 IO 与访问量正相关；锁等待高=表锁/元数据锁冲突" />
            <div class="wait-top-card">
              <div class="wait-top-title">
                Top 等待事件（最近一分钟）
                <el-tooltip content="按本周期等待耗时排序的前 10 个等待事件，展示数据库此刻主要在等什么" placement="top" :show-after="150">
                  <el-icon class="wait-top-tip"><QuestionFilled /></el-icon>
                </el-tooltip>
              </div>
              <el-table :data="topWaitEvents" size="small" max-height="200" empty-text="本周期无显著等待">
                <el-table-column prop="event" label="等待事件" min-width="220" show-overflow-tooltip />
                <el-table-column prop="count" label="次数" width="90" align="right" />
                <el-table-column label="总耗时" width="100" align="right">
                  <template #default="{ row }">{{ fmtMs(row.timeMs) }}</template>
                </el-table-column>
                <el-table-column label="平均" width="100" align="right">
                  <template #default="{ row }">{{ fmtUs(row.avgUs) }}</template>
                </el-table-column>
              </el-table>
            </div>
          </div>
        </template>
      </div>

      <div class="chart-section">
        <div class="section-title">复制与高可用</div>
        <el-empty
          v-if="isReplica === false"
          description="当前实例为主库，无复制拓扑；复制延迟与线程状态仅从库上报"
          :image-size="60"
        />
        <div v-else class="chart-grid">
          <TrendChart title="复制延迟" :data="charts.replDelay" unit="s" color="#E74C3C" v-bind="anno('replDelay')"
            tip="从库数据落后主库的秒数，持续增大说明从库回放跟不上，读从库可能读到旧数据" />
          <TrendChart title="IO 线程状态" :data="charts.replIoRunning" color="#0C7C97" v-bind="anno('replIoRunning')"
            tip="从库拉取主库日志的线程状态：1=运行中，0=已停止。掉到 0 说明复制链路中断，需立即处理" />
          <TrendChart title="SQL 线程状态" :data="charts.replSqlRunning" color="#15A36A" v-bind="anno('replSqlRunning')"
            tip="从库回放主库日志的线程状态：1=运行中，0=已停止。通常因回放报错而停止，需查看复制错误信息" />
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, watch, computed } from 'vue'
import { QuestionFilled } from '@element-plus/icons-vue'
import TrendChart, { type ThresholdLine, type EventMarker } from '@/components/TrendChart.vue'
import { getMetricTrend, getMetricLatest, getMetricTextLatest, pageAlertEvents } from '@/api/metric'
import { pageAlertRules } from '@/api/alert'
import { M } from '@/constants/metrics'
import { useAutoRefresh } from '@/composables/useAutoRefresh'
import type { TrendPoint } from '@/types/monitor'
import type { AlertRuleVo } from '@/types/alert'

const props = defineProps<{ instanceId: number }>()

const loading = ref(false)
/** 复制角色：true 从库 / false 主库 / null 未知（未采集到数据时按从库布局展示空图） */
const isReplica = ref<boolean | null>(null)
const charts = reactive<Record<string, TrendPoint[]>>({
  qps: [], tps: [], latency: [], slowSql: [], tmpTables: [], tmpDiskTables: [],
  connections: [], activeSessions: [], connUsage: [], abortedConnects: [], connRejected: [],
  lockWaits: [], blockedSessions: [], deadlocks: [], lockTimeouts: [], activeTrx: [], maxTrxSeconds: [],
  bpHitRate: [], dirtyRatio: [], bpUsage: [], historyList: [],
  netRecv: [], netSent: [], handlerKey: [], handlerRndNext: [], selScan: [], selFullJoin: [], openedTables: [],
  waitsIoFile: [], waitsIoTable: [], waitsLock: [], waitsOther: [],
  replDelay: [], replIoRunning: [], replSqlRunning: []
})

/** Top 等待事件明细（mysql.waits.top_events 文本指标 JSON） */
interface WaitEventRow { event: string; count: number; timeMs: number; avgUs: number }
const topWaitEvents = ref<WaitEventRow[]>([])

/** 等待事件板块是否有数据（5.6 或未启用 P_S 时为空 → 展示降级说明） */
const hasWaitsData = computed(() =>
  charts.waitsIoFile.length > 0 || charts.waitsIoTable.length > 0 ||
  charts.waitsLock.length > 0 || charts.waitsOther.length > 0)

function fmtMs(v: number): string {
  if (v >= 1000) return (v / 1000).toFixed(2) + ' s'
  return v.toFixed(1) + ' ms'
}
function fmtUs(v: number): string {
  if (v >= 1000000) return (v / 1000000).toFixed(2) + ' s'
  if (v >= 1000) return (v / 1000).toFixed(1) + ' ms'
  return Math.round(v) + ' µs'
}

async function loadTopWaitEvents() {
  try {
    const res = await getMetricTextLatest(props.instanceId, [M.WAITS_TOP_EVENTS])
    const raw = res.values?.[M.WAITS_TOP_EVENTS]
    topWaitEvents.value = raw ? JSON.parse(raw) : []
  } catch {
    topWaitEvents.value = []
  }
}

const METRIC_MAP: Record<string, string> = {
  qps:             M.QPS,
  tps:             M.TPS,
  latency:         M.AVG_STMT_LATENCY_MS,
  slowSql:         M.DELTA_SLOW_QUERIES,
  tmpTables:       M.DELTA_TMP_TABLES,
  tmpDiskTables:   M.DELTA_TMP_DISK_TABLES,
  connections:     M.CONN_TOTAL,
  activeSessions:  M.CONN_ACTIVE,
  connUsage:       M.CONN_USAGE,
  abortedConnects: M.DELTA_ABORTED_CONNECTS,
  connRejected:    M.DELTA_CONN_REJECTED,
  lockWaits:       M.LOCK_WAITS,
  blockedSessions: M.BLOCKED_SESSIONS,
  deadlocks:       M.DEADLOCK_COUNT,
  lockTimeouts:    M.LOCK_TIMEOUT_COUNT,
  activeTrx:       M.TRX_ACTIVE,
  maxTrxSeconds:   M.TRX_MAX_SECONDS,
  bpHitRate:       M.BP_HIT_RATE,
  dirtyRatio:      M.BP_DIRTY_RATIO,
  bpUsage:         M.BP_USAGE,
  historyList:     M.HISTORY_LIST_LENGTH,
  netRecv:         M.RATE_BYTES_RECEIVED,
  netSent:         M.RATE_BYTES_SENT,
  handlerKey:      M.RATE_HANDLER_READ_KEY,
  handlerRndNext:  M.RATE_HANDLER_READ_RND_NEXT,
  selScan:         M.RATE_SELECT_SCAN,
  selFullJoin:     M.RATE_SELECT_FULL_JOIN,
  openedTables:    M.RATE_OPENED_TABLES,
  waitsIoFile:     M.WAITS_IO_FILE_MS,
  waitsIoTable:    M.WAITS_IO_TABLE_MS,
  waitsLock:       M.WAITS_LOCK_MS,
  waitsOther:      M.WAITS_OTHER_MS,
  replDelay:       M.REPL_SECONDS_BEHIND,
  replIoRunning:   M.REPL_IO_RUNNING,
  replSqlRunning:  M.REPL_SQL_RUNNING
}

// ── 告警阈值线 + 事件标注（11.1.3 趋势图增强） ───────────────────────────
/** 趋势图窗口：最近 1 小时（与 getMetricTrend 默认窗口一致） */
const TREND_WINDOW_MS = 3600_000

/** metricCode → 图表 key 列表（反查 METRIC_MAP） */
const CHART_KEYS_BY_CODE = new Map<string, string[]>()
for (const [key, code] of Object.entries(METRIC_MAP)) {
  const keys = CHART_KEYS_BY_CODE.get(code) ?? []
  keys.push(key)
  CHART_KEYS_BY_CODE.set(code, keys)
}

/** 图表 key → 阈值线（来自该实例已启用的告警规则） */
const thresholdsByKey = ref<Record<string, ThresholdLine[]>>({})
/** 图表 key → 窗口内告警事件触发竖线 */
const markersByKey = ref<Record<string, EventMarker[]>>({})
/** 已启用规则缓存（事件 → 指标映射用） */
let ruleById = new Map<number, AlertRuleVo>()

/** 是否存在任一标注（有才展示图例说明，避免干扰） */
const hasAnnotations = computed(() =>
  Object.values(thresholdsByKey.value).some(a => a.length) ||
  Object.values(markersByKey.value).some(a => a.length))

/** 图表标注 props 快捷绑定 */
function anno(key: string) {
  return {
    thresholds: thresholdsByKey.value[key] ?? [],
    markers: markersByKey.value[key] ?? []
  }
}

/** 多指标合成图：合并各指标的阈值线与事件竖线（事件按时间戳去重） */
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

async function loadAnnotations() {
  thresholdsByKey.value = {}
  markersByKey.value = {}
  ruleById = new Map()
  if (!props.instanceId) return
  try {
    const res = await pageAlertRules({ instanceId: props.instanceId, enabled: true, pageNum: 1, pageSize: 100 })
    const thrMap: Record<string, ThresholdLine[]> = {}
    for (const r of res.list ?? []) {
      ruleById.set(r.id, r)
      // 布尔型/无阈值/无指标映射的规则画不了阈值线
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
      instanceId: props.instanceId,
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

async function loadReplicaRole() {
  try {
    const res = await getMetricLatest(props.instanceId, [M.REPL_IS_REPLICA])
    const v = res.values?.[M.REPL_IS_REPLICA]
    isReplica.value = v == null ? null : v >= 1
  } catch {
    isReplica.value = null
  }
}

async function loadAll(silent = false) {
  if (!props.instanceId) return
  // 定时刷新走静默模式：不置 loading，避免整页图表每分钟闪烁一次
  if (!silent) {
    loading.value = true
  }
  try {
    await Promise.allSettled([
      ...Object.entries(METRIC_MAP).map(async ([key, code]) => {
        const res = await getMetricTrend(props.instanceId, code)
        charts[key] = res.points ?? []
      }),
      loadReplicaRole(),
      loadAnnotations(),
      loadTopWaitEvents()
    ])
  } finally {
    if (!silent) {
      loading.value = false
    }
  }
}

watch(() => props.instanceId, () => {
  isReplica.value = null
  loadAll()
}, { immediate: true })

// 每分钟静默刷新趋势图（指标采集为分钟级，与数据产出频率对齐）
useAutoRefresh(() => loadAll(true))
</script>

<style scoped>
.perf-tab {
  display: flex;
  flex-direction: column;
  gap: 24px;
  padding: 4px 0;
  min-height: 200px;
}
.chart-legend-hint {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  line-height: 1.6;
}
.hint-threshold {
  color: #E5484D;
  font-weight: 600;
}
.hint-marker {
  color: #E08600;
  font-weight: 600;
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
.wait-top-card {
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
  padding: 12px 16px;
  background: var(--el-bg-color);
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.wait-top-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--el-text-color-primary);
  display: flex;
  align-items: center;
  gap: 4px;
}
.wait-top-tip {
  color: var(--el-text-color-placeholder);
  font-size: 14px;
  cursor: help;
}
@media (max-width: 1200px) {
  .chart-grid {
    grid-template-columns: 1fr;
  }
}
</style>
