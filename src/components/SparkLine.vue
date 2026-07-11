<template>
  <svg class="sparkline" :width="width" :height="height" :viewBox="`0 0 ${width} ${height}`">
    <polyline :points="points" fill="none" :stroke="color" stroke-width="1.5" stroke-linejoin="round" />
    <polygon :points="areaPoints" :fill="color" fill-opacity="0.12" stroke="none" />
  </svg>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    data: number[]
    width?: number
    height?: number
    color?: string
  }>(),
  { width: 96, height: 28, color: 'var(--signal)' }
)

const points = computed(() => {
  const d = props.data
  if (!d.length) return ''
  const max = Math.max(...d)
  const min = Math.min(...d)
  const span = max - min || 1
  const step = props.width / (d.length - 1 || 1)
  return d
    .map((v, i) => {
      const x = i * step
      const y = props.height - ((v - min) / span) * (props.height - 4) - 2
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')
})

const areaPoints = computed(() => {
  if (!points.value) return ''
  return `0,${props.height} ${points.value} ${props.width},${props.height}`
})
</script>

<style scoped>
.sparkline {
  display: block;
}
</style>
