<template>
  <div class="conn-tab">

    <!-- ① 连接概览 -->
    <el-row :gutter="12" class="stat-row" v-loading="loadingStats">
      <el-col :span="6">
        <StatCard label="当前连接数" :value="stats.current" sub="实时连接" tone="primary" />
      </el-col>
      <el-col :span="6">
        <StatCard label="活跃连接数" :value="stats.active" sub="执行中" tone="success" />
      </el-col>
      <el-col :span="6">
        <StatCard label="最大连接数" :value="stats.max" sub="连接上限" tone="info" />
      </el-col>
      <el-col :span="6">
        <StatCard
          label="连接使用率"
          :value="usagePct"
          unit="%"
          :sub="usagePct > 80 ? '接近上限，需关注' : '使用正常'"
          :tone="usagePct > 80 ? 'danger' : 'success'"
        />
      </el-col>
    </el-row>

    <!-- ② 连接来源分析 Top 10 -->
    <el-card shadow="never" v-loading="loadingSource">
      <template #header><span class="card-title">连接来源分析 Top 10</span></template>
      <el-empty v-if="!connSources.length && !loadingSource" description="暂无连接来源数据" :image-size="56" />
      <ProTable
        v-else
        :data="connSources"
        :columns="sourceColumns"
        :show-toolbar="false"
        :show-operation="false"
        :show-pagination="false"
        embedded
      >
        <template #col-host="{ row }">
          <span class="src-host">{{ row.host || '-' }}</span>
        </template>
        <template #col-total="{ row }">
          <span class="bold">{{ row.total }}</span>
        </template>
        <template #col-pct="{ row }">
          <div class="pct-cell">
            <el-progress
              :percentage="totalConns ? Math.round((row.total / totalConns) * 100) : 0"
              :show-text="false"
              :stroke-width="8"
              color="#0C7C97"
              style="flex:1"
            />
            <span class="pct-num">{{ totalConns ? Math.round((row.total / totalConns) * 100) : 0 }}%</span>
          </div>
        </template>
      </ProTable>
    </el-card>

    <!-- ③ 连接状态分布（左饼图 + 右表格） -->
    <el-card shadow="never" v-loading="loadingStats">
      <template #header><span class="card-title">连接状态分布</span></template>
      <div class="state-layout">
        <div ref="pieRef" class="pie-chart" />
        <ProTable
          :data="stateRows"
          :columns="stateColumns"
          :show-toolbar="false"
          :show-operation="false"
          :show-pagination="false"
          class="state-table" embedded
        >
          <template #col-pct="{ row }">
            <el-tag :type="row.tagType || undefined" size="small">{{ row.pct }}%</el-tag>
          </template>
        </ProTable>
      </div>
    </el-card>

    <!-- ④ 长连接 Top 10 -->
    <el-card shadow="never" v-loading="loadingLong">
      <template #header>
        <div class="card-header-row">
          <span class="card-title">长连接 Top 10</span>
          <el-tag v-if="longConns.length" type="warning" size="small">{{ longConns.length }} 条</el-tag>
        </div>
      </template>
      <el-empty v-if="!longConns.length && !loadingLong" description="暂无长连接" :image-size="56" />
      <ProTable
        v-else
        :data="longConns"
        :columns="longConnColumns"
        :show-toolbar="false"
        :show-operation="false"
        :show-pagination="false"
        embedded
      >
        <template #col-duration="{ row }">
          <el-tag
            :type="row.timeSeconds > 300 ? 'danger' : row.timeSeconds > 60 ? 'warning' : 'success'"
            size="small"
          >{{ fmtDuration(row.timeSeconds) }}</el-tag>
        </template>
        <template #col-action="{ row }">
          <el-button link size="small" type="primary" @click="showSql(row as LongConnRow)">查看SQL</el-button>
          <el-button link size="small" type="danger" @click="killConn(row as LongConnRow)">Kill</el-button>
        </template>
      </ProTable>
    </el-card>

    <!-- ⑤ 连接历史趋势（全宽，单独一行） -->
    <el-card shadow="never" class="trend-card">
      <template #header><span class="card-title">连接历史趋势</span></template>
      <div ref="trendRef" class="dual-trend" />
    </el-card>

    <!-- SQL 详情弹窗 -->
    <el-dialog v-model="sqlDialog.visible" title="SQL 详情" width="600px" append-to-body>
      <SqlBlock :sql="sqlDialog.sql" :max-height="420" />
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, watch, nextTick } from 'vue'
import * as echarts from 'echarts/core'
import { PieChart, LineChart } from 'echarts/charts'
import { GridComponent, TooltipComponent, LegendComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useECharts } from '@/composables/useECharts'
import ProTable from '@/components/ProTable/index.vue'
import StatCard from '@/components/StatCard.vue'
import SqlBlock from '@/components/SqlBlock.vue'
import { fmtDurationShort as fmtDuration } from '@/utils/format'
import { getMetricLatest, getMetricObjects, getLongConnections, getMetricTrend } from '@/api/metric'
import { M } from '@/constants/metrics'
import type { LongConnRow, ObjectItem, TrendPoint } from '@/types/monitor'
import type { TableColumn } from '@/components/ProTable/types'

