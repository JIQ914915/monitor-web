<template>
  <el-empty :description="description" :image-size="80">
    <el-button type="primary" size="small" @click="app.openPicker()">选择实例</el-button>
  </el-empty>
</template>

<script setup lang="ts">
import { useAppStore } from '@/stores/app'

/** 实例相关页面的“未选择实例”占位：提示文案 + 打开顶栏实例选择器 */
withDefaults(defineProps<{ description?: string }>(), {
  description: '请先在顶栏选择一个实例',
})

const app = useAppStore()
</script>
