<template>
  <div class="performance-page">
    <InstanceEmpty v-if="!inst" description="请先在顶栏选择一个实例，查看其历史性能数据" />

    <template v-else>
      <!-- 时间范围 -->
      <el-card shadow="never" class="filter-card">
        <div class="filter-row">
          <div class="filter-left">
            <span class="filter-label">时间范围</span>
            <el-date-picker
                v-model="customRange"
                type="datetimerange"
                range-separator="至"
                start-placeholder="开始时间"
                end-placeholder="结束时间"
                :disabled-date="disableFuture"
                class="range-picker"
                @change="onCustomRangeChange"
            />
            <el-radio-group v-model="timeRange" @change="onQuickRangeChange">
              <el-radio-button v-for="r in RANGES" :key="r.key" :value="r.key">{{ r.label }}</el-radio-button>
            </el-radio-group>
          </div>
          <div class="filter-right">
            <el-button
              v-permission="'sqlserver_performance:export'"
              :icon="Download"
              :disabled="loading || !hasData"
              @click="exportCsv"
            >导出数据</el-button>
          </div>
        </div>
      </el-card>

      <!-- 图例说明 -->
      <div class="chart-legend-hint">
        图例说明：<span class="hint-threshold">╌╌ 红色虚线</span>为该实例已启用告警规则的阈值；
        <span class="hint-marker">┆ 橙色竖线</span>为窗口内告警事件的触发时间
      </div>

      <!-- 分类指标图表网格 -->
      <div class="chart-grid">
        <CategoryChart
          v-for="cat in CATEGORIES"
          :key="cat.id"
          :title="cat.label"
          :tip="cat.tip"
          :series="chartSeries[cat.id] ?? []"
          :loading="loading"
          :empty-text="emptyTextOf(cat.id)"
          :markers="markersByCategory[cat.id] ?? []"
        />
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, watch } from 'vue'
import { Download } from '@element-plus/icons-vue'
import { useInstanceStore } from '@/stores/instance'
import InstanceEmpty from '@/components/InstanceEmpty.vue'
import { useAutoRefresh } from '@/composables/useAutoRefresh'
import { getPerfTrendBatch, pageAlertEvents } from '@/api/metric'
import { pageAlertRules } from '@/api/alert'
import { SQLSERVER } from '@/constants/sqlserver-metrics'
import type { TrendPoint } from '@/types/monitor'
import type { AlertRuleVo } from '@/types/alert'
import CategoryChart, { type ChartSeries, type ThresholdLine, type EventMarker } from '@/views/monitor/shared/performance/components/CategoryChart.vue'

// ── 时间范围与采样粒度（与 MySQL 性能分析页同一口径） ───────────────────
const RANGES = [
  { key: '1h',  label: '1小时', ms: 3600_000,           freq: '1m' as const },
  { key: '6h',  label: '6小时', ms: 6 * 3600_000,       freq: '1m' as const },
  { key: '1d',  label: '1天',   ms: 24 * 3600_000,      freq: '1h' as const },
  { key: '7d',  label: '7天',   ms: 7 * 24 * 3600_000,  freq: '1h' as const },
  { key: '30d', label: '30天',  ms: 30 * 24 * 3600_000, freq: '1h' as const }
]
const CUSTOM_1M_MAX_SPAN_MS = 6 * 3600_000

// ── 分类图表定义（SQL Server 口径） ──────────────────────────────────────────────
interface MetricDef { code: string; label: string; unit: string; color: string; toGB?: boolean; sourceFrequency?: '1h' }
interface CategoryDef { id: string; label: string; tip?: string; metrics: MetricDef[] }

