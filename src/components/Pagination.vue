<template>
  <div class="pagination">
    <el-pagination
      v-model:current-page="pageNum"
      v-model:page-size="pageSize"
      :total="total"
      :page-sizes="pageSizes"
      :layout="layout"
      background
      @current-change="onChange"
      @size-change="onSizeChange"
    >
      <span class="pagination__info">共 {{ total }} 条 &nbsp; 第 {{ rangeText }} 条</span>
    </el-pagination>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

// 通用分页器：双向绑定 pageNum/pageSize，翻页或改页大小时 emit change 由父组件拉取数据。
const pageNum = defineModel<number>('pageNum', { required: true })
const pageSize = defineModel<number>('pageSize', { required: true })

const props = withDefaults(
  defineProps<{
    total: number
    pageSizes?: number[]
    layout?: string
  }>(),
  {
    pageSizes: () => [10, 20, 50, 100],
    // slot=左侧「共X条 第a-b条」，-> 之后的控件靠右对齐
    layout: 'slot, ->, prev, pager, next, sizes, jumper'
  }
)

const emit = defineEmits<{ change: [] }>()

// 当前页数据区间「第 a-b 条」
const rangeText = computed(() => {
  if (props.total === 0) return '0-0'
  const from = (pageNum.value - 1) * pageSize.value + 1
  const to = Math.min(pageNum.value * pageSize.value, props.total)
  return `${from}-${to}`
})

function onChange() {
  emit('change')
}

// 改页大小时回到第 1 页，避免越界空页
function onSizeChange() {
  pageNum.value = 1
  emit('change')
}
</script>

<style scoped>
.pagination {
  margin-top: 12px;
  padding: 10px 4px 2px;
  border-top: 1px solid var(--el-border-color-lighter);
}
.pagination :deep(.el-pagination) {
  width: 100%;
}
.pagination__info {
  color: var(--el-text-color-secondary);
  font-size: 13px;
  font-weight: 400;
}
</style>
