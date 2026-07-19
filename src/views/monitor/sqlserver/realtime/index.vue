<template>
  <div class="sqlserver-realtime-page">
    <InstanceEmpty v-if="!inst" />
    <template v-else>
      <InstanceBanner
        :inst="inst"
        :owner-a-name="ownerAName"
        :owner-b-name="ownerBName"
        :group-name="groupName"
        :health-score="healthData?.score"
        @open-health="showHealthDialog = true"
        @toggle="handleToggle"
      />

      <CapabilityBanner :instance-id="inst.id" />

      <el-card shadow="never" class="tab-card">
        <el-tabs v-model="activeTab" class="detail-tabs">
          <el-tab-pane label="运行概况" name="overview">

            <div class="stat-grid">
              <StatCard label="运行状态" :value="availabilityText" :tone="availabilityTone" :sub="uptimeText" />
              <StatCard label="异常数据库" :value="display(SQL.DATABASE_ABNORMAL)" :tone="positive(SQL.DATABASE_ABNORMAL) ? 'danger' : 'success'" unit="个" sub="等待恢复、可疑、紧急或离线" />
              <StatCard label="疑似损坏页" :value="display(SQL.SUSPECT_PAGES)" :tone="positive(SQL.SUSPECT_PAGES) ? 'danger' : 'success'" unit="页" sub="来自 msdb suspect_pages 的未修复线索" />
              <StatCard label="用户连接" :value="display(SQL.CONNECTIONS)" tone="primary" unit="个" sub="当前用户连接数" />
              <StatCard label="被阻塞会话" :value="display(SQL.BLOCKED)" tone="primary" unit="个" sub="告警由实例规则和持续时间共同判断" />
              <StatCard label="内存授权等待" :value="display(SQL.MEMORY_PENDING)" tone="primary" unit="个" sub="告警由实例规则和持续时间共同判断" />
              <StatCard label="写入延迟" :value="display(SQL.WRITE_LATENCY)" tone="primary" unit="ms" sub="告警阈值读取实例已启用规则" />
              <StatCard label="事务日志使用率" :value="display(SQL.LOG_USED)" tone="primary" unit="%" sub="所有用户数据库中的最大值" />
            </div>
            <div class="chart-section">
              <div class="section-title">最近 1 小时趋势</div>
              <div class="chart-grid">
                <TrendChart title="批处理请求" unit="/s" :data="trend(SQL.BATCH_REQUESTS)" color="#0C7C97" tip="每秒批处理请求数，反映 SQL Server 当前工作负载变化。" />
                <TrendChart title="连接与活跃请求" :series="[{ name: '用户连接', color: '#0C7C97', data: trend(SQL.CONNECTIONS) }, { name: '活跃请求', color: '#6366F1', data: trend(SQL.ACTIVE_REQUESTS) }]" tip="连接数持续上升但活跃请求不高时，应检查连接池和空闲连接回收。" />
                <TrendChart title="CPU 调度等待" :data="trend(SQL.RUNNABLE_TASKS)" color="#E5484D" tip="等待 CPU 调度的任务数，持续升高时结合 Top SQL 和主机 CPU 排查。" />
                <TrendChart title="被阻塞会话" :data="trend(SQL.BLOCKED)" color="#9B59B6" tip="持续大于 0 时进入深度诊断查看阻塞链。" />
                <TrendChart title="文件 I/O 延迟" unit="ms" :series="[{ name: '读取', color: '#0C7C97', data: trend(SQL.READ_LATENCY) }, { name: '写入', color: '#E5484D', data: trend(SQL.WRITE_LATENCY) }]" tip="用户数据库文件平均读写延迟，持续升高时结合等待事件和主机磁盘排查。" />
                <TrendChart title="事务日志使用率" unit="%" :data="trend(SQL.LOG_USED)" color="#E08600" tip="所有用户数据库中的最大日志使用率，升高时检查长事务、日志备份和复用等待。" />
              </div>
            </div>
          </el-tab-pane>
          <el-tab-pane label="深度诊断" name="diagnostics">
            <SqlServerDiagnosticsPanel :instance-id="inst.id" />
          </el-tab-pane>
          <el-tab-pane label="监控能力" name="capabilities">
            <ProTable :data="capabilities" :columns="capabilityColumns" :show-toolbar="false" :show-operation="false" :show-pagination="false" embedded class="inner-table">
              <template #col-status="{ row }"><DictTag dict="capability_status" :value="row.status" /></template>
              <template #col-message="{ row }">{{ row.message || '能力已满足，无需处理' }}</template>
            </ProTable>
          </el-tab-pane>
        </el-tabs>
      </el-card>
    </template>

    <HealthScoreDialog v-model="showHealthDialog" :data="healthData" />
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { getHealthScore, getMetricLatest, getPerfTrendBatch } from '@/api/metric'
import { getInstanceCapabilities, toggleInstance, type InstanceCapability } from '@/api/instance'
import { listUserOptions } from '@/api/user'
import { listGroupOptions } from '@/api/group'
import CapabilityBanner from '@/components/CapabilityBanner.vue'
import DictTag from '@/components/DictTag.vue'
import InstanceEmpty from '@/components/InstanceEmpty.vue'
import ProTable from '@/components/ProTable/index.vue'
import type { TableColumn } from '@/components/ProTable/types'
import StatCard from '@/components/StatCard.vue'
import TrendChart from '@/components/TrendChart.vue'
import { useAutoRefresh } from '@/composables/useAutoRefresh'
import { useInstanceStore } from '@/stores/instance'
import type { UserOption, GroupOption } from '@/types'
import type { HealthScoreVo, TrendPoint } from '@/types/monitor'
import HealthScoreDialog from '@/views/monitor/shared/realtime/components/HealthScoreDialog.vue'
import InstanceBanner from '@/views/monitor/shared/realtime/components/InstanceBanner.vue'
import SqlServerDiagnosticsPanel from './components/SqlServerDiagnosticsPanel.vue'