const CATEGORIES: CategoryDef[] = [
  {
    id: 'throughput', label: '吞吐与编译',
    tip: '批处理请求速率反映整体工作负载；编译和重编译持续偏高通常说明计划复用不足或对象结构频繁变化。',
    metrics: [
      { code: SQLSERVER.BATCH_REQUESTS, label: '批处理请求', unit: 'qps', color: '#0C7C97' },
      { code: SQLSERVER.COMPILATIONS, label: 'SQL 编译', unit: 'qps', color: '#E08600' },
      { code: SQLSERVER.RECOMPILATIONS, label: 'SQL 重编译', unit: 'qps', color: '#E5484D' }
    ]
  },
  {
    id: 'scheduler', label: 'CPU 调度压力',
    tip: '等待 CPU 调度任务持续升高表示工作线程已经进入 runnable 队列；需要结合主机 CPU、Top SQL 和等待类型判断根因。',
    metrics: [
      { code: SQLSERVER.RUNNABLE_TASKS, label: '等待调度任务', unit: '', color: '#E5484D' },
      { code: SQLSERVER.ACTIVE_WORKERS, label: '活跃 Worker', unit: '', color: '#0C7C97' },
      { code: SQLSERVER.CURRENT_TASKS, label: '当前任务', unit: '', color: '#6366F1' }
    ]
  },
  {
    id: 'sessions', label: '连接与请求',
    tip: '对比用户连接、用户会话和活跃请求，识别连接堆积；最长请求持续增长时应下钻 Top SQL、阻塞链和等待事件。',
    metrics: [
      { code: SQLSERVER.CONNECTIONS, label: '用户连接', unit: '', color: '#0C7C97' },
      { code: SQLSERVER.USER_SESSIONS, label: '用户会话', unit: '', color: '#15A36A' },
      { code: SQLSERVER.ACTIVE_REQUESTS, label: '活跃请求', unit: '', color: '#E08600' },
      { code: SQLSERVER.MAX_REQUEST_SECONDS, label: '最长请求', unit: 's', color: '#E5484D' }
    ]
  },
  {
    id: 'memory', label: '查询内存与实例内存',
    tip: 'Memory Grants Pending 大于 0 表示查询等待执行内存；Total 与 Target Server Memory 的差距用于观察实例内存是否仍在增长或承压。',
    metrics: [
      { code: SQLSERVER.MEMORY_GRANTS_PENDING, label: '等待内存授权', unit: '', color: '#E5484D' },
      { code: SQLSERVER.MEMORY_GRANTS_OUTSTANDING, label: '已授予内存请求', unit: '', color: '#E08600' },
      { code: SQLSERVER.MEMORY_TOTAL_BYTES, label: '已用内存', unit: 'GB', color: '#0C7C97', toGB: true },
      { code: SQLSERVER.MEMORY_TARGET_BYTES, label: '目标内存', unit: 'GB', color: '#6366F1', toGB: true }
    ]
  },
  {
    id: 'buffer', label: 'Buffer 与页面读写',
    tip: 'PLE 只作为趋势证据，不使用固定阈值；Lazy Write 和页面读写突增通常意味着缓存压力或扫描型 SQL 增多。',
    metrics: [
      { code: SQLSERVER.PLE_SECONDS, label: '页面预期寿命', unit: 's', color: '#15A36A' },
      { code: SQLSERVER.LAZY_WRITES, label: 'Lazy Write', unit: 'qps', color: '#E5484D' },
      { code: SQLSERVER.PAGE_READS, label: '页面读取', unit: 'qps', color: '#0C7C97' },
      { code: SQLSERVER.PAGE_WRITES, label: '页面写入', unit: 'qps', color: '#E08600' }
    ]
  },
  {
    id: 'waits', label: '等待事件',
    tip: '按 CPU、I/O、锁、日志、内存、网络和并行等待分类展示窗口增量，帮助判断数据库主要瓶颈方向。',
    metrics: [
      { code: SQLSERVER.WAIT_CPU, label: 'CPU', unit: 'ms', color: '#E5484D' },
      { code: SQLSERVER.WAIT_IO, label: 'I/O', unit: 'ms', color: '#0C7C97' },
      { code: SQLSERVER.WAIT_LOCK, label: '锁', unit: 'ms', color: '#9B59B6' },
      { code: SQLSERVER.WAIT_LOG, label: '日志', unit: 'ms', color: '#E08600' },
      { code: SQLSERVER.WAIT_MEMORY, label: '内存', unit: 'ms', color: '#6366F1' },
      { code: SQLSERVER.WAIT_NETWORK, label: '网络', unit: 'ms', color: '#15A36A' },
      { code: SQLSERVER.WAIT_PARALLEL, label: '并行', unit: 'ms', color: '#6B7280' }
    ]
  },
  {
    id: 'io', label: '文件 I/O',
    tip: '文件 IOPS 反映访问强度，读写延迟用于判断存储响应；持续高延迟应结合主机磁盘和等待事件排查。',
    metrics: [
      { code: SQLSERVER.FILE_READS, label: '读取 IOPS', unit: 'qps', color: '#0C7C97' },
      { code: SQLSERVER.FILE_WRITES, label: '写入 IOPS', unit: 'qps', color: '#E08600' },
      { code: SQLSERVER.READ_LATENCY, label: '读取延迟', unit: 'ms', color: '#6366F1' },
      { code: SQLSERVER.WRITE_LATENCY, label: '写入延迟', unit: 'ms', color: '#E5484D' }
    ]
  },
  {
    id: 'concurrency', label: '事务与阻塞链',
    tip: '最长事务和 sleeping 未提交事务用于发现事务边界异常；阻塞时长、链深和根阻塞者数量用于判断影响范围。平台不会自动终止会话。',
    metrics: [
      { code: SQLSERVER.TRANSACTION_MAX_SECONDS, label: '最长事务', unit: 's', color: '#E08600' },
      { code: SQLSERVER.SLEEPING_OPEN_MAX_SECONDS, label: '最长睡眠未提交事务', unit: 's', color: '#B91C1C' },
      { code: SQLSERVER.BLOCKED_SESSIONS, label: '被阻塞会话', unit: '', color: '#9B59B6' },
      { code: SQLSERVER.BLOCKING_MAX_WAIT_SECONDS, label: '最长阻塞', unit: 's', color: '#E5484D' },
      { code: SQLSERVER.BLOCKING_MAX_CHAIN_DEPTH, label: '最大阻塞链深', unit: '', color: '#6366F1' },
      { code: SQLSERVER.DEADLOCKS, label: '死锁速率', unit: 'qps', color: '#6B7280' }
    ]
  },
  {
    id: 'tempdb', label: 'TempDB 空间',
    tip: '用户对象、内部对象和版本存储持续增长会压缩可用空间；平台只提供趋势和建议，不自动扩容或清理。',
    metrics: [
      { code: SQLSERVER.TEMPDB_USER_BYTES, label: '用户对象', unit: 'GB', color: '#0C7C97', toGB: true },
      { code: SQLSERVER.TEMPDB_INTERNAL_BYTES, label: '内部对象', unit: 'GB', color: '#E08600', toGB: true },
      { code: SQLSERVER.TEMPDB_VERSION_STORE_BYTES, label: '版本存储', unit: 'GB', color: '#9B59B6', toGB: true },
      { code: SQLSERVER.TEMPDB_FREE_BYTES, label: '可用空间', unit: 'GB', color: '#15A36A', toGB: true }
    ]
  },
  {
    id: 'storage', label: '数据与事务日志',
    tip: '展示用户数据库的数据、日志容量和使用率趋势；日志使用率升高时需检查日志备份、复用等待和长事务。',
    metrics: [
      { code: SQLSERVER.DATA_SIZE_BYTES, label: '数据文件容量', unit: 'GB', color: '#6366F1', toGB: true },
      { code: SQLSERVER.DATA_USED_BYTES, label: '数据已用容量', unit: 'GB', color: '#0C7C97', toGB: true },
      { code: SQLSERVER.LOG_SIZE_BYTES, label: '日志容量', unit: 'GB', color: '#E08600', toGB: true },
      { code: SQLSERVER.LOG_USED_PERCENT, label: '日志使用率', unit: '%', color: '#E5484D' }
    ]
  },
  {
    id: 'log-health', label: '日志刷新与 VLF',
    tip: '日志刷新延迟用于观察事务提交等待；VLF 数量过多会影响日志恢复和管理，调整前需由 DBA 评估增长策略。',
    metrics: [
      { code: SQLSERVER.LOG_BYTES_FLUSHED_PER_SEC, label: '日志刷新字节/秒', unit: 'B/s', color: '#0C7C97' },
      { code: SQLSERVER.LOG_FLUSHES_PER_SEC, label: '日志刷新次数/秒', unit: '', color: '#15A36A' },
      { code: SQLSERVER.LOG_FLUSH_LATENCY_MS, label: '平均刷新延迟', unit: 'ms', color: '#E5484D' },
      { code: SQLSERVER.LOG_VLF_MAX_COUNT, label: '单库最大 VLF', unit: '', color: '#E08600', sourceFrequency: '1h' }
    ]
  },
  {
    id: 'tempdb-contention', label: 'TempDB 布局与争用',
    tip: '文件数量、大小偏差和百分比增长反映布局风险；持续 PAGELATCH 等待需结合并发负载人工评估。',
    metrics: [
      { code: SQLSERVER.TEMPDB_DATA_FILE_COUNT, label: '数据文件数', unit: '', color: '#0C7C97' },
      { code: SQLSERVER.TEMPDB_SIZE_SKEW_PERCENT, label: '文件大小偏差', unit: '%', color: '#E08600' },
      { code: SQLSERVER.TEMPDB_PERCENT_GROWTH_COUNT, label: '百分比增长文件数', unit: '', color: '#6366F1' },
      { code: SQLSERVER.TEMPDB_PAGELATCH_TASKS, label: 'PAGELATCH 等待任务', unit: '', color: '#E5484D' },
      { code: SQLSERVER.TEMPDB_PAGELATCH_MAX_WAIT_MS, label: 'PAGELATCH 最大等待', unit: 'ms', color: '#B91C1C' }
    ]
  },
  {
    id: 'capacity-risk', label: '文件增长与卷空间',
    tip: '百分比自动增长文件数和文件卷最小剩余比例用于识别容量风险，具体文件配置在实时诊断明细查看。',
    metrics: [
      { code: SQLSERVER.FILE_PERCENT_GROWTH_COUNT, label: '百分比增长文件数', unit: '', color: '#E08600', sourceFrequency: '1h' },
      { code: SQLSERVER.VOLUME_MIN_FREE_PERCENT, label: '文件卷最小剩余比例', unit: '%', color: '#E5484D', sourceFrequency: '1h' }
    ]
  },
  {
    id: 'query-store', label: 'Query Store 性能回退',
    tip: '检测最近一小时计划变化及相对历史基线的性能回退；平台只提供证据，不自动强制计划。',
    metrics: [
      { code: SQLSERVER.QUERY_STORE_CHANGED_COUNT, label: '计划变化查询数', unit: '', color: '#E08600', sourceFrequency: '1h' },
      { code: SQLSERVER.QUERY_STORE_MAX_REGRESSION, label: '最大回退倍数', unit: 'x', color: '#E5484D', sourceFrequency: '1h' }
    ]
  },
  {
    id: 'operations', label: '作业、复制与 CDC',
    tip: '汇总 Agent 连续失败、最长运行作业、复制投递延迟和 CDC 扫描延迟，明细需结合目标功能是否启用判断。',
    metrics: [
      { code: SQLSERVER.AGENT_FAILURE_JOBS, label: '连续失败作业数', unit: '', color: '#E5484D', sourceFrequency: '1h' },
      { code: SQLSERVER.AGENT_MAX_RUNNING_SECONDS, label: '最长运行作业', unit: 's', color: '#E08600', sourceFrequency: '1h' },
      { code: SQLSERVER.REPLICATION_MAX_LATENCY_MS, label: '复制最大投递延迟', unit: 'ms', color: '#6366F1', sourceFrequency: '1h' },
      { code: SQLSERVER.CDC_MAX_LATENCY_SECONDS, label: 'CDC 最大扫描延迟', unit: 's', color: '#9B59B6', sourceFrequency: '1h' }
    ]
  }
]

