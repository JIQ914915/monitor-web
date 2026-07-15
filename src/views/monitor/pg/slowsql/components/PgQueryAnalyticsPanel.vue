<template>
  <el-card shadow="never" class="analytics-card">
    <el-tabs v-model="tab" @tab-change="loadActive">
      <el-tab-pane label="Query Analytics" name="analytics">
        <el-form inline class="filters" @submit.prevent>
          <el-form-item label="数据库"><el-input v-model="database" clearable placeholder="全部" /></el-form-item>
          <el-form-item label="用户"><el-input v-model="user" clearable placeholder="全部" /></el-form-item>
          <el-form-item label="Query ID"><el-input v-model="queryId" clearable placeholder="全部" style="width: 170px" /></el-form-item>
          <el-form-item label="时间范围"><el-date-picker v-model="dateRange" type="datetimerange" range-separator="至" start-placeholder="开始" end-placeholder="结束" /></el-form-item>
          <el-form-item label="排序">
            <el-select v-model="sortBy" style="width: 150px">
              <el-option label="总执行时间" value="totalExecTimeMs" />
              <el-option label="平均耗时" value="avgExecTimeMs" />
              <el-option label="调用次数" value="calls" />
              <el-option label="临时块写入" value="tempWritten" />
              <el-option label="WAL 字节" value="walBytes" />
            </el-select>
          </el-form-item>
          <el-button type="primary" :loading="loading" @click="loadAnalytics">查询</el-button>
        </el-form>
        <el-table :data="analytics" v-loading="loading" border stripe height="430">
          <el-table-column prop="database" label="数据库" width="130" />
          <el-table-column prop="user" label="用户" width="120" />
          <el-table-column prop="queryText" label="SQL" min-width="340" show-overflow-tooltip />
          <el-table-column prop="calls" label="调用" width="90" sortable />
          <el-table-column label="平均耗时(ms)" width="130"><template #default="{ row }">{{ fmt(row.avgExecTimeMs) }}</template></el-table-column>
          <el-table-column label="P波动(ms)" width="115"><template #default="{ row }">{{ fmt(row.stddevExecTimeMs) }}</template></el-table-column>
          <el-table-column label="共享读块" width="110"><template #default="{ row }">{{ fmt(row.sharedRead, 0) }}</template></el-table-column>
          <el-table-column label="临时写块" width="110"><template #default="{ row }">{{ fmt(row.tempWritten, 0) }}</template></el-table-column>
          <el-table-column label="I/O读(ms)" width="110"><template #default="{ row }">{{ row.blockReadTimeMs == null ? '未启用' : fmt(row.blockReadTimeMs) }}</template></el-table-column>
          <el-table-column label="WAL" width="100"><template #default="{ row }">{{ bytes(row.walBytes) }}</template></el-table-column>
          <el-table-column label="操作" fixed="right" width="100"><template #default="{ row }"><el-button link type="primary" @click="openPlan(row)">执行计划</el-button></template></el-table-column>
        </el-table>
      </el-tab-pane>
      <el-tab-pane label="性能回退" name="regressions">
        <el-alert type="info" :closable="false" title="基于最近 2 小时与过去 4 周相同星期、小时段对比；事件会保留证据和基线窗口。" class="tip" />
        <el-table :data="regressions" v-loading="regressionLoading" border stripe height="430">
          <el-table-column prop="database" label="数据库" width="130" />
          <el-table-column prop="queryText" label="SQL" min-width="360" show-overflow-tooltip />
          <el-table-column prop="type" label="类型" width="150" />
          <el-table-column label="等级" width="90"><template #default="{ row }"><el-tag :type="row.severity === 'critical' ? 'danger' : 'warning'">{{ row.severity }}</el-tag></template></el-table-column>
          <el-table-column label="基线→当前" width="180"><template #default="{ row }">{{ fmt(row.baselineValue) }} → {{ fmt(row.currentValue) }}</template></el-table-column>
          <el-table-column label="变化" width="100"><template #default="{ row }">{{ row.changeRatio == null ? '-' : `${fmt(row.changeRatio * 100)}%` }}</template></el-table-column>
          <el-table-column prop="detectedAt" label="发现时间" width="180" />
        </el-table>
      </el-tab-pane>
    </el-tabs>
  </el-card>

  <el-dialog v-model="planVisible" title="安全执行计划（仅 EXPLAIN，不执行 ANALYZE）" width="820px">
    <el-input v-model="planSql" type="textarea" :rows="7" placeholder="仅支持无需绑定参数的 SELECT / WITH / TABLE 语句" />
    <template #footer><el-button @click="planVisible = false">取消</el-button><el-button type="primary" :loading="planLoading" @click="capturePlan">采集计划</el-button></template>
    <el-divider v-if="plans.length">历史版本</el-divider>
    <el-table v-if="plans.length" :data="plans" border max-height="260">
      <el-table-column prop="capturedAt" label="采集时间" width="190" />
      <el-table-column prop="planHash" label="Plan Hash" min-width="220" show-overflow-tooltip />
      <el-table-column label="变化" width="90"><template #default="{ row }"><el-tag :type="row.planChanged ? 'warning' : 'success'">{{ row.planChanged ? '已变化' : '未变化' }}</el-tag></template></el-table-column>
      <el-table-column label="节点" width="80"><template #default="{ row }">{{ row.nodeSummary?.length ?? 0 }}</template></el-table-column>
    </el-table>
  </el-dialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { useInstanceStore } from '@/stores/instance'