echarts.use([PieChart, LineChart, GridComponent, TooltipComponent, LegendComponent, CanvasRenderer])

const props = defineProps<{ instanceId: number }>()

const loadingStats  = ref(false)
const loadingSource = ref(false)
const loadingLong   = ref(false)

const stats = reactive<Record<string, number | null>>({ current: null, active: null, max: null })
const stateValues = reactive<Record<string, number>>({ sleep: 0, query: 0, locked: 0, other: 0 })

interface SourceRow { host: string; user: string; database: string; total: number; active: number }
const connSources = ref<SourceRow[]>([])
const totalConns  = computed(() => connSources.value.reduce((s, r) => s + r.total, 0))
const longConns   = ref<LongConnRow[]>([])

const sourceColumns: TableColumn[] = [
  { prop: 'host',     label: '来源 IP / 主机', minWidth: 140, showOverflowTooltip: true, slot: 'col-host' },
  { prop: 'user',     label: '用户',           minWidth: 90,  showOverflowTooltip: true },
  { prop: 'database', label: '数据库',         minWidth: 100, showOverflowTooltip: true },
  { prop: 'total',    label: '当前连接数',      minWidth: 100, align: 'right', sortable: true, slot: 'col-total' },
  { prop: 'active',   label: '活跃连接数',      minWidth: 100, align: 'right' },
  { prop: 'pct',      label: '占比',           minWidth: 160, slot: 'col-pct' },
]

const stateColumns: TableColumn[] = [
  { prop: 'state', label: '状态', minWidth: 80 },
  { prop: 'count', label: '数量', minWidth: 80, align: 'right' },
  { prop: 'pct',   label: '占比', minWidth: 80, align: 'center', slot: 'col-pct' },
]

const longConnColumns: TableColumn[] = [
  { prop: 'connId',   label: '连接ID',  width: 80 },
  { prop: 'connUser', label: '用户',    width: 100, showOverflowTooltip: true },
  { prop: 'connHost', label: '来源',    width: 160, showOverflowTooltip: true },
  { prop: 'connDb',   label: '数据库',  width: 120, showOverflowTooltip: true },
  { prop: 'command',  label: '命令',    width: 90 },
  { prop: 'timeSeconds', label: '持续时间', width: 110, sortable: true, slot: 'col-duration' },
  { prop: 'info',     label: '状态信息', minWidth: 180, showOverflowTooltip: true },
  { prop: 'action',   label: '操作',    width: 130, fixed: 'right', slot: 'col-action' },
]

const usagePct = computed(() => {
  if (!stats.current || !stats.max) return 0
  return Math.round(Math.min(100, (stats.current / stats.max) * 100) * 10) / 10
})

const STATE_CFG = [
  { key: 'sleep',  label: 'Sleep',  color: '#6B7280', tagType: 'info'    as const },
  { key: 'query',  label: 'Query',  color: '#2D7FF0', tagType: ''        as const },
  { key: 'locked', label: 'Locked', color: '#E5484D', tagType: 'danger'  as const },
  { key: 'other',  label: 'Other',  color: '#E08600', tagType: 'warning' as const },
]
const stateTotal = computed(() => Object.values(stateValues).reduce((s, v) => s + v, 0))
const stateRows  = computed(() =>
  STATE_CFG.map(s => ({
    state: s.label, count: stateValues[s.key], color: s.color, tagType: s.tagType,
    pct: stateTotal.value ? Math.round((stateValues[s.key] / stateTotal.value) * 100) : 0
  }))
)