const ALL_CODES = CATEGORIES.flatMap(c => c.metrics.map(m => m.code))



const instanceStore = useInstanceStore()
const inst = computed(() => instanceStore.current)

const timeRange = ref('1d')
const customRange = ref<[Date, Date] | null>(null)
const loading = ref(false)
const pointsByCode = reactive<Record<string, TrendPoint[]>>({})

const thresholdsByCode = ref<Record<string, ThresholdLine[]>>({})
const markersByCategory = ref<Record<string, EventMarker[]>>({})

const effectiveQuery = computed<{ from: number; to: number; freq: '1m' | '1h' }>(() => {
  if (customRange.value) {
    const from = customRange.value[0].getTime()
    const to = customRange.value[1].getTime()
    return { from, to, freq: to - from <= CUSTOM_1M_MAX_SPAN_MS ? '1m' : '1h' }
  }
  const range = RANGES.find(r => r.key === timeRange.value) ?? RANGES[2]
  const now = Date.now()
  return { from: now - range.ms, to: now, freq: range.freq }
})

const hasData = computed(() => ALL_CODES.some(code => (pointsByCode[code] ?? []).length > 0))

const chartSeries = computed<Record<string, ChartSeries[]>>(() => {
  const out: Record<string, ChartSeries[]> = {}
  for (const cat of CATEGORIES) {
    out[cat.id] = cat.metrics.map(m => ({
      name: m.label,
      unit: m.unit,
      color: m.color,
      points: pointsByCode[m.code] ?? [],
      thresholds: m.toGB ? undefined : thresholdsByCode.value[m.code]
    }))
  }
  return out
})

