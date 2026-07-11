<template>
  <el-card shadow="never" class="placeholder">
    <el-empty :description="`「${title}」页面建设中`">
      <template #image>
        <el-icon :size="56" color="var(--faint)"><Tools /></el-icon>
      </template>
      <p class="hint">该模块已规划于需求文档，脚手架阶段以占位页呈现，后续按页面骨架逐个实现。</p>
    </el-empty>
  </el-card>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { Tools } from '@element-plus/icons-vue'

const route = useRoute()
const title = computed(() => (route.meta.title as string) || '未命名')
</script>

<style scoped>
.placeholder {
  min-height: 60vh;
  display: flex;
  align-items: center;
  justify-content: center;
}
.hint {
  margin: 8px 0 0;
  color: var(--muted);
  font-size: 13px;
}
</style>
