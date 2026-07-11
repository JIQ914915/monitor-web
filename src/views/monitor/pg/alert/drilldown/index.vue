<template>
  <DrilldownPage />
</template>

<script setup lang="ts">
// 事件分析（下钻）为通用页：按 eventId 加载事件与指标趋势，与库类型无关。
// 挂在 /monitor/pg/alert/drilldown 下，保证 PG 实例的下钻不落入 MySQL 分组。
// 模板必须保持单根节点（根层不能有 HTML 注释），否则 Fragment 会卡死布局的 out-in 过渡。
import DrilldownPage from '@/views/monitor/shared/alert/drilldown/index.vue'
</script>