function emptyTextOf(catId: string): string {
  if (catId === 'waits') return '该时间范围内暂无等待增量，或采集账号缺少性能状态权限'
  return '该时间范围内暂无数据'
}

// ── 阈值线 / 事件标记（复用 MySQL 页模式） ──────────────────────────────
const CAT_IDS_BY_CODE = new Map<string, string[]>()
for (const cat of CATEGORIES) {
  for (const m of cat.metrics) {
    const ids = CAT_IDS_BY_CODE.get(m.code) ?? []
    ids.push(cat.id)
    CAT_IDS_BY_CODE.set(m.code, ids)
  }
}

let ruleById = new Map<number, AlertRuleVo>()

async function loadRuleContext() {
  thresholdsByCode.value = {}
  ruleById = new Map()
  if (!inst.value) return
  try {
    const res = await pageAlertRules({ instanceId: inst.value.id, enabled: true, pageNum: 1, pageSize: 100 })
    const map: Record<string, ThresholdLine[]> = {}
    for (const r of res.list ?? []) {
      ruleById.set(r.id, r)
      if (r.threshold == null || r.conditionLocked || !r.metricCodes?.length) continue
      const label = `${r.operator ?? ''} ${r.threshold}${r.unit ?? ''}`
      for (const code of r.metricCodes) {
        const lines = map[code] ?? (map[code] = [])
        lines.push({ value: r.threshold, label })
      }
    }
    thresholdsByCode.value = map
  } catch {
    // 阈值线属增强信息，失败不影响主图
  }
}