const SQL = {
  AVAILABILITY: 'sqlserver.availability',
  UPTIME: 'sqlserver.uptime',
  DATABASE_ABNORMAL: 'sqlserver.database.abnormal_count',
  SUSPECT_PAGES: 'sqlserver.integrity.suspect_page_count',
  CONNECTIONS: 'sqlserver.conn.user',
  ACTIVE_REQUESTS: 'sqlserver.request.active',
  BATCH_REQUESTS: 'sqlserver.batch_requests_per_sec',
  RUNNABLE_TASKS: 'sqlserver.scheduler.runnable_tasks',
  BLOCKED: 'sqlserver.blocked_sessions',
  MEMORY_PENDING: 'sqlserver.memory.grants_pending',
  WRITE_LATENCY: 'sqlserver.io.write_latency_ms',
  READ_LATENCY: 'sqlserver.io.read_latency_ms',
  LOG_USED: 'sqlserver.storage.log_used_percent'
} as const


const capabilityColumns: TableColumn[] = [
  { prop: 'name', label: '能力', minWidth: 190 },
  { prop: 'status', label: '状态', width: 130, slot: 'col-status' },
  { prop: 'message', label: '说明与处理引导', minWidth: 360, slot: 'col-message' }
]

const instanceStore = useInstanceStore()
const inst = computed(() => instanceStore.current)
const activeTab = ref('overview')
const loading = ref(false)
const values = ref<Record<string, number | null>>({})
const capabilities = ref<InstanceCapability[]>([])

const trends = ref<Record<string, TrendPoint[]>>({})
const healthData = ref<HealthScoreVo | null>(null)
const showHealthDialog = ref(false)
const userOptions = ref<UserOption[]>([])
const groupOptions = ref<GroupOption[]>([])

const ownerAName = computed(() => {
  if (!inst.value?.ownerAId) return ''
  return userOptions.value.find(user => user.id === inst.value!.ownerAId)?.name ?? `#${inst.value.ownerAId}`
})
const ownerBName = computed(() => {
  if (!inst.value?.ownerBId) return ''
  return userOptions.value.find(user => user.id === inst.value!.ownerBId)?.name ?? `#${inst.value.ownerBId}`
})
const groupName = computed(() => {
  if (!inst.value?.groupIds?.length) return ''
  return inst.value.groupIds
    .map(id => groupOptions.value.find(group => group.id === id)?.name)
    .filter(Boolean)
    .join(' / ')
})

