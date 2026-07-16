<template>
  <div class="performance-page">
    <!-- 无实例选中提示 -->
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
<!--            <el-tooltip :content="granularityTip" placement="top">-->
<!--              <el-tag type="info" class="gran-tag">{{ granularityLabel }}</el-tag>-->
<!--            </el-tooltip>-->
          </div>
          <div class="filter-right">
            <el-button
              v-permission="'perf_analysis:export'"
              :icon="Download"
              :disabled="loading || !hasData"
              @click="exportCsv"
            >导出数据</el-button>
          </div>
        </div>
      </el-card>
      <MySqlDiagnosticPanel
        :instance-id="inst.id"
        kind="correlation"
        :from="effectiveQuery.from"
        :to="effectiveQuery.to"
      />
      <div class="chart-legend-hint">
        图例说明：<span class="hint-threshold">╌╌ 红色虚线</span>为该实例已启用告警规则的阈值；
        <span class="hint-marker">┆ 橙色竖线</span>为窗口内告警事件的触发时间（鼠标移到竖线附近，提示框中会显示触发的规则与时间）
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
import MySqlDiagnosticPanel from '../components/MySqlDiagnosticPanel.vue'
import { useAutoRefresh } from '@/composables/useAutoRefresh'
import { getPerfTrendBatch, getMetricLatest, pageAlertEvents } from '@/api/metric'
import { pageAlertRules } from '@/api/alert'
import { M } from '@/constants/metrics'
import type { TrendPoint } from '@/types/monitor'
import type { AlertRuleVo } from '@/types/alert'
import CategoryChart, { type ChartSeries, type ThresholdLine, type EventMarker } from '@/views/monitor/shared/performance/components/CategoryChart.vue'

// ── 时间范围与采样粒度 ─────────────────────────────────────────────────
// 1小时/6小时走分钟级原始数据（细节完整，1m 表保留 30 天）；
// 1天及以上走小时级视图（分钟级指标由 1m 连续聚合降采样，保留 180 天）
const RANGES = [
  { key: '1h',  label: '1小时', ms: 3600_000,           freq: '1m' as const },
  { key: '6h',  label: '6小时', ms: 6 * 3600_000,       freq: '1m' as const },
  { key: '1d',  label: '1天',   ms: 24 * 3600_000,      freq: '1h' as const },
  { key: '7d',  label: '7天',   ms: 7 * 24 * 3600_000,  freq: '1h' as const },
  { key: '30d', label: '30天',  ms: 30 * 24 * 3600_000, freq: '1h' as const }
]

/** 自定义时间范围的粒度规则：跨度 ≤6 小时用分钟级，超过用小时级（与快捷档位口径一致） */
const CUSTOM_1M_MAX_SPAN_MS = 6 * 3600_000

// ── 分类图表定义（参照原型「历史性能分析」，映射到实际采集指标） ────────
interface MetricDef { code: string; label: string; unit: string; color: string; toGB?: boolean }
interface CategoryDef { id: string; label: string; tip?: string; metrics: MetricDef[] }

