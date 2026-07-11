<template>
  <div class="dd-chart">
    <div class="dd-chart-title">
      <span class="dd-chart-label">{{ label }}</span>
      <el-tag v-if="changeTag" :type="changeTag.type" size="small" effect="plain">{{ changeTag.text }}</el-tag>
    </div>
    <el-empty v-if="!points.length" description="窗口内暂无数据" :image-size="48" />
    <div v-else ref="chartRef" class="dd-chart-body" />
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import * as echarts from 'echarts/core'
import { LineChart } from 'echarts/charts'
import { GridComponent, TooltipComponent, MarkLineComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import { useECharts } from '@/composables/useECharts'
import { fmtHm as fmtTime } from '@/utils/format'
import type { TrendPoint } from '@/types/monitor'
import { computed } from 'vue'

echarts.use([LineChart, GridComponent, TooltipComponent, MarkLineComponent, CanvasRenderer])

const props = withDefaults(defineProps<{
  label: string
  unit: string
  color: string
  points: TrendPoint[]
  /** 告警触发时间（红色虚线标记） */
  triggerTs: number
  /** 恢复时间（绿色虚线标记，未恢复不传） */
  recoveryTs?: number | null
  /** 触发前后均值变化率（%），null 表示无法计算 */
  change?: number | null
}>(), { recoveryTs: null, change: null })

const chartRef = ref<HTMLDivElement>()

const changeTag = computed<{ type: 'danger' | 'warning' | 'success' | 'info'; text: string } | null>(() => {
  if (props.change == null) return null
  const c = props.change
  const text = `${c > 0 ? '↑' : c < 0 ? '↓' : ''}${Math.abs(c).toFixed(0)}%`
  if (c > 50) return { type: 'danger', text }
  if (c > 20) return { type: 'warning', text }
  if (c < -10) return { type: 'info', text }
  return { type: 'success', text }
})

function trimNum(v: number) {
  return Number(v.toFixed(2)).toString()
}

function fmtValue(v: number): string {
  if (v == null || Number.isNaN(v)) return '-'
  const u = props.unit || ''
  if (u === '%') return `${trimNum(v)}%`
  if (Math.abs(v) >= 1e8) return `${trimNum(v / 1e8)}亿${u}`
  if (Math.abs(v) >= 1e4) return `${trimNum(v / 1e4)}万${u}`
  return `${trimNum(v)}${u}`
}

function buildOption() {
  const root = document.documentElement
  const isDark = root.classList.contains('dark')
  const textColor = isDark ? '#8A9CB8' : '#9CA3AF'
  const splitLineColor = isDark ? 'rgba(138, 156, 184, 0.2)' : '#F3F4F6'

  const markData: object[] = [
    {
      xAxis: props.triggerTs,
      lineStyle: { color: '#E5484D', type: 'dashed', width: 1.5 },
      label: { formatter: '告警', position: 'insideEndTop', color: '#E5484D', fontSize: 10 }
    }
  ]
  if (props.recoveryTs) {
    markData.push({
      xAxis: props.recoveryTs,
      lineStyle: { color: '#15A36A', type: 'dashed', width: 1.5 },
      label: { formatter: '恢复', position: 'insideEndTop', color: '#15A36A', fontSize: 10 }
    })
  }

  return {
    backgroundColor: 'transparent',
    grid: { top: 18, right: 12, bottom: 22, left: 52 },
    tooltip: {
      trigger: 'axis',
      textStyle: { fontSize: 11 },
      formatter: (params: unknown) => {
        const items = params as { value: [number, number]; marker: string }[]
        if (!items.length) return ''
        const d = new Date(items[0].value[0])
        const head = `${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')} ${fmtTime(items[0].value[0])}`
        return `${head}<br/>${items[0].marker}${props.label}: <b>${fmtValue(Number(items[0].value[1]))}</b>`
      }
    },
    xAxis: {
      type: 'time',
      axisLabel: { color: textColor, fontSize: 10, formatter: (v: number) => fmtTime(v), hideOverlap: true },
      splitLine: { show: false }
    },
    yAxis: {
      type: 'value',
      axisLabel: { color: textColor, fontSize: 10, formatter: (v: number) => fmtValue(v) },
      splitLine: { lineStyle: { color: splitLineColor } }
    },
    series: [{
      type: 'line',
      data: props.points.map(p => [p.ts, p.value]),
      smooth: true,
      symbol: 'none',
      lineStyle: { color: props.color, width: 2 },
      itemStyle: { color: props.color },
      areaStyle: { opacity: 0.08, color: props.color },
      markLine: { silent: true, symbol: 'none', animation: false, data: markData }
    }]
  }
}

const { update, getInstance } = useECharts(chartRef, buildOption)

watch(() => [props.points, props.recoveryTs], () => update(), { deep: true })

/** 导出图表 PNG（base64，白底高清），供诊断报告嵌入；无数据未渲染时返回 null */
function getImage(): string | null {
  const chart = getInstance()
  if (!chart) return null
  return chart.getDataURL({ type: 'png', pixelRatio: 2, backgroundColor: '#fff' })
}

defineExpose({ getImage })
</script>

<style scoped>
.dd-chart {
  border: 1px solid var(--el-border-color-lighter);
  border-radius: var(--radius-base);
  padding: 10px 12px 6px;
  background: var(--el-bg-color);
}
.dd-chart-title {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
}
.dd-chart-label {
  font-size: 13px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}
.dd-chart-body {
  width: 100%;
  height: 150px;
}
.dd-chart :deep(.el-empty) {
  padding: 12px 0;
}
</style>