const valueOf = (code: string) => values.value[code]
const display = (code: string) => valueOf(code) == null ? '暂无数据' : String(valueOf(code))
const positive = (code: string) => (valueOf(code) ?? 0) > 0
const trend = (code: string) => trends.value[code] ?? []

const availabilityText = computed(() => {
  const value = valueOf(SQL.AVAILABILITY)
  return value == null ? '暂无数据' : value >= 1 ? '运行正常' : '连接失败'
})
const availabilityTone = computed(() => {
  const value = valueOf(SQL.AVAILABILITY)
  return value == null ? 'info' : value >= 1 ? 'success' : 'danger'
})
const uptimeText = computed(() => {
  const seconds = valueOf(SQL.UPTIME)
  if (seconds == null) return '等待分钟级采集数据'
  const days = Math.floor(seconds / 86400)
  const hours = Math.floor((seconds % 86400) / 3600)
  return `已运行 ${days} 天 ${hours} 小时`
})
async function load(silent = false) {
  if (!inst.value) return
  loading.value = true
  try {
    const now = Date.now()
    const trendCodes = [SQL.BATCH_REQUESTS, SQL.CONNECTIONS, SQL.ACTIVE_REQUESTS, SQL.RUNNABLE_TASKS, SQL.BLOCKED, SQL.READ_LATENCY, SQL.WRITE_LATENCY, SQL.LOG_USED]
    const [metricResult, capabilityResult, trendResult] = await Promise.allSettled([
      getMetricLatest(inst.value.id, Object.values(SQL)),
      getInstanceCapabilities(inst.value.id),

      getPerfTrendBatch({ instanceId: inst.value.id, metricCodes: trendCodes, from: now - 3600_000, to: now, frequency: '1m' })
    ])
    values.value = metricResult.status === 'fulfilled' ? (metricResult.value.values ?? {}) : {}
    capabilities.value = capabilityResult.status === 'fulfilled' ? capabilityResult.value : []

    trends.value = trendResult.status === 'fulfilled'
      ? Object.fromEntries((trendResult.value.series ?? []).map(series => [series.metricCode, series.points ?? []]))
      : {}
  } finally {
    loading.value = false
  }
}

async function loadMeta() {
  const [users, groups] = await Promise.allSettled([listUserOptions(), listGroupOptions()])
  if (users.status === 'fulfilled') userOptions.value = users.value
  if (groups.status === 'fulfilled') groupOptions.value = groups.value
}

async function loadHealth(instanceId: number) {
  try { healthData.value = await getHealthScore(instanceId) } catch { healthData.value = null }
}

async function handleToggle(status: 'normal' | 'paused') {
  if (!inst.value) return
  try {
    await toggleInstance(inst.value.id, status)
    ElMessage.success(status === 'normal' ? '已开启监控采集' : '已暂停监控采集')
    instanceStore.setCurrent({ ...inst.value, status })
  } catch { /* request.ts 已统一提示 */ }
}

watch(showHealthDialog, async (open) => {
  if (open && inst.value) await loadHealth(inst.value.id)
})

watch(() => inst.value?.id, (id) => {
  values.value = {}
  capabilities.value = []

  healthData.value = null
  if (id) {
    load()
    loadHealth(id)
  }
}, { immediate: true })

loadMeta()
</script>

<style scoped>
.sqlserver-realtime-page { display: flex; flex-direction: column; gap: var(--density-gap, 16px); min-height: 400px; }
.tab-card > :deep(.el-card__body) { padding: 0 16px 16px; }
.detail-tabs :deep(.el-tabs__header) { margin-bottom: 16px; }

.stat-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; }
.chart-section { margin-top: 20px; }
.chart-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; margin-top: 12px; }
.section-title { font-weight: 600; }
.inner-table { margin: -4px 0; }
@media (max-width: 1100px) { .stat-grid, .chart-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
</style>