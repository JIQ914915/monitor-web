<template>
  <div class="trend-chart-wrap" v-loading="loading">
    <div class="chart-header">
      <span class="chart-title">
        {{ title }}
        <el-tooltip v-if="tip" :content="tip" placement="top" :show-after="150">
          <el-icon class="chart-tip-icon"><QuestionFilled /></el-icon>
        </el-tooltip>
      </span>
      <span v-if="latestLabel" class="chart-latest">{{ latestLabel }}</span>
    </div>
    <div ref="chartRef" class="chart-body" />
  </div>
</template>

<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import * as echarts from 'echarts/core'
import { LineChart } from 'echarts/charts'
import {
  GridComponent,
  TooltipComponent,
  DataZoomComponent,
  MarkPointComponent,
  MarkLineComponent,
  LegendComponent
} from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import { QuestionFilled } from '@element-plus/icons-vue'
import type { TrendPoint } from '@/types/monitor'
import { useECharts } from '@/composables/useECharts'

echarts.use([LineChart, GridComponent, TooltipComponent, DataZoomComponent, MarkPointComponent, MarkLineComponent, LegendComponent, CanvasRenderer])

/** 多序列模式的单条序列（同一坐标系内多条对比线，如网络入/出流量）。 */
export interface TrendSeries {
  name: string
  color: string
  data: TrendPoint[]
}

/** 阈值线：来自该实例已启用告警规则的触发阈值（需与指标同量纲）。 */
export interface ThresholdLine {
  value: number
  label?: string
}

/** 事件标记：窗口内告警事件的触发时间竖线。 */
export interface EventMarker {
  ts: number
  label?: string
}

const props = withDefaults(defineProps<{
  title: string
  unit?: string
  color?: string
  data?: TrendPoint[]
  /** 多序列模式：传入后忽略 data/color 单序列入参 */
  series?: TrendSeries[]
  /** 数值格式：number 原样 + unit 后缀；bytes 自适应 B/KB/MB/GB（unit 作为速率后缀，如 "/s"） */
  valueFormat?: 'number' | 'bytes'
  loading?: boolean
  height?: number
  /** 指标含义气泡说明（标题旁问号图标悬浮展示） */
  tip?: string
  /** 告警规则阈值横线 */
  thresholds?: ThresholdLine[]
  /** 告警事件触发时间竖线标记 */
  markers?: EventMarker[]
}>(), {
  unit: '',
  color: '#0C7C97',
  data: () => [],
  series: undefined,
  valueFormat: 'number',
  loading: false,
  height: 180,
  tip: '',
  thresholds: () => [],
  markers: () => []
})

const chartRef = ref<HTMLDivElement>()

function fmtValue(v: number | null | undefined): string {
  if (v == null) return '-'
  if (props.valueFormat === 'bytes') {
    const abs = Math.abs(v)
    if (abs >= 1073741824) return (v / 1073741824).toFixed(2) + ' GB' + props.unit
    if (abs >= 1048576) return (v / 1048576).toFixed(1) + ' MB' + props.unit
    if (abs >= 1024) return (v / 1024).toFixed(1) + ' KB' + props.unit
    return Math.round(v) + ' B' + props.unit
  }
  return v.toFixed(2).replace(/\.?0+$/, '') + props.unit
}

const seriesList = computed<TrendSeries[]>(() =>
  props.series?.length
    ? props.series
    : [{ name: props.title, color: props.color, data: props.data }]
)

const latestLabel = computed(() => {
  const parts = seriesList.value
    .filter(s => s.data.length)
    .map(s => {
      const last = s.data[s.data.length - 1]
      return (props.series?.length ? `${s.name} ` : '') + fmtValue(last.value)
    })
  if (!parts.length) return ''
  return props.series?.length ? `当前: ${parts.join(' · ')}` : `当前: ${parts[0]}`
})

