<template>
  <div class="rank-delta">
    <el-tag v-if="prevRank == null" type="warning" size="small" effect="plain">新上榜</el-tag>
    <span v-else-if="rankDiff > 0" class="delta-worse">↑{{ rankDiff }} 位</span>
    <span v-else-if="rankDiff < 0" class="delta-better">↓{{ -rankDiff }} 位</span>
    <span v-else class="delta-flat">持平</span>
    <span v-if="avgPct != null" :class="avgPct > 0 ? 'delta-worse' : avgPct < 0 ? 'delta-better' : 'delta-flat'">
      耗时{{ avgPct > 0 ? '+' : '' }}{{ avgPct.toFixed(1) }}%
    </span>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

/**
 * Top SQL 排名/耗时变化展示：
 * 排名上升（更靠前）= 该 SQL 占比变大 = 恶化（红色）；排名下降 = 好转（绿色）。
 */
const props = defineProps<{
  curRank: number
  prevRank: number | null
  curAvg: number
  prevAvg: number | null
}>()

/** 正数 = 排名上升（恶化），负数 = 排名下降（好转） */
const rankDiff = computed(() => (props.prevRank == null ? 0 : props.prevRank - props.curRank))

/** 平均耗时变化百分比；无对比基准或基准为 0 时为 null */
const avgPct = computed(() => {
  if (props.prevAvg == null || props.prevAvg <= 0) return null
  return ((props.curAvg - props.prevAvg) / props.prevAvg) * 100
})
</script>

<style scoped>
.rank-delta {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
}
.delta-worse {
  color: var(--el-color-danger);
  font-weight: 600;
}
.delta-better {
  color: var(--el-color-success);
  font-weight: 600;
}
.delta-flat {
  color: var(--el-text-color-secondary);
}
</style>
