<template>
  <el-card shadow="never" class="category-chart-card" v-loading="loading">
    <template #header>
      <div class="card-header">
        <span class="card-title">
          {{ title }}
          <el-tooltip v-if="tip" placement="top" :show-after="150" popper-class="category-tip-popper">
            <template #content>
              <div class="category-tip-content">{{ tip }}</div>
            </template>
            <el-icon class="card-tip-icon"><QuestionFilled /></el-icon>
          </el-tooltip>
        </span>
      </div>
    </template>
    <el-empty v-if="!loading && isEmpty" :description="emptyText" :image-size="60" />
    <div v-show="!isEmpty" ref="chartRef" class="chart-body" />
  </el-card>
</template>

<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import * as echarts from 'echarts/core'
import { LineChart } from 'echarts/charts'
import { GridComponent, TooltipComponent, LegendComponent, MarkLineComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import { QuestionFilled } from '@element-plus/icons-vue'
import { useECharts } from '@/composables/useECharts'
import { fmtHm, fmtMdHm, trimNum } from '@/utils/format'
import type { TrendPoint } from '@/types/monitor'

echarts.use([LineChart, GridComponent, TooltipComponent, LegendComponent, MarkLineComponent, CanvasRenderer])

/** 阈值线：来自该实例已启用告警规则的触发阈值 */
export interface ThresholdLine {
  value: number
  label: string
}

/** 事件标记：窗口内告警事件的触发时间竖线 */
export interface EventMarker {
  ts: number
  label: string
}

export interface ChartSeries {
  name: string
  unit: string
  color: string
  points: TrendPoint[]
  thresholds?: ThresholdLine[]
}

const props = withDefaults(defineProps<{
  title: string
  series: ChartSeries[]
  loading?: boolean
  height?: number
  emptyText?: string
  markers?: EventMarker[]
  /** 分类含义气泡说明（标题旁问号图标悬浮展示，支持换行） */
  tip?: string
}>(), {
  loading: false,
  height: 220,
  emptyText: '该时间范围内暂无数据',
  markers: () => [],
  tip: ''
})

const chartRef = ref<HTMLDivElement>()

const isEmpty = computed(() => props.series.every(s => !s.points.length))

function fmtTime(ts: number, withDate: boolean) {
  return withDate ? fmtMdHm(ts) : fmtHm(ts)
}

/**
 * 数值 + 单位的向上自适应格式化：
 * 无量纲/计数 → 万/亿；GB → TB；ms → s/min；s → min/h；% 原样保留
 */
function fmtValue(v: number, unit: string): string {
  if (v == null || Number.isNaN(v)) return '-'
  switch (unit) {
    case '%':
      return `${trimNum(v)}%`
    case 'GB':
      if (Math.abs(v) >= 1024) return `${trimNum(v / 1024)}TB`
      return `${trimNum(v)}GB`
    case 'ms':
      if (Math.abs(v) >= 60_000) return `${trimNum(v / 60_000)}min`
      if (Math.abs(v) >= 1000) return `${trimNum(v / 1000)}s`
      return `${trimNum(v)}ms`
    case 's':
      if (Math.abs(v) >= 3600) return `${trimNum(v / 3600)}h`
      if (Math.abs(v) >= 60) return `${trimNum(v / 60)}min`
      return `${trimNum(v)}s`
    default: {
      const suffix = unit || ''
      if (Math.abs(v) >= 1e8) return `${trimNum(v / 1e8)}亿${suffix}`
      if (Math.abs(v) >= 1e4) return `${trimNum(v / 1e4)}万${suffix}`
      return `${trimNum(v)}${suffix}`
    }
  }
}

/**
 * 按单位分组分配 Y 轴：第一种单位用左轴，第二种单位用右轴；
 * 超过两种单位时（当前分类定义不会出现），从第三种起归入左轴。
 */
const axisUnits = computed<string[]>(() => {
  const units: string[] = []
  for (const s of props.series) {
    if (!units.includes(s.unit)) units.push(s.unit)
  }
  return units.slice(0, 2)
})

function axisIndexOf(unit: string): number {
  const idx = axisUnits.value.indexOf(unit)
  return idx === 1 ? 1 : 0
}

/** 采样间隔估算（取第一条非空序列前两点间隔，默认 1 分钟） */
function sampleIntervalMs(): number {
  for (const s of props.series) {
    if (s.points.length >= 2) return Math.abs(s.points[1].ts - s.points[0].ts)
  }
  return 60_000
}

/** 悬停时间点附近（±半个采样间隔）的事件标记 */
function nearbyMarkers(hoverTs: number): EventMarker[] {
  const half = sampleIntervalMs() / 2
  return props.markers.filter(m => Math.abs(m.ts - hoverTs) <= half)
}

function buildOption() {
  const root = document.documentElement
  const css = getComputedStyle(root)
  const isDark = root.classList.contains('dark')
  const readVar = (name: string, fallback: string) => css.getPropertyValue(name).trim() || fallback

  const textColor = isDark ? readVar('--muted', '#8A9CB8') : '#9CA3AF'
  const axisLineColor = isDark ? 'rgba(138, 156, 184, 0.30)' : '#E5E7EB'
  const splitLineColor = isDark ? 'rgba(138, 156, 184, 0.20)' : '#F3F4F6'

  // 时间跨度超过 24h 时轴标签带日期
  const allTs = props.series.flatMap(s => s.points.map(p => p.ts))
  const spanMs = allTs.length ? Math.max(...allTs) - Math.min(...allTs) : 0
  const withDate = spanMs > 24 * 3600_000

  const unitByName: Record<string, string> = {}
  props.series.forEach(s => { unitByName[s.name] = s.unit })

  const units = axisUnits.value
  const dualAxis = units.length > 1

  // 轴顶不再展示单位名，单位直接体现在每个刻度值上（如 100%、300页/s）
  const yAxis = units.map((unit, idx) => ({
    type: 'value' as const,
    position: idx === 0 ? 'left' as const : 'right' as const,
    axisLabel: {
      color: textColor,
      fontSize: 11,
      formatter: (v: number) => fmtValue(v, unit)
    },
    // 双轴时右轴不画分隔线，避免两套网格线交错
    splitLine: idx === 0
      ? { lineStyle: { color: splitLineColor } }
      : { show: false }
  }))

  return {
    backgroundColor: 'transparent',
    // 图例居右并避开右轴单位名区域，左侧留给左轴单位名；单行超宽时滚动
    grid: { top: 30, right: dualAxis ? 60 : 20, bottom: 26, left: 64 },
    legend: {
      type: 'scroll',
      top: 0,
      right: 0,
      itemWidth: 14,
      itemHeight: 8,
      textStyle: { color: textColor, fontSize: 11 },
      data: props.series.map(s => s.name)
    },
    tooltip: {
      trigger: 'axis',
      formatter: (params: unknown) => {
        const items = params as { seriesName: string; value: [number, number]; marker: string }[]
        if (!items.length) return ''
        const hoverTs = items[0].value[0]
        const lines = [fmtTime(hoverTs, true)]
        for (const it of items) {
          const unit = unitByName[it.seriesName] || ''
          const val = it.value[1] == null ? '-' : fmtValue(Number(it.value[1]), unit)
          lines.push(`${it.marker}${it.seriesName}: <b>${val}</b>`)
        }
        // 悬停点附近（±半个采样间隔）的告警事件详情一并展示，无需精确悬停竖线
        for (const m of nearbyMarkers(hoverTs)) {
          lines.push(`<span style="color:#E08600">⚠ 告警触发 ${fmtTime(m.ts, true)}${m.label ? `：${m.label}` : ''}</span>`)
        }
        return lines.join('<br/>')
      }
    },
    xAxis: {
      type: 'time',
      axisLabel: {
        color: textColor,
        fontSize: 11,
        formatter: (v: number) => fmtTime(v, withDate),
        hideOverlap: true
      },
      axisLine: { lineStyle: { color: axisLineColor } },
      splitLine: { show: false }
    },
    yAxis,
    series: props.series.map((s, sIdx) => {
      // 阈值横线（告警规则触发线）挂在各自序列上，跟随其 Y 轴；
      // 事件竖线只挂第一个序列，避免多序列重复绘制
      const markData: object[] = []
      for (const t of s.thresholds ?? []) {
        markData.push({
          yAxis: t.value,
          lineStyle: { color: '#E5484D', type: 'dashed', width: 1 },
          label: {
            formatter: t.label,
            position: 'insideEndTop',
            color: '#E5484D',
            fontSize: 10
          }
        })
      }
      if (sIdx === 0) {
        for (const m of props.markers) {
          markData.push({
            xAxis: m.ts,
            lineStyle: { color: '#E08600', type: 'dotted', width: 1.5 },
            label: {
              formatter: '告警',
              position: 'insideEndTop',
              color: '#E08600',
              fontSize: 10
            }
          })
        }
      }
      return {
        name: s.name,
        type: 'line',
        yAxisIndex: axisIndexOf(s.unit),
        data: s.points.map(p => [p.ts, p.value]),
        smooth: true,
        symbol: 'none',
        lineStyle: { color: s.color, width: 2 },
        itemStyle: { color: s.color },
        // silent: 竖线仅作视觉标记，详情通过轴向 tooltip 就近展示（避免细线难以悬停）
        ...(markData.length
          ? { markLine: { silent: true, symbol: 'none', animation: false, data: markData } }
          : {})
      }
    })
  }
}

const { update } = useECharts(chartRef, buildOption)

watch(() => [props.series, props.markers], () => update(), { deep: true })
</script>

<style scoped>
.category-chart-card :deep(.el-card__header) {
  padding: 10px 16px;
}
.category-chart-card :deep(.el-card__body) {
  padding: 8px 12px 4px;
}
.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
/* 字号/字重/颜色由全局 .card-title 统一，这里仅补充图标布局 */
.card-title {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
.card-tip-icon {
  font-size: 14px;
  color: var(--el-text-color-placeholder);
  cursor: help;
}
.card-tip-icon:hover {
  color: var(--el-color-primary);
}
.category-tip-content {
  max-width: 360px;
  white-space: pre-line;
  line-height: 1.7;
}
.chart-body {
  width: 100%;
  height: v-bind('props.height + "px"');
}
</style>
