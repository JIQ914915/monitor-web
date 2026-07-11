<template>
  <div class="report-chart">
    <p v-if="!hasData" class="chart-empty">{{ section.emptyText || '暂无数据' }}</p>
    <div v-else ref="chartRef" class="chart-body" />
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import * as echarts from 'echarts/core'
import { LineChart } from 'echarts/charts'
import { GridComponent, TooltipComponent, LegendComponent, MarkLineComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import { useECharts } from '@/composables/useECharts'
import type { ReportSection } from '@/api/report'

echarts.use([LineChart, GridComponent, TooltipComponent, LegendComponent, MarkLineComponent, CanvasRenderer])

const props = defineProps<{ section: ReportSection }>()

const chartRef = ref<HTMLDivElement>()

const PALETTE = ['#0c7c97', '#e6a23c', '#67c23a', '#f56c6c', '#909399', '#7d5fb2']

const hasData = computed(() =>
  (props.section.series ?? []).some(s => (s.points ?? []).length > 0)
)

function trimNum(v: number) {
  return Number(v.toFixed(2)).toString()
}

function fmtValue(v: number): string {
  if (v == null || Number.isNaN(v)) return '-'
  const u = props.section.unit || ''
  if (u === '%') return `${trimNum(v)}%`
  if (Math.abs(v) >= 1e8) return `${trimNum(v / 1e8)}亿${u}`
  if (Math.abs(v) >= 1e4) return `${trimNum(v / 1e4)}万${u}`
  return `${trimNum(v)}${u}`
}

function fmtTs(ts: number): string {
  const d = new Date(ts)
  const p = (n: number) => n.toString().padStart(2, '0')
  return `${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}

function buildOption() {
  const seriesList = props.section.series ?? []
  const markData = (props.section.markers ?? []).map(m => ({
    xAxis: m.ts,
    lineStyle: { color: m.color || '#E5484D', type: 'dashed' as const, width: 1.5 },
    label: { formatter: m.label, position: 'insideEndTop' as const, color: m.color || '#E5484D', fontSize: 10 }
  }))
  return {
    backgroundColor: 'transparent',
    grid: { top: seriesList.length > 1 ? 34 : 18, right: 16, bottom: 24, left: 56 },
    legend: seriesList.length > 1
      ? { top: 0, textStyle: { fontSize: 11 }, icon: 'roundRect', itemWidth: 14, itemHeight: 3 }
      : undefined,
    tooltip: {
      trigger: 'axis',
      textStyle: { fontSize: 11 },
      formatter: (params: unknown) => {
        const items = params as { value: [number, number]; marker: string; seriesName: string }[]
        if (!items?.length) return ''
        const head = fmtTs(items[0].value[0])
        return head + '<br/>' + items
          .map(it => `${it.marker}${it.seriesName}: <b>${fmtValue(Number(it.value[1]))}</b>`)
          .join('<br/>')
      }
    },
    xAxis: {
      type: 'time',
      axisLabel: { fontSize: 10, formatter: (v: number) => fmtTs(v), hideOverlap: true },
      splitLine: { show: false }
    },
    yAxis: {
      type: 'value',
      axisLabel: { fontSize: 10, formatter: (v: number) => fmtValue(v) },
      splitLine: { lineStyle: { color: '#F3F4F6' } }
    },
    series: seriesList.map((s, i) => ({
      name: s.name,
      type: 'line' as const,
      data: s.points,
      smooth: true,
      symbol: 'none',
      lineStyle: { color: PALETTE[i % PALETTE.length], width: 2 },
      itemStyle: { color: PALETTE[i % PALETTE.length] },
      areaStyle: seriesList.length === 1 ? { opacity: 0.08, color: PALETTE[0] } : undefined,
      markLine: i === 0 && markData.length
        ? { silent: true, symbol: 'none', animation: false, data: markData }
        : undefined
    }))
  }
}

const { update, getInstance } = useECharts(chartRef, buildOption)

watch(() => props.section, () => update(), { deep: true })

/** 导出 PNG（白底高清），供报告 Word/HTML 导出嵌图；无数据未渲染时返回 null */
function getImage(): string | null {
  const chart = getInstance()
  if (!chart) return null
  return chart.getDataURL({ type: 'png', pixelRatio: 2, backgroundColor: '#fff' })
}

defineExpose({ getImage })
</script>

<style scoped>
.report-chart {
  margin-top: 4px;
}
.chart-body {
  width: 100%;
  height: 240px;
}
.chart-empty {
  font-size: 13px;
  color: var(--el-text-color-placeholder);
  margin: 4px 0;
}
</style>
