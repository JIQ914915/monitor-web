<template>
  <div class="pg-slow-sql-page">
    <SlowSqlPage />
    <PgQueryAnalyticsPanel />
  </div>
</template>

<script setup lang="ts">
import SlowSqlPage from '@/views/monitor/shared/slowsql/index.vue'
import PgQueryAnalyticsPanel from './components/PgQueryAnalyticsPanel.vue'
</script>

<style scoped>.pg-slow-sql-page{padding-bottom:16px}.pg-slow-sql-page :deep(.analytics-card){margin-left:16px;margin-right:16px}</style>