const sqlDialog = reactive({ visible: false, sql: '' })
function showSql(row: LongConnRow) { sqlDialog.sql = row.info; sqlDialog.visible = true }
function killConn(row: LongConnRow) {
  ElMessageBox.confirm(
    `确认 Kill 连接 #${row.connId}（${row.connUser}@${row.connHost}）？`, '操作确认',
    { type: 'warning', confirmButtonText: '确认 Kill', cancelButtonText: '取消' }
  ).then(() => ElMessage.success('已发送 Kill 指令（实际执行需后端接口支持）')).catch(() => {})
}
// ── 图表 ───────────────────────────────────────────────────────────────────
const pieRef   = ref<HTMLDivElement>()
const trendRef = ref<HTMLDivElement>()
const trendData = ref<{ conn: TrendPoint[]; active: TrendPoint[] }>({ conn: [], active: [] })

function buildPieOption() {
  return {
    tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
    legend: {
      orient: 'vertical',
      left: 8,
      top: 'center',
      itemWidth: 10,
      itemHeight: 10,
      itemGap: 10,
      textStyle: { fontSize: 12, color: '#4B5563' },
      data: STATE_CFG.map(s => ({ name: s.label, itemStyle: { color: s.color } }))
    },
    series: [{
      type: 'pie',
      // 圆心右移为左侧图例留出空间
      center: ['65%', '50%'],
      radius: ['40%', '68%'],
      avoidLabelOverlap: false,
      padAngle: 3,
      itemStyle: { borderRadius: 4 },
      label: { show: true, formatter: '{d}%', fontSize: 11, color: '#4B5563' },
      data: STATE_CFG.map(s => ({
        name: s.label, value: stateValues[s.key],
        itemStyle: { color: s.color }
      }))
    }]
  }
}

function buildTrendOption() {
  const connData = trendData.value.conn
  const activeData = trendData.value.active
  // 1h 频率 24h 约 24 个点，X 轴标签按点数自适应稀疏显示
  const xData = connData.map(p => {
    const d = new Date(p.ts)
    const mm = (d.getMonth() + 1).toString().padStart(2, '0')
    const dd = d.getDate().toString().padStart(2, '0')
    const hh = d.getHours().toString().padStart(2, '0')
    const mi = d.getMinutes().toString().padStart(2, '0')
    return `${mm}-${dd} ${hh}:${mi}`
  })
  return {
    tooltip: { trigger: 'axis', axisPointer: { type: 'line' } },
    legend: { data: ['总连接数', '活跃连接数'], top: 4, right: 12, itemWidth: 14, itemHeight: 10, textStyle: { fontSize: 12 } },
    grid: { top: 40, right: 20, bottom: 32, left: 56, containLabel: false },
    xAxis: { type: 'category', data: xData, boundaryGap: false,
      axisLabel: { color: '#9CA3AF', fontSize: 11,
        // 小时级 24 个点左右，标签密度交给 ECharts 自适应
        interval: 'auto',
        formatter: (val: string) => val.slice(6) // 只显示 HH:mm 部分
      },
      axisLine: { lineStyle: { color: '#E5E7EB' } } },
    yAxis: { type: 'value', minInterval: 1,
      axisLabel: { color: '#9CA3AF', fontSize: 11 }, splitLine: { lineStyle: { color: '#F3F4F6', type: 'dashed' } } },
    series: [
      { name: '总连接数', type: 'line', data: connData.map(p => p.value), smooth: true, symbol: 'none',
        lineStyle: { color: '#0C7C97', width: 2 },
        areaStyle: { color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
          { offset: 0, color: 'rgba(12,124,151,.22)' }, { offset: 1, color: 'rgba(12,124,151,.02)' }]) },
        itemStyle: { color: '#0C7C97' } },
      { name: '活跃连接数', type: 'line', data: activeData.map(p => p.value), smooth: true, symbol: 'none',
        lineStyle: { color: '#6366F1', width: 2 },
        areaStyle: { color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
          { offset: 0, color: 'rgba(99,102,241,.18)' }, { offset: 1, color: 'rgba(99,102,241,.02)' }]) },
        itemStyle: { color: '#6366F1' } }
    ]
  }
}

