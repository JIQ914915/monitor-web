<template>
  <div class="sql-block" :style="{ maxHeight: maxHeight ? `${maxHeight}px` : undefined }">
    <pre class="sql-block__pre">{{ sql || emptyText }}</pre>
    <el-button
      v-if="copyable && sql"
      class="sql-block__copy"
      size="small"
      text
      :icon="CopyDocument"
      @click="copy"
    >复制</el-button>
  </div>
</template>

<script setup lang="ts">
import { ElMessage } from 'element-plus'
import { CopyDocument } from '@element-plus/icons-vue'

/** SQL / 命令展示块：mono 字体 + 浅色背景 + 固定高度滚动 + 一键复制 */
const props = withDefaults(defineProps<{
  sql?: string | null
  /** 是否显示复制按钮 */
  copyable?: boolean
  /** 最大高度（px），超出滚动 */
  maxHeight?: number
  /** 复制成功提示文案 */
  copyTip?: string
  /** 内容为空时的占位文本 */
  emptyText?: string
}>(), {
  copyable: true,
  maxHeight: 180,
  copyTip: 'SQL 已复制到剪贴板',
  emptyText: '(空)',
})

async function copy() {
  try {
    await navigator.clipboard.writeText(props.sql || '')
    ElMessage.success(props.copyTip)
  } catch {
    ElMessage.error('复制失败，请手动复制')
  }
}
</script>

<style scoped>
.sql-block {
  position: relative;
  background: var(--el-fill-color-light);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: var(--radius-sm);
  padding: 10px 12px;
  overflow: auto;
}
.sql-block__pre {
  margin: 0;
  font-family: var(--font-mono, 'JetBrains Mono', Consolas, monospace);
  font-size: 12px;
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-all;
  color: var(--el-text-color-primary);
}
.sql-block__copy {
  position: absolute;
  top: 6px;
  right: 6px;
}
</style>
