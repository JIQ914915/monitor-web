<template>
  <div class="stat-card" :class="`stat-card--${size}`" :style="{ '--stat-tone': toneColor }">
    <div class="stat-label">{{ label }}</div>
    <div class="stat-value" :style="{ color: valueColor }">
      <slot name="value">{{ value ?? '-' }}<span v-if="unit" class="stat-unit">{{ unit }}</span></slot>
    </div>
    <div class="stat-sub">
      <slot name="sub">{{ sub }}</slot>
    </div>
    <!-- 附加内容（如迷你趋势线），绝对定位由使用方控制 -->
    <slot />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

/**
 * 统计卡片：白底 + 左侧 4px 信号色边 + label/value/sub 三行布局。
 * tone 支持预设色名或任意 CSS 颜色值（含 var(--xxx)）。
 */
const PRESET_TONES: Record<string, string> = {
  primary: '#6366f1',
  success: '#10b981',
  warning: '#f59e0b',
  danger:  '#ef4444',
  info:    '#9ca3af',
}

const props = withDefaults(defineProps<{
  label: string
  value?: string | number | null
  sub?: string
  /** 左侧信号色：预设名（primary/success/warning/danger/info）或 CSS 颜色 */
  tone?: string
  /** 数值颜色：默认跟随 tone；传 'none' 使用默认文字色；也可传任意 CSS 颜色 */
  valueTone?: string
  /** 数值单位后缀，小号字体展示 */
  unit?: string
  /** small 时数值字号更小（22px），适合一行多卡的密集布局 */
  size?: 'default' | 'small'
}>(), {
  tone: 'info',
  size: 'default',
})

function resolveTone(t: string): string {
  return PRESET_TONES[t] ?? t
}

const toneColor = computed(() => resolveTone(props.tone))
const valueColor = computed(() => {
  if (props.valueTone === 'none') return 'var(--el-text-color-primary)'
  return resolveTone(props.valueTone ?? props.tone)
})
</script>

<style scoped>
.stat-card {
  position: relative;
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: var(--radius-base);
  box-shadow: 0 1px 2px rgba(14, 26, 43, 0.05);
  padding: 14px 18px;
  border-left: 4px solid var(--stat-tone);
}
.stat-label {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
.stat-value {
  font-size: 28px;
  font-weight: 700;
  line-height: 1.3;
  margin: 4px 0 2px;
  font-variant-numeric: tabular-nums;
}
.stat-card--small .stat-value {
  font-size: 22px;
}
.stat-unit {
  font-size: 14px;
  font-weight: 400;
  margin-left: 2px;
}
.stat-sub {
  font-size: 12px;
  color: var(--el-text-color-placeholder);
}
</style>