const ALL_EVENT_STATUSES = ['pending', 'confirmed', 'handling', 'recovered', 'ignored', 'closed']

async function loadEventMarkers() {
  markersByCategory.value = {}
  if (!inst.value) return
  try {
    const { from, to } = effectiveQuery.value
    const res = await pageAlertEvents({
      instanceId: inst.value.id,
      statuses: ALL_EVENT_STATUSES,
      pageNum: 1,
      pageSize: 100
    })
    const out: Record<string, EventMarker[]> = {}
    for (const e of res.list ?? []) {
      const ts = new Date(e.triggerTime).getTime()
      if (!Number.isFinite(ts) || ts < from || ts > to) continue
      const codes = ruleById.get(e.ruleId)?.metricCodes ?? []
      const catIds = new Set(codes.flatMap(c => CAT_IDS_BY_CODE.get(c) ?? []))
      for (const id of catIds) {
        const arr = out[id] ?? (out[id] = [])
        arr.push({ ts, label: e.ruleName || '' })
      }
    }
    markersByCategory.value = out
  } catch {
    // 事件标记属增强信息，失败不影响主图
  }
}

function disableFuture(date: Date) {
  return date.getTime() > Date.now()
}

function onQuickRangeChange() {
  customRange.value = null
  loadAll()
}

