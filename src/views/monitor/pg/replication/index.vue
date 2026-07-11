<template>
  <div class="pg-repl-page">
    <InstanceEmpty v-if="!inst" />

    <template v-else>
      <!-- 角色与关键状态 -->
      <div class="stat-row">
        <div class="stat-card">
          <div class="stat-label">复制角色</div>
          <div class="stat-value" :class="isReplica === null ? 'muted' : 'ok'">
            {{ isReplica === null ? '暂无数据' : isReplica ? '从库（恢复模式）' : '主库' }}
          </div>
        </div>
        <div class="stat-card" v-for="s in statCards" :key="s.label">
          <div class="stat-label">
            {{ s.label }}
            <el-tooltip v-if="s.tip" :content="s.tip" placement="top" :show-after="150">
              <el-icon class="stat-tip"><QuestionFilled /></el-icon>
            </el-tooltip>
          </div>
          <div class="stat-value" :class="s.status">{{ s.value }}</div>
        </div>
      </div>

      <!-- 逐从库明细（主库视角） -->
      <el-card v-if="isReplica === false" shadow="never" class="block-card">
        <div class="section-head">
          <span class="section-title">下游从库明细</span>
          <span class="section-tip">三段延迟对比可定位延迟卡点：网络传输高=网络慢，刷盘高=从库磁盘慢，回放高=从库回放跟不上（每分钟采集）</span>
        </div>
        <ProTable
          :data="replicaRows"
          :columns="replicaColumns"
          :loading="replicaLoading"
          :show-toolbar="false"
          :show-add="false"
          :show-operation="false"
          :show-pagination="false"
          embedded
        >
          <template #col-lagBytes="{ row }">{{ fmtBytes(row.lagBytes) }}</template>
          <template #col-writeLagMs="{ row }">{{ fmtMs(row.writeLagMs) }}</template>
          <template #col-flushLagMs="{ row }">{{ fmtMs(row.flushLagMs) }}</template>
          <template #col-replayLagMs="{ row }">{{ fmtMs(row.replayLagMs) }}</template>
        </ProTable>
        <el-empty
          v-if="!replicaLoading && !replicaRows.length"
          description="未检测到下游从库连接（单机实例或从库未接入）"
          :image-size="60"
        />
      </el-card>

      <!-- 趋势图 -->
      <el-card shadow="never" class="block-card" v-loading="loading">
        <div class="chart-section">
          <div class="section-title">复制延迟</div>
          <div class="chart-grid">
            <TrendChart v-if="isReplica" title="复制回放延迟" :data="charts.replLag" unit="s" color="#E74C3C"
              tip="从库最后回放事务距今的秒数。主库长时间无写入时该值也会自然增长，需结合主库 TPS 判断" />
            <TrendChart v-else title="下游从库数" :data="charts.replicaCount" color="#0C7C97"
              tip="主库上连接中的流复制从库数量，数量减少说明有从库掉线" />
          </div>
        </div>

        <div class="chart-section">
          <div class="section-title">复制槽</div>
          <div class="chart-grid">
            <TrendChart title="复制槽数量"
              :series="[
                { name: '槽总数', color: '#0C7C97', data: charts.slotsTotal },
                { name: '失活槽', color: '#E5484D', data: charts.slotsInactive }
              ]"
              tip="失活槽（未被消费）会阻止 WAL 回收，是 WAL 撑爆磁盘的最常见原因之一；确认不再使用的槽应及时删除" />
            <TrendChart title="槽滞留 WAL 最大值" :data="charts.slotRetained" value-format="bytes" color="#E08600"
              tip="单个复制槽滞留（未被下游消费）的 WAL 字节数最大值，持续增长说明下游停止消费" />
          </div>
        </div>

        <div class="chart-section">
          <div class="section-title">WAL 归档</div>
          <div class="chart-grid">
            <TrendChart title="归档成败"
              :series="[
                { name: '归档成功/分钟', color: '#15A36A', data: charts.archived },
                { name: '归档失败/分钟', color: '#E5484D', data: charts.archiveFailed }
              ]"
              tip="未开启 archive_mode 时恒为 0；归档持续失败说明归档命令故障，WAL 会持续堆积且备份链断裂" />
            <TrendChart title="WAL 生成速率" :data="charts.walRate" value-format="bytes" unit="/s" color="#6366F1"
              tip="每秒产生的 WAL 字节数（PG 14+ 提供；13 无 pg_stat_wal 视图无数据）" />
          </div>
        </div>
      </el-card>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, watch } from 'vue'
