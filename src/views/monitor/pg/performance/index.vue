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
import { useInstanceStore } from '@/stores/instance'
import InstanceEmpty from '@/components/InstanceEmpty.vue'
import { useAutoRefresh } from '@/composables/useAutoRefresh'
import { getPerfTrendBatch, pageAlertEvents } from '@/api/metric'
import { pageAlertRules } from '@/api/alert'
import { PG } from '@/constants/pg-metrics'
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

// ── 分类图表定义（PG 口径） ──────────────────────────────────────────────
interface MetricDef { code: string; label: string; unit: string; color: string; toGB?: boolean }
interface CategoryDef { id: string; label: string; tip?: string; metrics: MetricDef[] }

const CATEGORIES: CategoryDef[] = [
  {
    id: 'connections', label: '连接',
    tip: '当前连接数：客户端连接总数（含空闲）\n活跃连接数：正在执行语句的连接\n事务中空闲：开了事务却闲置的连接，长期偏高会阻碍 VACUUM 引发表膨胀\n连接使用率：当前连接占 max_connections 的百分比',
    metrics: [
      { code: PG.CONN_TOTAL,       label: '当前连接数', unit: '',  color: '#0C7C97' },
      { code: PG.CONN_ACTIVE,      label: '活跃连接数', unit: '',  color: '#15A36A' },
      { code: PG.CONN_IDLE_IN_TRX, label: '事务中空闲', unit: '',  color: '#E08600' },
      { code: PG.CONN_USAGE,       label: '连接使用率', unit: '%', color: '#6B7280' }
    ]
  },
  {
    id: 'throughput', label: '吞吐与缓存',
    tip: 'TPS：每秒事务数（提交+回滚）\n回滚/秒：回滚占比突增通常意味着应用在报错\n缓存命中率：shared_buffers 命中率，健康值一般在 95% 以上',
    metrics: [
      { code: PG.TPS,                label: 'TPS',        unit: '',  color: '#0C7C97' },
      { code: PG.RATE_XACT_ROLLBACK, label: '回滚/秒',    unit: '',  color: '#E5484D' },
      { code: PG.CACHE_HIT_RATE,     label: '缓存命中率', unit: '%', color: '#15A36A' }
    ]
  },
  {
    id: 'tempObjects', label: '临时对象',
    tip: '临时文件数：排序/哈希超过 work_mem 后落盘产生的临时文件数量\n临时字节速率：临时文件写入的字节速率，持续偏高说明存在大排序 SQL 或 work_mem 偏小',
    metrics: [
      { code: PG.DELTA_TEMP_FILES, label: '临时文件数/分钟', unit: '',    color: '#6366F1' },
      { code: PG.RATE_TEMP_BYTES,  label: '临时字节速率',    unit: 'B/s', color: '#E08600' }
    ]
  },
  {
    id: 'lock', label: '锁与死锁',
    tip: '等待中锁请求：未授予的锁请求数，持续大于 0 说明存在锁竞争\n被阻塞会话：因等锁被卡住的会话数\n死锁次数：每分钟新增死锁数，PostgreSQL 自动回滚其中一个事务',
    metrics: [
      { code: PG.LOCKS_WAITING,    label: '等待中锁请求', unit: '', color: '#E5484D' },
      { code: PG.BLOCKED_SESSIONS, label: '被阻塞会话',   unit: '', color: '#9B59B6' },
      { code: PG.DELTA_DEADLOCKS,  label: '死锁次数',     unit: '', color: '#B91C1C' }
    ]
  },
  {
    id: 'trx', label: '事务时长',
    tip: '最长事务时长：运行最久的事务已持续秒数，长事务阻止 VACUUM 清理引发膨胀\n事务中空闲最长：开事务后闲置最久的连接持续秒数\nvacuum 阻碍时长：持有最老快照的事务持续秒数，其后产生的死元组无法回收',
    metrics: [
      { code: PG.TRX_MAX_SECONDS,             label: '最长事务时长',    unit: 's', color: '#E5484D' },
      { code: PG.TRX_IDLE_IN_TRX_MAX_SECONDS, label: '事务中空闲最长',  unit: 's', color: '#E08600' },
      { code: PG.VACUUM_XMIN_SECONDS,         label: 'vacuum 阻碍时长', unit: 's', color: '#9B59B6' }
    ]
  },
  {
    id: 'waits', label: '等待事件（采样）',
    tip: '按等待大类统计正在等待的会话数（每分钟采样一次）：\nLock：行锁/表锁等重量级锁等待，对应锁竞争\nLWLock：内部轻量锁（缓冲区/WAL 写入等），持续偏高说明内部争用\nIO：读写数据文件等待，说明磁盘是瓶颈',
    metrics: [
      { code: PG.WAITS_LOCK,   label: 'Lock',   unit: '', color: '#E5484D' },
      { code: PG.WAITS_LWLOCK, label: 'LWLock', unit: '', color: '#9B59B6' },
      { code: PG.WAITS_IO,     label: 'IO',     unit: '', color: '#0C7C97' },
      { code: PG.WAITS_IPC,    label: 'IPC',    unit: '', color: '#6366F1' }
    ]
  },
  {
    id: 'checkpoint', label: '检查点与刷盘',
    tip: '定时检查点：由 checkpoint_timeout 定时触发（正常形态）\n请求检查点：WAL 写满 max_wal_size 被迫触发，持续>0 说明 max_wal_size 偏小\n后端直刷速率：后端进程被迫自己刷脏页（页/秒），占比高说明共享缓冲区吃紧',
    metrics: [
      { code: PG.CKPT_TIMED_DELTA, label: '定时检查点', unit: '',     color: '#15A36A' },
      { code: PG.CKPT_REQ_DELTA,   label: '请求检查点', unit: '',     color: '#E5484D' },
      { code: PG.BGW_BACKEND_RATE, label: '后端直刷',   unit: '页/s', color: '#E08600' }
    ]
  },
  {
    id: 'wal', label: 'WAL 与归档',
    tip: 'WAL 生成速率：每秒产生的 WAL 字节数（PG 14+）\n归档成功/失败：每分钟 WAL 段归档次数；归档持续失败会使 WAL 堆积撑爆磁盘',
    metrics: [
      { code: PG.WAL_WRITE_RATE,     label: 'WAL 生成速率', unit: 'B/s', color: '#0C7C97' },
      { code: PG.WAL_ARCHIVED_DELTA, label: '归档成功',     unit: '',    color: '#15A36A' },
      { code: PG.WAL_ARCHIVE_FAILED, label: '归档失败',     unit: '',    color: '#E5484D' }
    ]
  },
  {
    id: 'io', label: '实例 I/O（PG 16+）',
    tip: '来自 pg_stat_io 的关系对象 I/O 汇总（PG 16+ 才有该视图，低版本无数据）：\n块读/块写速率：每秒块读写操作数\n文件扩展速率：每秒文件扩展操作数，持续偏高说明大量数据写入',
    metrics: [
      { code: PG.IO_READ_RATE,   label: '块读速率',     unit: '/s', color: '#0C7C97' },
      { code: PG.IO_WRITE_RATE,  label: '块写速率',     unit: '/s', color: '#E08600' },
      { code: PG.IO_EXTEND_RATE, label: '文件扩展速率', unit: '/s', color: '#6366F1' }
    ]
  },
  {
    id: 'maintenance', label: '膨胀与回卷（小时级）',
    tip: '单表死元组占比最大值：>20% 关注、>40% 建议人工介入\nXID 回卷消耗：距强制停写上限的消耗百分比，PG 特有高危风险\n膨胀表数量：死元组占比超 20% 的用户表数',
    metrics: [
      { code: PG.BLOAT_DEAD_PCT_MAX,      label: '死元组占比最大值', unit: '%', color: '#E08600' },
      { code: PG.XID_WRAPAROUND_PCT,      label: 'XID 回卷消耗',     unit: '%', color: '#E5484D' },
      { code: PG.BLOAT_TABLES_OVER_20PCT, label: '膨胀表数量',       unit: '',  color: '#9B59B6' }
    ]
  },
  {
    id: 'capacity', label: '容量（小时级）',
    tip: '监控库大小：监控连接所在库的磁盘占用\n实例总容量：实例内全部业务库磁盘占用合计',
    metrics: [
      { code: PG.CAPACITY_DB_SIZE,    label: '监控库大小', unit: 'GB', color: '#0C7C97', toGB: true },
      { code: PG.CAPACITY_TOTAL_SIZE, label: '实例总容量', unit: 'GB', color: '#6366F1', toGB: true }
    ]
  }
]

const ALL_CODES = CATEGORIES.flatMap(c => c.metrics.map(m => m.code))

/** 小时级采集的指标：任何时间档位都按小时粒度查询 */
const HOURLY_CODES = new Set<string>([
  PG.CAPACITY_DB_SIZE,
  PG.CAPACITY_TOTAL_SIZE,
  PG.BLOAT_DEAD_PCT_MAX,
  PG.XID_WRAPAROUND_PCT,
  PG.BLOAT_TABLES_OVER_20PCT
])
const MINUTE_CODES = ALL_CODES.filter(c => !HOURLY_CODES.has(c))

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
  if (catId === 'io') {
    return 'PG 16 以下版本无 pg_stat_io 视图，或该时间范围内暂无数据'
  }
  if (catId === 'wal') {
    return '该时间范围内暂无数据（WAL 生成速率需 PG 14+；未开归档时归档指标恒为 0）'
  }
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
    loadEventMarkers()
  } finally {
    if (!silent) {
      loading.value = false
    }
  }
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
