<template>
  <SlowSqlPage />
</template>

<script setup lang="ts">
// 慢SQL/Top SQL 分析为库类型无关的通用页：数据统一来自 metric_top_sql（PG 由
// pg_stat_statements 差值写入）与 metric_slow_sql_sample（PG 由 pg_stat_activity 采样写入），
// 接口按 instanceId 查询，无类型分支；未启用 pg_stat_statements 时页面按
// stats.topSqlSupported=false 显示安装引导空态。此处仅做路由挂载包装。
// 模板必须保持单根节点（根层不能有 HTML 注释），否则 Fragment 会卡死布局的 out-in 过渡。
import SlowSqlPage from '@/views/monitor/shared/slowsql/index.vue'
</script>