import { QuestionFilled } from '@element-plus/icons-vue'
import { useInstanceStore } from '@/stores/instance'
import InstanceEmpty from '@/components/InstanceEmpty.vue'
import ProTable from '@/components/ProTable/index.vue'
import TrendChart from '@/components/TrendChart.vue'
import { getMetricTrend, getMetricLatest, getMetricObjects } from '@/api/metric'
import { PG } from '@/constants/pg-metrics'
import { useAutoRefresh } from '@/composables/useAutoRefresh'
import type { TrendPoint } from '@/types/monitor'
import type { TableColumn } from '@/components/ProTable/types'

const instanceStore = useInstanceStore()
const inst = computed(() => instanceStore.current)

const loading = ref(false)
const isReplica = ref<boolean | null>(null)
const latest = ref<Record<string, number | null>>({})

const charts = reactive<Record<string, TrendPoint[]>>({
  replLag: [], replicaCount: [],
  slotsTotal: [], slotsInactive: [], slotRetained: [],
  archived: [], archiveFailed: [], walRate: []
})

const METRIC_MAP: Record<string, string> = {
  replLag:       PG.REPL_LAG_SECONDS,
  replicaCount:  PG.REPL_REPLICA_COUNT,
  slotsTotal:    PG.REPL_SLOTS_TOTAL,
  slotsInactive: PG.REPL_SLOTS_INACTIVE,
  slotRetained:  PG.REPL_SLOT_RETAINED_MAX,
  archived:      PG.WAL_ARCHIVED_DELTA,
  archiveFailed: PG.WAL_ARCHIVE_FAILED,
  walRate:       PG.WAL_WRITE_RATE
}

// ── 关键状态卡片 ──────────────────────────────────────────────────────────
const statCards = computed(() => {
  const v = latest.value
  const lag = v[PG.REPL_LAG_SECONDS]
  const replicas = v[PG.REPL_REPLICA_COUNT]
  const inactive = v[PG.REPL_SLOTS_INACTIVE]
  const retained = v[PG.REPL_SLOT_RETAINED_MAX]
  const failed = v[PG.WAL_ARCHIVE_FAILED]
  const cards = []
  if (isReplica.value) {
    cards.push({
      label: '回放延迟',
      value: lag == null ? '—' : `${lag} s`,
      status: lag == null ? 'muted' : lag >= 300 ? 'danger' : lag >= 60 ? 'warn' : 'ok',
      tip: '从库最后回放事务距今的秒数'
    })
  } else {
    cards.push({
      label: '下游从库数',
      value: replicas == null ? '—' : String(replicas),
      status: 'muted',
      tip: '主库上连接中的流复制从库数量'
    })
  }
  cards.push(
    {
      label: '失活复制槽',
      value: inactive == null ? '—' : String(inactive),
      status: inactive == null ? 'muted' : inactive > 0 ? 'warn' : 'ok',
      tip: '未被消费的复制槽会阻止 WAL 回收，确认不再使用应及时删除'
    },
    {
      label: '槽滞留 WAL',
      value: retained == null ? '—' : fmtBytes(retained),
      status: retained == null ? 'muted' : retained >= 5 * 1024 ** 3 ? 'danger' : retained >= 1024 ** 3 ? 'warn' : 'ok',
      tip: '单槽滞留 WAL 字节数最大值'
    },
    {
      label: '归档失败（近1分钟）',
      value: failed == null ? '—' : String(failed),
      status: failed == null ? 'muted' : failed > 0 ? 'danger' : 'ok',
      tip: '归档持续失败说明归档命令故障，WAL 会堆积撑爆磁盘'
    }
  )
  return cards
})

// ── 逐从库明细 ────────────────────────────────────────────────────────────
interface ReplicaRow {
  name: string
  lagBytes: number | null
  writeLagMs: number | null
  flushLagMs: number | null
  replayLagMs: number | null
}

const replicaLoading = ref(false)
const replicaRows = ref<ReplicaRow[]>([])

const replicaColumns: TableColumn[] = [
  { prop: 'name',        label: '从库（application_name@地址）', minWidth: 240, showOverflowTooltip: true },
  { prop: 'lagBytes',    label: '总落后量',     minWidth: 120, slot: 'col-lagBytes' },
  { prop: 'writeLagMs',  label: '网络传输延迟', minWidth: 120, slot: 'col-writeLagMs' },
  { prop: 'flushLagMs',  label: '从库刷盘延迟', minWidth: 120, slot: 'col-flushLagMs' },
  { prop: 'replayLagMs', label: '从库回放延迟', minWidth: 120, slot: 'col-replayLagMs' }
]