const CATEGORIES: CategoryDef[] = [
  {
    id: 'connections', label: '连接与线程',
    tip: '当前连接数：保持连接的客户端总数（含空闲）\n活跃连接数：正在执行语句的连接数\n连接使用率：当前连接占 max_connections 上限的百分比，接近 100% 时新连接将被拒绝',
    metrics: [
      { code: M.CONN_TOTAL,  label: '当前连接数',  unit: '',  color: '#0C7C97' },
      { code: M.CONN_ACTIVE, label: '活跃连接数',  unit: '',  color: '#15A36A' },
      { code: M.CONN_USAGE,  label: '连接使用率',  unit: '%', color: '#E08600' }
    ]
  },
  {
    id: 'connAnomaly', label: '连接异常',
    tip: '连接失败数：每分钟建连失败次数（密码错误、权限不足、握手超时等）\n连接打满拒绝数：每分钟因达到 max_connections 上限被拒绝的连接数，出现即说明连接池耗尽\n长连接数：持续超过 30 秒仍未结束的连接数',
    metrics: [
      { code: M.DELTA_ABORTED_CONNECTS, label: '连接失败数',        unit: '', color: '#E5484D' },
      { code: M.DELTA_CONN_REJECTED,    label: '连接打满拒绝数',    unit: '', color: '#9B59B6' },
      { code: M.CONN_LONG_RUNNING,      label: '长连接数（≥30s）', unit: '', color: '#E08600' }
    ]
  },
  {
    id: 'throughput', label: '吞吐与命令',
    tip: 'QPS：每秒执行的查询数，反映数据库整体繁忙程度\nTPS：每秒提交/回滚的事务数，反映写入业务量',
    metrics: [
      { code: M.QPS, label: 'QPS', unit: '', color: '#0C7C97' },
      { code: M.TPS, label: 'TPS', unit: '', color: '#E08600' }
    ]
  },
  {
    id: 'sql', label: 'SQL 与临时对象',
    tip: '慢SQL数：每分钟新增的慢查询条数\n平均响应时间：语句平均执行耗时，持续升高说明数据库变慢\n内存/磁盘临时表：每分钟新建的临时表数量；磁盘临时表持续偏高说明 SQL 需优化或 tmp_table_size 偏小',
    metrics: [
      { code: M.DELTA_SLOW_QUERIES,    label: '慢SQL数',      unit: '',   color: '#E5484D' },
      { code: M.AVG_STMT_LATENCY_MS,   label: '平均响应时间', unit: 'ms', color: '#E08600' },
      { code: M.DELTA_TMP_TABLES,      label: '内存临时表',   unit: '',   color: '#15A36A' },
      { code: M.DELTA_TMP_DISK_TABLES, label: '磁盘临时表',   unit: '',   color: '#6366F1' }
    ]
  },
  {
    id: 'innodb', label: 'InnoDB Buffer Pool',
    tip: '命中率：读请求直接命中内存缓存的比例，健康值一般在 99% 以上，下降说明频繁读磁盘\n脏页比例：已修改未写回磁盘的页占比，持续偏高说明写入压力大\n使用率：缓存池已使用比例，重启后预热期偏低属正常\n刷页速率：每秒写回磁盘的页数，反映写盘压力',
    metrics: [
      { code: M.BP_HIT_RATE,           label: '命中率',   unit: '%',    color: '#15A36A' },
      { code: M.BP_DIRTY_RATIO,        label: '脏页比例', unit: '%',    color: '#E08600' },
      { code: M.BP_USAGE,              label: '使用率',   unit: '%',    color: '#0C7C97' },
      { code: M.BP_PAGES_FLUSHED_RATE, label: '刷页速率', unit: '页/s', color: '#6366F1' }
    ]
  },
  {
    id: 'lock', label: '锁与死锁',
    tip: '锁等待数：正在等待行锁的请求数，持续大于 0 说明存在锁竞争\n阻塞会话数：被其他事务的锁卡住的会话数\n死锁次数：每分钟发生的死锁数，死锁会强制回滚事务、业务报错\n锁等待超时数：每分钟等锁超时报错的次数，业务已实际受影响',
    metrics: [
      { code: M.LOCK_WAITS,         label: '锁等待数',     unit: '', color: '#E5484D' },
      { code: M.BLOCKED_SESSIONS,   label: '阻塞会话数',   unit: '', color: '#9B59B6' },
      { code: M.DEADLOCK_COUNT,     label: '死锁次数',     unit: '', color: '#B91C1C' },
      { code: M.LOCK_TIMEOUT_COUNT, label: '锁等待超时数', unit: '', color: '#E08600' }
    ]
  },
  {
    id: 'trx', label: '事务',
    tip: '活跃事务数：当前未提交的事务总数\n最长事务时长：运行时间最长的事务已持续的秒数，大事务是锁堆积和复制延迟的常见根因',
    metrics: [
      { code: M.TRX_ACTIVE,      label: '活跃事务数',  unit: '',  color: '#0C7C97' },
      { code: M.TRX_MAX_SECONDS, label: '最长事务时长', unit: 's', color: '#E5484D' }
    ]
  },
  {
    id: 'connState', label: '连接状态分布',
    tip: '按连接当前状态分类统计：\n空闲（Sleep）：已连接但没有在执行语句\n查询中：正在执行语句\n等锁：被锁阻塞等待中，持续偏高说明锁竞争严重',
    metrics: [
      { code: M.CONN_STATE_SLEEP,  label: '空闲（Sleep）', unit: '', color: '#6B7280' },
      { code: M.CONN_STATE_QUERY,  label: '查询中',        unit: '', color: '#0C7C97' },
      { code: M.CONN_STATE_LOCKED, label: '等锁',          unit: '', color: '#E5484D' }
    ]
  },
  {
    id: 'replication', label: '复制与高可用',
    tip: '复制延迟：从库数据落后主库的秒数，持续增大说明从库回放跟不上\nIO 线程：从库拉取主库日志的线程，1=运行 0=停止\nSQL 线程：从库回放日志的线程，1=运行 0=停止，掉 0 即复制中断\n主库实例无复制拓扑，本卡片显示角色说明',
    metrics: [
      { code: M.REPL_SECONDS_BEHIND, label: '复制延迟',        unit: 's', color: '#E5484D' },
      { code: M.REPL_IO_RUNNING,     label: 'IO 线程（0/1）',  unit: '',  color: '#0C7C97' },
      { code: M.REPL_SQL_RUNNING,    label: 'SQL 线程（0/1）', unit: '',  color: '#15A36A' }
    ]
  },
  {
    id: 'capacity', label: '容量与日志',
    tip: '库表总容量：数据 + 索引占用的存储空间\n数据/索引容量：分别单看，索引持续膨胀需关注冗余索引\nBinlog占用：二进制日志文件的磁盘占用，突增说明写入放大\n以上均为小时级采集',
    metrics: [
      { code: M.CAPACITY_TOTAL_BYTES, label: '库表总容量', unit: 'GB', color: '#9B59B6', toGB: true },
      { code: M.CAPACITY_DATA_BYTES,  label: '数据容量',   unit: 'GB', color: '#0C7C97', toGB: true },
      { code: M.CAPACITY_INDEX_BYTES, label: '索引容量',   unit: 'GB', color: '#15A36A', toGB: true },
      { code: M.BINLOG_TOTAL_BYTES,   label: 'Binlog占用', unit: 'GB', color: '#6366F1', toGB: true }
    ]
  },
  {
    id: 'errorlog', label: '错误日志（小时级）',
    tip: 'Error 数 / Warning 数：每小时扫描错误日志统计出的 Error、Warning 条数\n出现 Error 时建议到目标库查看错误日志原文定位问题',
    metrics: [
      { code: M.ERRORLOG_ERROR_COUNT,   label: 'Error 数',   unit: '', color: '#E5484D' },
      { code: M.ERRORLOG_WARNING_COUNT, label: 'Warning 数', unit: '', color: '#E08600' }
    ]
  }
]

