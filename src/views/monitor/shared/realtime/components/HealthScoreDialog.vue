<template>
  <el-dialog
    v-model="visible"
    title="健康评分详情"
    width="720px"
    top="6vh"
    :append-to-body="true"
    destroy-on-close
  >
    <div v-if="data" class="score-dialog">
      <!-- 上半区：左（仪表盘 + 五维进度条）/ 右（雷达图），压缩纵向高度避免弹窗超出视口 -->
      <div class="score-grid">
        <div class="score-left">
          <div class="score-top">
            <HealthGauge :value="Math.max(0, data.score)" :size="96" :stroke="9" />
            <div class="score-meta">
              <span class="score-num">{{ data.score >= 0 ? data.score : '—' }}</span>
              <DictTag dict="health_level" :value="data.level" />
            </div>
          </div>

          <div class="dims">
            <div v-for="d in data.dimensions" :key="d.dimension" class="dim-row">
              <span class="dim-name">{{ d.label }}</span>
              <el-progress
                :percentage="d.score < 0 ? 0 : d.score"
                :color="progressColor(d.score / 100)"
                :stroke-width="8"
                class="dim-bar"
              />
            </div>
          </div>
        </div>

        <div ref="radarRef" class="radar-chart" />
      </div>

      <!-- 扣分明细 -->
      <div class="deductions">
        <div class="section-title">扣分明细</div>
        <el-empty v-if="!data.deductions.length" description="各维度正常，无扣分项" :image-size="60" />
        <div v-else class="deduct-list">
          <div v-for="(d, i) in data.deductions" :key="i" class="deduct-item">
            <div class="deduct-left">
              <el-tag type="warning" size="small">{{ dimLabel(d.dimension) }}</el-tag>
              <span class="deduct-reason">{{ d.message }}</span>
            </div>
            <span class="deduct-score">-{{ d.points }}</span>
          </div>
        </div>
      </div>
    </div>
    <div v-else class="empty-state">
      <el-empty description="暂无健康评分数据" />
    </div>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, watch, nextTick } from 'vue'
import * as echarts from 'echarts/core'
import { RadarChart } from 'echarts/charts'
import { RadarComponent, TooltipComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import { useECharts } from '@/composables/useECharts'
import HealthGauge from '@/components/HealthGauge.vue'
import DictTag from '@/components/DictTag.vue'
import type { HealthScoreVo } from '@/types/monitor'

echarts.use([RadarChart, RadarComponent, TooltipComponent, CanvasRenderer])

const props = defineProps<{
  modelValue: boolean
  data: HealthScoreVo | null
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', val: boolean): void
}>()

const visible = ref(props.modelValue)
const radarRef = ref<HTMLDivElement>()

watch(() => props.modelValue, v => { visible.value = v })
watch(visible, v => emit('update:modelValue', v))

function buildRadarOption() {
  const data = props.data
  if (!data) return {}
  return {
    tooltip: { trigger: 'item' },
    radar: {
      indicator: data.dimensions.map(d => ({ name: d.label, max: 100 })),
      radius: '65%',
      axisName: { color: '#6B7280', fontSize: 12 },
      splitLine: { lineStyle: { color: '#F3F4F6' } },
      splitArea: { show: false }
    },
    series: [{
      type: 'radar',
      data: [{
        value: data.dimensions.map(d => Math.max(0, d.score)),
        name: '健康得分',
        lineStyle: { color: '#0C7C97', width: 2 },
        areaStyle: { color: '#0C7C9730' },
        itemStyle: { color: '#0C7C97' }
      }]
    }]
  }
}

// destroy-on-close 会重建容器节点，useECharts 内部监听 elRef 自动重绑定
const radar = useECharts(radarRef, buildRadarOption)

watch([() => props.data, visible], async ([data, vis]) => {
  if (!vis || !data) return
  await nextTick()
  radar.update()
})

const DIM_LABEL: Record<string, string> = {
  availability: '可用性',
  performance:  '性能',
  stability:    '稳定性',
  capacity:     '容量',
  security:     '安全配置',
}

function dimLabel(code: string) {
  return DIM_LABEL[code] ?? code
}

function progressColor(ratio: number) {
  if (ratio >= 0.9) return '#15A36A'
  if (ratio >= 0.7) return '#E08600'
  return '#E5484D'
}
</script>

<style scoped>
.score-dialog {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
/* 上半区左右布局：左侧总分 + 五维，右侧雷达图 */
.score-grid {
  display: grid;
  grid-template-columns: 1fr 260px;
  gap: 16px;
  align-items: center;
}
.score-left {
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-width: 0;
}
.score-top {
  display: flex;
  align-items: center;
  gap: 20px;
}
.score-meta {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.score-num {
  font-family: var(--font-display);
  font-size: 36px;
  font-weight: 700;
  color: var(--el-text-color-primary);
}
.dims {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.dim-row {
  display: grid;
  grid-template-columns: 80px 1fr;
  align-items: center;
  gap: 12px;
}
.dim-name {
  font-size: 13px;
  color: var(--el-text-color-secondary);
  white-space: nowrap;
}
.dim-bar {
  flex: 1;
}
.radar-chart {
  height: 220px;
  width: 260px;
}
.section-title {
  font-size: 13px;
  font-weight: 500;
  color: var(--el-text-color-primary);
  margin-bottom: 8px;
}
.deduct-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  /* 扣分项多时固定高度滚动，避免弹窗被撑得过长 */
  max-height: 240px;
  overflow-y: auto;
  padding-right: 4px;
}
.deduct-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  background: var(--el-fill-color-lighter);
  border-radius: var(--el-border-radius-base);
}
.deduct-left {
  display: flex;
  align-items: center;
  gap: 8px;
}
.deduct-reason {
  font-size: 13px;
  color: var(--el-text-color-primary);
}
.deduct-score {
  font-size: 13px;
  font-weight: 600;
  color: var(--el-color-danger);
}
.empty-state {
  padding: 40px 0;
  text-align: center;
}
</style>