async function loadReplicaDetail() {
  if (!inst.value) return
  replicaLoading.value = true
  try {
    const [lag, write, flush, replay] = await Promise.all([
      getMetricObjects(inst.value.id, PG.PGREPL_LAG_BYTES, 50),
      getMetricObjects(inst.value.id, PG.PGREPL_WRITE_LAG_MS, 50),
      getMetricObjects(inst.value.id, PG.PGREPL_FLUSH_LAG_MS, 50),
      getMetricObjects(inst.value.id, PG.PGREPL_REPLAY_LAG_MS, 50)
    ])
    const rowByName = new Map<string, ReplicaRow>()
    const ensure = (name: string) => {
      let row = rowByName.get(name)
      if (!row) {
        row = { name, lagBytes: null, writeLagMs: null, flushLagMs: null, replayLagMs: null }
        rowByName.set(name, row)
      }
      return row
    }
    for (const o of lag.items ?? []) ensure(o.objectName).lagBytes = o.value
    for (const o of write.items ?? []) ensure(o.objectName).writeLagMs = o.value
    for (const o of flush.items ?? []) ensure(o.objectName).flushLagMs = o.value
    for (const o of replay.items ?? []) ensure(o.objectName).replayLagMs = o.value
    replicaRows.value = [...rowByName.values()].sort((a, b) => (b.lagBytes ?? 0) - (a.lagBytes ?? 0))
  } finally {
    replicaLoading.value = false
  }
}

// ── 数据加载 ──────────────────────────────────────────────────────────────
const TREND_WINDOW_MS = 6 * 3600_000

async function loadAll(silent = false) {
  if (!inst.value) return
  if (!silent) loading.value = true
  try {
    const id = inst.value.id
    const latestRes = await getMetricLatest(id, [
      PG.REPL_IS_REPLICA, PG.REPL_LAG_SECONDS, PG.REPL_REPLICA_COUNT,
      PG.REPL_SLOTS_INACTIVE, PG.REPL_SLOT_RETAINED_MAX, PG.WAL_ARCHIVE_FAILED
    ])
    latest.value = latestRes.values ?? {}
    const roleVal = latest.value[PG.REPL_IS_REPLICA]
    isReplica.value = roleVal == null ? null : roleVal >= 1

    const to = Date.now()
    const from = to - TREND_WINDOW_MS
    await Promise.all(Object.entries(METRIC_MAP).map(async ([key, code]) => {
      try {
        const res = await getMetricTrend(id, code, from, to)
        charts[key] = res.points ?? []
      } catch {
        charts[key] = []
      }
    }))

    if (isReplica.value === false) {
      loadReplicaDetail()
    }
  } finally {
    if (!silent) loading.value = false
  }
}

function fmtBytes(b: number | null): string {
  if (b == null) return '—'
  if (b >= 1024 ** 3) return `${(b / 1024 ** 3).toFixed(2)} GB`
  if (b >= 1024 ** 2) return `${(b / 1024 ** 2).toFixed(1)} MB`
  if (b >= 1024) return `${(b / 1024).toFixed(1)} KB`
  return `${Math.round(b)} B`
}

function fmtMs(v: number | null): string {
  if (v == null) return '—（空闲）'
  if (v >= 1000) return `${(v / 1000).toFixed(2)} s`
  return `${v} ms`
}

watch(() => inst.value?.id, (id) => {
  if (id) loadAll()
}, { immediate: true })

useAutoRefresh(() => loadAll(true))
</script>

<style scoped lang="scss">
.pg-repl-page {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.stat-row {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 12px;
}

.stat-card {
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
  padding: 14px 16px;

  .stat-label {
    font-size: 13px;
    color: var(--el-text-color-secondary);
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .stat-tip {
    font-size: 13px;
    color: var(--el-text-color-placeholder);
    cursor: help;
  }

  .stat-value {
    margin-top: 6px;
    font-size: 20px;
    font-weight: 600;

    &.ok { color: var(--el-color-success); }
    &.warn { color: var(--el-color-warning); }
    &.danger { color: var(--el-color-danger); }
    &.muted { color: var(--el-text-color-secondary); }
  }
}

.block-card {
  border-radius: 8px;
}

.section-head {
  display: flex;
  align-items: baseline;
  gap: 12px;
  margin-bottom: 12px;
  flex-wrap: wrap;
}

.section-title {
  font-size: 15px;
  font-weight: 600;
}

.section-tip {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.chart-section {
  & + .chart-section {
    margin-top: 20px;
  }

  .section-title {
    margin-bottom: 12px;
  }
}

.chart-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
}

@media (max-width: 1200px) {
  .chart-grid {
    grid-template-columns: 1fr;
  }
}
</style>