function onCustomRangeChange(val: [Date, Date] | null) {
  if (val) {
    timeRange.value = ''
  } else if (!timeRange.value) {
    timeRange.value = '1d'
  }
  loadAll()
}

async function loadAll(silent = false) {
  if (!inst.value) return
  if (!silent) {
    loading.value = true
  }
  try {
    const { from, to, freq } = effectiveQuery.value
    const hourlyCodes = CATEGORIES.flatMap(c => c.metrics.filter(m => m.sourceFrequency === '1h').map(m => m.code))
    const minuteCodes = ALL_CODES.filter(code => !hourlyCodes.includes(code))
    const requests = freq === '1h'
      ? [getPerfTrendBatch({ instanceId: inst.value.id, metricCodes: ALL_CODES, from, to, frequency: '1h' })]
      : [
          getPerfTrendBatch({ instanceId: inst.value.id, metricCodes: minuteCodes, from, to, frequency: '1m' }),
          getPerfTrendBatch({ instanceId: inst.value.id, metricCodes: hourlyCodes, from, to, frequency: '1h' })
        ]
    const results = await Promise.all(requests)

    const gbCodes = new Set(CATEGORIES.flatMap(c => c.metrics.filter(m => m.toGB).map(m => m.code)))
    for (const code of ALL_CODES) pointsByCode[code] = []
    for (const res of results) {
      for (const s of res.series ?? []) {
        const toGB = gbCodes.has(s.metricCode)
        pointsByCode[s.metricCode] = (s.points ?? []).map(p =>
          toGB ? { ts: p.ts, value: Math.round(p.value / 1024 / 1024 / 1024 * 100) / 100 } : p)
      }
    }
    loadEventMarkers()
  } finally {
    if (!silent) {
      loading.value = false
    }
  }
}


// ── CSV 导出：按时间对齐所有指标为列 ───────────────────────────────────
function exportCsv() {
  if (!inst.value) return
  const defs = CATEGORIES.flatMap(c => c.metrics.map(m => ({ ...m, category: c.label })))
  const tsSet = new Set<number>()
  defs.forEach(d => (pointsByCode[d.code] ?? []).forEach(p => tsSet.add(p.ts)))
  const tsList = [...tsSet].sort((a, b) => a - b)
  const valueMap: Record<string, Map<number, number>> = {}
  defs.forEach(d => { valueMap[d.code] = new Map((pointsByCode[d.code] ?? []).map(p => [p.ts, p.value])) })
  const header = ['时间', ...defs.map(d => `${d.category}-${d.label}${d.unit ? `(${d.unit})` : ''}`)]
  const rows = tsList.map(ts => {
    const date = new Date(ts)
    const pad = (n: number) => n.toString().padStart(2, '0')
    const time = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
    return [time, ...defs.map(def => valueMap[def.code].get(ts) ?? '')]
  })
  const csv = '\uFEFF' + [header, ...rows].map(row => row.join(',')).join('\n')
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }))
  const link = document.createElement('a')
  const now = new Date()
  const pad = (n: number) => n.toString().padStart(2, '0')
  link.href = url
  link.download = `SQLServer性能分析_${inst.value.name}_${timeRange.value || '自定义'}_${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}.csv`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
watch(() => inst.value?.id, async (id) => {
  if (!id) return
  await loadRuleContext()
  loadAll()
}, { immediate: true })

useAutoRefresh(() => {
  if (!customRange.value) loadAll(true)
})
</script>

<style scoped>
.performance-page {
  display: flex;
  flex-direction: column;
  gap: var(--density-gap, 16px);
  min-height: 400px;
}
.filter-card :deep(.el-card__body) {
  padding: 12px 16px;
}
.filter-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 12px;
}
.filter-right { margin-left: auto; }
.filter-left {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}
.filter-label {
  font-size: 14px;
  font-weight: 500;
  color: var(--el-text-color-primary);
  white-space: nowrap;
}
.range-picker {
  max-width: 360px;
}
.chart-legend-hint {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  padding: 0 4px;
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
.chart-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: var(--density-gap, 16px);
}
@media (max-width: 1200px) {
  .chart-grid {
    grid-template-columns: 1fr;
  }
}
</style>