function buildOption() {
  const root = document.documentElement
  const css = getComputedStyle(root)
  const isDark = root.classList.contains('dark')
  const readVar = (name: string, fallback: string) => css.getPropertyValue(name).trim() || fallback

  const textColor = isDark ? readVar('--muted', '#8A9CB8') : '#9CA3AF'
  const axisLineColor = isDark ? 'rgba(138, 156, 184, 0.30)' : '#E5E7EB'
  const splitLineColor = isDark ? 'rgba(138, 156, 184, 0.20)' : '#F3F4F6'

  const list = seriesList.value
  // 显式多序列模式下即使只有一条线也保留图例和序列名（如仅一块盘的磁盘 IO 图，悬浮需知道盘名）
  const multi = !!props.series?.length
  // 多序列时以点数最多的序列作为 X 轴基准（各序列采集时间一致）
  const base = list.reduce((a, b) => (b.data.length > a.data.length ? b : a), list[0])
  const xData = base.data.map(p => {
    const d = new Date(p.ts)
    return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`
  })
  const markersByIdx = markersByIndex(base.data)

  return {
    backgroundColor: 'transparent',
    grid: { top: multi ? 28 : 12, right: 12, bottom: 30, left: 52 },
    legend: multi
      ? { top: 0, right: 0, itemWidth: 14, itemHeight: 8, textStyle: { color: textColor, fontSize: 11 } }
      : undefined,
    tooltip: {
      trigger: 'axis',
      formatter: (params: unknown[]) => {
        const rows = params as { name: string; seriesName: string; value: number; marker: string; dataIndex: number }[]
        if (!rows.length) return ''
        const lines = rows.map(p =>
          multi
            ? `${p.marker}${p.seriesName}: <b>${fmtValue(p.value)}</b>`
            : `<b>${fmtValue(p.value)}</b>`)
        // 悬停采样点上落着的告警事件详情一并展示，无需精确悬停竖线
        for (const m of markersByIdx.get(rows[0].dataIndex) ?? []) {
          lines.push(`<span style="color:#E08600">⚠ 告警触发 ${fmtHmOf(m.ts)}${m.label ? `：${m.label}` : ''}</span>`)
        }
        return `${rows[0].name}<br/>${lines.join('<br/>')}`
      }
    },
    xAxis: {
      type: 'category',
      data: xData,
      boundaryGap: false,
      axisLabel: { color: textColor, fontSize: 11 },
      axisLine: { lineStyle: { color: axisLineColor } },
      splitLine: { show: false }
    },
    yAxis: {
      type: 'value',
      axisLabel: {
        color: textColor,
        fontSize: 11,
        formatter: (v: number) => (props.valueFormat === 'bytes' ? fmtValue(v) : v + props.unit)
      },
      splitLine: { lineStyle: { color: splitLineColor } }
    },
    series: list.map((s, sIdx) => ({
      name: s.name,
      type: 'line',
      data: s.data.map(p => p.value),
      smooth: true,
      symbol: 'none',
      lineStyle: { color: s.color, width: 2 },
      areaStyle: {
        color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
          { offset: 0, color: s.color + '30' },
          { offset: 1, color: s.color + '00' }
        ])
      },
      itemStyle: { color: s.color },
      // 阈值横线 + 事件竖线只挂第一个序列，避免多序列重复绘制；
      // silent: 竖线仅作视觉标记，详情通过轴向 tooltip 就近展示（避免细线难以悬停）
      ...(sIdx === 0 && markLineData(markersByIdx).length
        ? { markLine: { silent: true, symbol: 'none', animation: false, data: markLineData(markersByIdx) } }
        : {})
    }))
  }
}

function fmtHmOf(ts: number): string {
  const d = new Date(ts)
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`
}

/** 事件标记按最近采样点归位：类目轴索引 → 该索引上的事件列表 */
function markersByIndex(basePoints: TrendPoint[]): Map<number, EventMarker[]> {
  const map = new Map<number, EventMarker[]>()
  if (!basePoints.length) return map
  const firstTs = basePoints[0].ts
  const lastTs = basePoints[basePoints.length - 1].ts
  for (const m of props.markers) {
    if (m.ts < firstTs || m.ts > lastTs) continue
    let nearest = 0
    let nearestDiff = Infinity
    for (let i = 0; i < basePoints.length; i++) {
      const diff = Math.abs(basePoints[i].ts - m.ts)
      if (diff < nearestDiff) {
        nearestDiff = diff
        nearest = i
      }
    }
    const arr = map.get(nearest) ?? []
    arr.push(m)
    map.set(nearest, arr)
  }
  return map
}

/** 组装 markLine 数据：阈值横线（红色虚线）+ 事件触发竖线（橙色点线） */
function markLineData(markersByIdx: Map<number, EventMarker[]>): object[] {
  const data: object[] = []
  for (const t of props.thresholds) {
    data.push({
      yAxis: t.value,
      lineStyle: { color: '#E5484D', type: 'dashed', width: 1 },
      label: {
        formatter: t.label ?? String(t.value),
        position: 'insideEndTop',
        color: '#E5484D',
        fontSize: 10
      }
    })
  }
  for (const idx of markersByIdx.keys()) {
    data.push({
      xAxis: idx,
      lineStyle: { color: '#E08600', type: 'dotted', width: 1.5 },
      label: {
        formatter: '告警',
        position: 'insideEndTop',
        color: '#E08600',
        fontSize: 10
      }
    })
  }
  return data
}

const { update } = useECharts(chartRef, buildOption)

// 数据、颜色或标注变化时刷新图表
watch(() => [props.data, props.color, props.series, props.thresholds, props.markers], update, { deep: true })
</script>

<style scoped>
.trend-chart-wrap {
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: var(--el-border-radius-base);
  padding: 12px 12px 4px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.chart-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.chart-title {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 13px;
  font-weight: 500;
  color: var(--el-text-color-primary);
}
.chart-tip-icon {
  font-size: 14px;
  color: var(--el-text-color-placeholder);
  cursor: help;
}
.chart-tip-icon:hover {
  color: var(--el-color-primary);
}
.chart-latest {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
.chart-body {
  width: 100%;
  height: v-bind('props.height + "px"');
}
</style>
