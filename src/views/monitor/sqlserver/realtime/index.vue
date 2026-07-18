<template>
  <div class="sqlserver-realtime-page">
    <InstanceEmpty v-if="!inst" />
    <template v-else>
      <el-card shadow="never">
        <template #header>
          <div class="page-head">
            <div>
              <div class="page-title">{{ inst.name }}</div>
              <div class="page-sub">SQL Server {{ inst.dbVersion || '-' }} · {{ inst.host }}:{{ inst.port }}</div>
            </div>
            <el-button :loading="loading" @click="load">刷新</el-button>
          </div>
        </template>
        <el-alert :title="conclusion.title" :type="conclusion.type" :description="conclusion.description" :closable="false" show-icon />
      </el-card>

      <div class="stat-grid">
        <StatCard label="运行状态" :value="availabilityText" :tone="availabilityTone" :sub="uptimeText" />
        <StatCard label="异常数据库" :value="display(SQL.DATABASE_ABNORMAL)" :tone="positive(SQL.DATABASE_ABNORMAL) ? 'danger' : 'success'" unit="个" sub="等待恢复、可疑、紧急或离线" />
        <StatCard label="疑似损坏页" :value="display(SQL.SUSPECT_PAGES)" :tone="positive(SQL.SUSPECT_PAGES) ? 'danger' : 'success'" unit="页" sub="来自 msdb suspect_pages 的未修复线索" />
        <StatCard label="用户连接" :value="display(SQL.CONNECTIONS)" tone="primary" unit="个" sub="当前用户连接数" />
        <StatCard label="被阻塞会话" :value="display(SQL.BLOCKED)" tone="primary" unit="个" sub="是否告警由实例规则和持续时间共同判断" />
        <StatCard label="内存授权等待" :value="display(SQL.MEMORY_PENDING)" tone="primary" unit="个" sub="是否告警由实例规则和持续时间共同判断" />
        <StatCard label="写入延迟" :value="display(SQL.WRITE_LATENCY)" tone="primary" unit="ms" sub="告警阈值读取实例已启用规则" />
        <StatCard label="事务日志使用率" :value="display(SQL.LOG_USED)" tone="primary" unit="%" sub="展示所有用户库中的最大值" />
      </div>

      <SqlServerDiagnosticsPanel :instance-id="inst.id" />

      <el-card shadow="never">
        <template #header><span class="section-title">监控能力状态</span></template>
        <ProTable
          :data="capabilities"
          :columns="capabilityColumns"
          :show-toolbar="false"
          :show-operation="false"
          :show-pagination="false"
          embedded
          class="inner-table"
        >
          <template #col-status="{ row }"><DictTag dict="capability_status" :value="row.status" /></template>
          <template #col-message="{ row }">{{ row.message || '能力已满足，无需处理' }}</template>
        </ProTable>
      </el-card>

      <el-card shadow="never">
        <template #header><span class="section-title">运维提示</span></template>
        <el-descriptions :column="1" border>
          <el-descriptions-item label="阻塞与死锁">平台只提供会话、等待和 SQL 证据，不自动终止会话。</el-descriptions-item>
          <el-descriptions-item label="配置与索引">平台只给出人工评估建议，不自动改参数、创建或删除索引。</el-descriptions-item>
          <el-descriptions-item label="高可用与备份">Always On、日志传送和备份记录用于风险判断，不自动切换或执行恢复。</el-descriptions-item>
        </el-descriptions>
      </el-card>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { getMetricLatest, pageAlertEvents } from '@/api/metric'
import { getInstanceCapabilities, type InstanceCapability } from '@/api/instance'
import DictTag from '@/components/DictTag.vue'
import InstanceEmpty from '@/components/InstanceEmpty.vue'
import ProTable from '@/components/ProTable/index.vue'
import type { TableColumn } from '@/components/ProTable/types'
import StatCard from '@/components/StatCard.vue'
import { useInstanceStore } from '@/stores/instance'
import type { AlertEventVo } from '@/types/monitor'
import SqlServerDiagnosticsPanel from './components/SqlServerDiagnosticsPanel.vue'

const SQL = {
  AVAILABILITY: 'sqlserver.availability',
  UPTIME: 'sqlserver.uptime',
  DATABASE_ABNORMAL: 'sqlserver.database.abnormal_count',
  SUSPECT_PAGES: 'sqlserver.integrity.suspect_page_count',
  CONNECTIONS: 'sqlserver.conn.user',
  BLOCKED: 'sqlserver.blocked_sessions',
  MEMORY_PENDING: 'sqlserver.memory.grants_pending',
  WRITE_LATENCY: 'sqlserver.io.write_latency_ms',
  LOG_USED: 'sqlserver.storage.log_used_percent'
} as const