const ALL_CODES = CATEGORIES.flatMap(c => c.metrics.map(m => m.code))

/** 小时级采集的指标：无分钟级数据，任何时间档位都按小时粒度查询，避免短窗口下图表空白 */
const HOURLY_CODES = new Set<string>([
  M.CAPACITY_TOTAL_BYTES,
  M.CAPACITY_DATA_BYTES,
  M.CAPACITY_INDEX_BYTES,
  M.BINLOG_TOTAL_BYTES,
  M.ERRORLOG_ERROR_COUNT,
  M.ERRORLOG_WARNING_COUNT
])
const MINUTE_CODES = ALL_CODES.filter(c => !HOURLY_CODES.has(c))

const instanceStore = useInstanceStore()
const inst = computed(() => instanceStore.current)

const timeRange = ref('1d')
/** 自定义时间范围（选择后覆盖快捷档位；切回快捷档位时清空） */
const customRange = ref<[Date, Date] | null>(null)
/** 快捷范围的滚动终点；每次刷新时推进，确保图表和关联诊断使用同一窗口。 */
const queryClock = ref(Date.now())
const loading = ref(false)
/** metricCode → 趋势点（已做单位换算） */
const pointsByCode = reactive<Record<string, TrendPoint[]>>({})

/** 复制角色：true 从库 / false 主库 / null 未知（无数据） */
const isReplica = ref<boolean | null>(null)
/** metricCode → 阈值线（来自该实例已启用的告警规则） */
const thresholdsByCode = ref<Record<string, ThresholdLine[]>>({})
/** 分类 id → 窗口内告警事件竖线标记 */
const markersByCategory = ref<Record<string, EventMarker[]>>({})

/** 当前生效的查询窗口与粒度（自定义范围优先于快捷档位） */
const effectiveQuery = computed<{ from: number; to: number; freq: '1m' | '1h' }>(() => {
  if (customRange.value) {
    const from = customRange.value[0].getTime()
    const to = customRange.value[1].getTime()
    return { from, to, freq: to - from <= CUSTOM_1M_MAX_SPAN_MS ? '1m' : '1h' }
  }
  const range = RANGES.find(r => r.key === timeRange.value) ?? RANGES[2]
  const now = queryClock.value
  return { from: now - range.ms, to: now, freq: range.freq }
})

const granularityLabel = computed(() => effectiveQuery.value.freq === '1m' ? '分钟级采样' : '小时级采样')
const granularityTip = computed(() =>
  effectiveQuery.value.freq === '1m'
    ? '6 小时以内展示分钟级原始数据'
    : '1 天及以上展示小时级数据（由分钟级数据降采样，容量类指标为小时采集原始值）')

const hasData = computed(() => ALL_CODES.some(code => (pointsByCode[code] ?? []).length > 0))

