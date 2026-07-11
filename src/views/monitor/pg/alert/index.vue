<template>
  <AlertPage />
</template>

<script setup lang="ts">
// 告警管理为库类型无关的通用页：规则列表按当前实例类型自动下发 builtin.pg.* 规则，
// 事件分页/确认/处理流程完全复用，此处仅做路由挂载包装。
// 注意：模板必须保持单根节点（不能在根层写 HTML 注释），
// 否则组件渲染为 Fragment，布局的 <transition mode="out-in"> 离场动画永远无法完成，
// 会导致离开本页后整个内容区永久空白。
import AlertPage from '@/views/monitor/shared/alert/index.vue'
</script>