const ACTIVE_EVENT_STATUSES = ['pending', 'confirmed', 'handling']
const capabilityColumns: TableColumn[] = [
  { prop: 'name', label: '能力', minWidth: 190 },
  { prop: 'status', label: '状态', width: 130, slot: 'col-status' },
  { prop: 'message', label: '说明与处理引导', minWidth: 360, slot: 'col-message' }
]

const instanceStore = useInstanceStore()
const inst = computed(() => instanceStore.current)
const loading = ref(false)
const values = ref<Record<string, number | null>>({})
const capabilities = ref<InstanceCapability[]>([])
const activeEvents = ref<AlertEventVo[]>([])

const valueOf = (code: string) => values.value[code]
const display = (code: string) => valueOf(code) == null ? '暂无数据' : String(valueOf(code))
const positive = (code: string) => (valueOf(code) ?? 0) > 0

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
const conclusion = computed<{ title: string; description: string; type: 'success' | 'warning' | 'error' | 'info' }>(() => {
  if (valueOf(SQL.AVAILABILITY) === 0) {
    return { title: 'SQL Server 当前无法连接', description: '请检查服务状态、网络连通性和监控账号配置。', type: 'error' }
  }
  if (positive(SQL.DATABASE_ABNORMAL)) {
    return { title: '存在状态异常的用户数据库', description: '请查看数据库状态和受影响对象，人工确认恢复路径。', type: 'error' }
  }
  if (positive(SQL.SUSPECT_PAGES)) {
    return { title: '发现疑似损坏页线索', description: '请核对 SQL Server 错误日志、存储状态和人工一致性检查结果。', type: 'error' }
  }
  const collect = capabilities.value.find(item => item.capability === 'collect')
  if (collect?.status === 'collect_error') {
    return { title: 'SQL Server 部分监控数据采集异常', description: collect.message || '请检查最近采集日志和账号权限。', type: 'warning' }
  }
  if (activeEvents.value.length) {
    const critical = activeEvents.value.some(event => event.ruleLevel === 'level_1')
    return {
      title: `当前存在 ${activeEvents.value.length} 个待处理告警或场景事件`,
      description: '结论来自实例已启用规则和场景，请进入告警管理查看影响范围与处理建议。',
      type: critical ? 'error' : 'warning'
    }
  }
  if (valueOf(SQL.AVAILABILITY) == null) {
    return { title: '正在等待 SQL Server 采集数据', description: '新接入实例通常在下一个分钟级采集周期后显示结论。', type: 'info' }
  }
  const limited = capabilities.value.filter(item => item.status !== 'available' && item.status !== 'not_applicable')
  return limited.length
    ? { title: 'SQL Server 核心运行状态正常', description: `当前有 ${limited.length} 项增强能力受限，详情见能力状态。`, type: 'info' }
    : { title: 'SQL Server 运行正常', description: '当前未发现核心数据库状态或已启用告警规则命中的风险。', type: 'success' }
})

async function load() {
  if (!inst.value) return
  loading.value = true
  try {
    const [metricResult, capabilityResult, eventResult] = await Promise.allSettled([
      getMetricLatest(inst.value.id, Object.values(SQL)),
      getInstanceCapabilities(inst.value.id),
      pageAlertEvents({ instanceId: inst.value.id, statuses: ACTIVE_EVENT_STATUSES, pageNum: 1, pageSize: 100 })
    ])
    values.value = metricResult.status === 'fulfilled' ? (metricResult.value.values ?? {}) : {}
    capabilities.value = capabilityResult.status === 'fulfilled' ? capabilityResult.value : []
    activeEvents.value = eventResult.status === 'fulfilled' ? (eventResult.value.list ?? []) : []
  } finally {
    loading.value = false
  }
}

watch(() => inst.value?.id, (id) => {
  values.value = {}
  capabilities.value = []
  activeEvents.value = []
  if (id) load()
}, { immediate: true })
</script>

<style scoped>
.sqlserver-realtime-page { display: flex; flex-direction: column; gap: 14px; }
.page-head { display: flex; align-items: center; justify-content: space-between; }
.page-title { font-size: 18px; font-weight: 600; }
.page-sub { margin-top: 4px; color: var(--el-text-color-secondary); font-size: 13px; }
.stat-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; }
.section-title { font-weight: 600; }
.inner-table { margin: -4px 0; }
@media (max-width: 1100px) { .stat-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
</style>