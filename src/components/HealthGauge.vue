<template>
  <div class="health-gauge" :style="{ width: size + 'px', height: size + 'px' }">
    <svg :viewBox="`0 0 ${size} ${size}`" :width="size" :height="size">
      <circle
        :cx="c"
        :cy="c"
        :r="r"
        fill="none"
        stroke="var(--track)"
        :stroke-width="sw"
        :stroke-dasharray="`${arcLen} ${circumference}`"
        :transform="`rotate(135 ${c} ${c})`"
        stroke-linecap="round"
      />
      <circle
        v-if="hasValue"
        :cx="c"
        :cy="c"
        :r="r"
        fill="none"
        :stroke="color"
        :stroke-width="sw"
        :stroke-dasharray="`${valueLen} ${circumference}`"
        :transform="`rotate(135 ${c} ${c})`"
        stroke-linecap="round"
        class="gauge-value"
      />
    </svg>
    <div class="gauge-text">
      <span class="gauge-num" :style="{ color, fontSize: numSize + 'px' }">{{ display }}</span>
      <span v-if="showLabel" class="gauge-label" :style="{ fontSize: labelSize + 'px' }">{{ levelLabel }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useDict } from '@/composables/useDict'

const { getDictLabel } = useDict('health_level')

const props = withDefaults(
  defineProps<{
    value: number
    size?: number
    /** 描边宽度；不传则按尺寸等比（size * 0.1） */
    stroke?: number
    showLabel?: boolean
  }>(),
  { size: 96, showLabel: true }
)

const hasValue = computed(() => Number.isFinite(props.value))
const clamped = computed(() => Math.max(0, Math.min(100, Math.round(props.value))))
const display = computed(() => (hasValue.value ? clamped.value : '--'))

const c = computed(() => props.size / 2)
const sw = computed(() => props.stroke ?? Math.max(4, Math.round(props.size * 0.1)))
const r = computed(() => c.value - sw.value / 2 - 1)
const circumference = computed(() => 2 * Math.PI * r.value)
// 270° 弧（缺口在底部）
const arcLen = computed(() => circumference.value * 0.75)
const valueLen = computed(() => (arcLen.value * (hasValue.value ? clamped.value : 0)) / 100)

// 字号随尺寸等比缩放，避免在小尺寸（表格）中因 em 继承而失真
const numSize = computed(() => Math.round(props.size * 0.34))
const labelSize = computed(() => Math.max(9, Math.round(props.size * 0.15)))

/** 分数 → 健康等级编码（阈值与后端 HealthScoreServiceImpl.toLevel 保持一致） */
const level = computed(() => {
  if (!hasValue.value) return 'no_data'
  const v = clamped.value
  if (v >= 90) return 'excellent'
  if (v >= 75) return 'good'
  if (v >= 60) return 'warning'
  return 'critical'
})

const color = computed(() => {
  switch (level.value) {
    case 'excellent': return 'var(--status-excellent)'
    case 'good':      return 'var(--signal)'
    case 'warning':   return 'var(--status-warning)'
    case 'critical':  return 'var(--status-critical)'
    default:          return 'var(--faint)'
  }
})

const levelLabel = computed(() => {
  if (!hasValue.value) return '--'
  return getDictLabel('health_level', level.value) || level.value
})
</script>

<style scoped>
.health-gauge {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: none;
  vertical-align: middle;
}
.health-gauge svg {
  display: block;
}
.gauge-value {
  transition: stroke-dasharray 0.6s cubic-bezier(0.22, 1, 0.36, 1);
}
.gauge-text {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  line-height: 1;
  pointer-events: none;
}
.gauge-num {
  font-family: var(--font-display);
  font-weight: 700;
  line-height: 1;
  letter-spacing: -0.5px;
  font-variant-numeric: tabular-nums;
}
.gauge-label {
  color: var(--muted);
  font-weight: 500;
  letter-spacing: 0.2px;
}
</style>