import { capturePgPlan, listPgPlanHistory, listPgQueryAnalytics, listPgSqlRegressions } from '@/api/postgresql'
import type { PgPlanHistory, PgQueryAnalytics, PgSqlRegression } from '@/api/postgresql'

const instanceStore = useInstanceStore()
const instanceId = computed(() => instanceStore.current?.id)
const tab = ref('analytics')
const database = ref('')
const user = ref('')
const queryId = ref('')
const dateRange = ref<[Date, Date]>([new Date(Date.now() - 7 * 86400000), new Date()])
const sortBy = ref('totalExecTimeMs')
const loading = ref(false)
const regressionLoading = ref(false)
const analytics = ref<PgQueryAnalytics[]>([])
const regressions = ref<PgSqlRegression[]>([])
const planVisible = ref(false)
const planLoading = ref(false)
const planSql = ref('')
const planRow = ref<PgQueryAnalytics>()
const plans = ref<PgPlanHistory[]>([])

async function loadAnalytics() {
  if (!instanceId.value) return
  loading.value = true
  try { analytics.value = await listPgQueryAnalytics({ instanceId: instanceId.value, database: database.value || undefined, user: user.value || undefined, queryId: queryId.value || undefined, from: dateRange.value?.[0]?.toISOString(), to: dateRange.value?.[1]?.toISOString(), sortBy: sortBy.value, limit: 200 }) } finally { loading.value = false }
}
async function loadRegressions() {
  if (!instanceId.value) return
  regressionLoading.value = true
  try { regressions.value = await listPgSqlRegressions(instanceId.value) } finally { regressionLoading.value = false }
}
function loadActive(name: string | number) { if (name === 'regressions') loadRegressions(); else loadAnalytics() }
async function openPlan(row: any) {
  planRow.value = row; planSql.value = row.queryText; planVisible.value = true
  if (instanceId.value) plans.value = await listPgPlanHistory(instanceId.value, row.database, row.queryId)
}
async function capturePlan() {
  if (!instanceId.value || !planRow.value) return
  planLoading.value = true
  try {
    await capturePgPlan(instanceId.value, planRow.value.database, planRow.value.queryId, planSql.value)
    plans.value = await listPgPlanHistory(instanceId.value, planRow.value.database, planRow.value.queryId)
    ElMessage.success('执行计划已采集')
  } finally { planLoading.value = false }
}
function fmt(v?: number, digits = 2) { return v == null ? '-' : Number(v).toFixed(digits) }
function bytes(v: number) { if (!v) return '0 B'; const u = ['B', 'KB', 'MB', 'GB']; const i = Math.min(Math.floor(Math.log(v) / Math.log(1024)), 3); return `${(v / 1024 ** i).toFixed(1)} ${u[i]}` }
watch(instanceId, () => loadAnalytics(), { immediate: true })
</script>

<style scoped>.analytics-card{margin-top:16px}.filters{margin-bottom:4px}.tip{margin-bottom:12px}</style>