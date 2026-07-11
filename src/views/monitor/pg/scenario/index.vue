<template>
  <ScenarioPage />
</template>

<script setup lang="ts">
// 场景管理为库类型无关的通用页：场景列表按当前实例的 db_type_id 自动过滤
// （PG 实例只看到 scenario.pg_* 与全类型通用场景），此处仅做路由挂载包装。
// 模板必须保持单根节点（根层不能有 HTML 注释），否则 Fragment 会卡死布局的 out-in 过渡。
import ScenarioPage from '@/views/monitor/shared/scenario/index.vue'
</script>