const chartSeries = computed<Record<string, ChartSeries[]>>(() => {
  const out: Record<string, ChartSeries[]> = {}
  for (const cat of CATEGORIES) {
    out[cat.id] = cat.metrics.map(m => ({
      name: m.label,
      unit: m.unit,
      color: m.color,
      points: pointsByCode[m.code] ?? [],
      // GB 换算过的序列不画阈值线（规则阈值是原始字节，量纲不一致）
      thresholds: m.toGB ? undefined : thresholdsByCode.value[m.code]
    }))
  }
  return out
})

/** 分类空数据文案：主库实例的复制卡片给出角色化解释而非"暂无数据" */
function emptyTextOf(catId: string): string {
  if (catId === 'replication' && isReplica.value === false) {
    return '当前实例为主库，无复制拓扑；复制延迟与线程状态仅从库上报'
  }
  return '该时间范围内暂无数据'
}

// ── 增强信息：复制角色 / 告警阈值线 / 告警事件标记 ─────────────────────
/** metricCode → 所属分类 id 列表（事件标记定位用） */
const CAT_IDS_BY_CODE = new Map<string, string[]>()
for (const cat of CATEGORIES) {
  for (const m of cat.metrics) {
    const ids = CAT_IDS_BY_CODE.get(m.code) ?? []
    ids.push(cat.id)
    CAT_IDS_BY_CODE.set(m.code, ids)
  }
}

/** 该实例已启用规则缓存（id → 规则），阈值线与事件→分类映射共用 */
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
      // 布尔型/无阈值/无指标映射的规则画不了阈值线
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

async function loadReplicaRole() {
  isReplica.value = null
  if (!inst.value) return
  try {
    const res = await getMetricLatest(inst.value.id, [M.REPL_IS_REPLICA])
    const v = res.values?.[M.REPL_IS_REPLICA]
    isReplica.value = v == null ? null : v >= 1
  } catch {
    isReplica.value = null
  }
}

const ALL_EVENT_STATUSES = ['pending', 'confirmed', 'handling', 'recovered', 'ignored', 'closed']

/** 拉取窗口内该实例的告警事件，映射到对应指标所在分类，画触发时间竖线 */
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

/** 选择快捷档位：清空自定义范围并加载 */
function onQuickRangeChange() {
  customRange.value = null
  loadAll()
}

/** 选择/清除自定义范围：选择后取消快捷档位高亮；清除后回退默认档位 */
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
  if (!customRange.value) queryClock.value = Date.now()
  // 定时刷新走静默模式：不置 loading，避免图表每分钟闪烁一次
  if (!silent) {
    loading.value = true
  }
  try {
    const { from, to, freq } = effectiveQuery.value
    // 分钟级视图下，小时级采集的指标（容量/Binlog/错误日志）单独按 1h 查询，
    // 否则查 1m 表永远为空；小时级视图则一次查全
    const requests = freq === '1m'
      ? [
          getPerfTrendBatch({ instanceId: inst.value.id, metricCodes: MINUTE_CODES, from, to, frequency: '1m' }),
          getPerfTrendBatch({ instanceId: inst.value.id, metricCodes: [...HOURLY_CODES], from, to, frequency: '1h' })
        ]
      : [getPerfTrendBatch({ instanceId: inst.value.id, metricCodes: ALL_CODES, from, to, frequency: '1h' })]
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
    // 事件标记跟随查询窗口刷新（增强信息，不阻塞主图）
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
  defs.forEach(d => {
    valueMap[d.code] = new Map((pointsByCode[d.code] ?? []).map(p => [p.ts, p.value]))
  })

  const header = ['时间', ...defs.map(d => `${d.category}-${d.label}${d.unit ? `(${d.unit})` : ''}`)]
  const rows = tsList.map(ts => {
    const d = new Date(ts)
    const pad = (n: number) => n.toString().padStart(2, '0')
    const timeStr = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
    return [timeStr, ...defs.map(def => {
      const v = valueMap[def.code].get(ts)
      return v == null ? '' : String(v)
    })]
  })

  const csv = '\uFEFF' + [header, ...rows].map(r => r.join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  const d = new Date()
  const pad = (n: number) => n.toString().padStart(2, '0')
  a.href = url
  a.download = `性能分析_${inst.value.name}_${timeRange.value || '自定义'}_${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}.csv`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

watch(() => inst.value?.id, async (id) => {
  if (!id) return
  // 规则上下文先加载（事件标记依赖 ruleId → metricCodes 映射），复制角色并行
  loadReplicaRole()
  await loadRuleContext()
  loadAll()
}, { immediate: true })

// 每分钟静默刷新：快捷档位的查询窗口以"当前时间"为终点，刷新即向前滚动；
// 自定义时间范围是固定窗口，数据不会变化，跳过刷新
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
.filter-left,
.filter-right {
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
.gran-tag {
  cursor: default;
  font-size: 13px;
  height: 26px;
  line-height: 24px;
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
