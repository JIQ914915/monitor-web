<template>
  <el-config-provider :size="elSize" :locale="zhCn">
    <router-view />
  </el-config-provider>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import zhCn from 'element-plus/es/locale/lang/zh-cn'
import { useThemeStore } from '@/stores/theme'

const theme = useThemeStore()

// 界面密度 → Element Plus 全局组件尺寸（紧凑/默认/宽松），使表格、表单、按钮等整体变高/变矮
const elSize = computed<'small' | 'default' | 'large'>(() =>
  theme.density === 'compact' ? 'small' : theme.density === 'loose' ? 'large' : 'default'
)
</script>