// 生命周期（初始化 / resize / 主题切换 / 销毁）由 useECharts 统一托管
const pie = useECharts(pieRef, buildPieOption)
const trend = useECharts(trendRef, buildTrendOption)


// ── 数据 ───────────────────────────────────────────────────────────────────
function parseSource(items: ObjectItem[]): SourceRow[] {
  const map = new Map<string, SourceRow>()
  items.forEach(item => {
    // objectName 格式：hostIp|user|db（ProcesslistItem 写入格式）
    const [host = '', user = '', database = ''] = item.objectName.split('|')
    if (!map.has(item.objectName))
      map.set(item.objectName, { host, user, database, total: 0, active: 0 })
    map.get(item.objectName)!.total = item.value
  })
  return [...map.values()].sort((a, b) => b.total - a.total)
}

async function loadAll() {
  if (!props.instanceId) return
  loadingStats.value = loadingSource.value = loadingLong.value = true

  await Promise.allSettled([
    getMetricLatest(props.instanceId, [
      M.CONN_TOTAL, M.CONN_ACTIVE, M.CONN_MAX, M.CONN_USAGE,
      M.CONN_STATE_SLEEP, M.CONN_STATE_QUERY, M.CONN_STATE_LOCKED, M.CONN_STATE_OTHER
    ]).then(r => {
      stats.current = r.values[M.CONN_TOTAL]  ?? null
      stats.active  = r.values[M.CONN_ACTIVE] ?? null
      stats.max     = r.values[M.CONN_MAX]    ?? null
      stateValues.sleep  = r.values[M.CONN_STATE_SLEEP]  ?? 0
      stateValues.query  = r.values[M.CONN_STATE_QUERY]  ?? 0
      stateValues.locked = r.values[M.CONN_STATE_LOCKED] ?? 0
      stateValues.other  = r.values[M.CONN_STATE_OTHER]  ?? 0
      loadingStats.value = false
      nextTick(pie.update)
    }),
    getMetricObjects(props.instanceId, M.OBJ_CONN_SOURCE_TOTAL, 10).then(r => {
      connSources.value = parseSource(r.items ?? [])
      loadingSource.value = false
    }),
    getLongConnections(props.instanceId).then(r => {
      longConns.value = r.connections ?? []
      loadingLong.value = false
    }),
    // 最近 1 天，小时级数据（由 1m 连续聚合降采样）；连接数为整数指标，取整展示
    Promise.all([
      getMetricTrend(props.instanceId, M.CONN_TOTAL,  Date.now() - 86400_000, Date.now(), '1h', 0),
      getMetricTrend(props.instanceId, M.CONN_ACTIVE, Date.now() - 86400_000, Date.now(), '1h', 0)
    ]).then(([c, a]) => {
      trendData.value = { conn: c.points ?? [], active: a.points ?? [] }
      nextTick(trend.update)
    })
  ])
}

watch(() => props.instanceId, loadAll, { immediate: true })
</script>

<style scoped>
.conn-tab { display: flex; flex-direction: column; gap: 16px; padding: 4px 0; }
.card-header-row { display: flex; align-items: center; justify-content: space-between; }
.bold { font-weight: 600; }

/* 概览统计卡片 */
.stat-row { flex-shrink: 0; }

/* 来源表格 */
.src-host { font-weight: 500; color: var(--el-text-color-primary); }
.pct-cell { display: flex; align-items: center; gap: 8px; }
.pct-num  { font-size: 12px; color: var(--el-text-color-secondary); min-width: 30px; text-align: right; flex-shrink: 0; }

/* 状态分布：左饼图 + 右表格，各占一半 */
.state-layout {
  display: flex;
  align-items: center;
  gap: 0;
}
.pie-chart {
  flex: 1;
  height: 220px;
  min-width: 0;
}
.state-table { flex: 1; min-width: 0; }

/* 趋势图（全宽） */
.dual-trend {
  width: 100%;
  height: 260px;
}
</style>
