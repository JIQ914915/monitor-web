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
        <StatCard label="用户连接" :value="display(SQL.CONNECTIONS)" tone="primary" unit="个" sub="当前用户连接数" />
        <StatCard label="被阻塞会话" :value="display(SQL.BLOCKED)" :tone="positive(SQL.BLOCKED) ? 'warning' : 'success'" unit="个" sub="持续出现时应排查持锁会话" />
        <StatCard label="内存授权等待" :value="display(SQL.MEMORY_PENDING)" :tone="positive(SQL.MEMORY_PENDING) ? 'warning' : 'success'" unit="个" sub="偏高通常表示查询内存压力" />
        <StatCard label="写入延迟" :value="display(SQL.WRITE_LATENCY)" :tone="atLeast(SQL.WRITE_LATENCY, 20) ? 'warning' : 'success'" unit="ms" sub="数据库文件平均写延迟" />
        <StatCard label="事务日志使用率" :value="display(SQL.LOG_USED)" :tone="atLeast(SQL.LOG_USED, 80) ? 'danger' : 'success'" unit="%" sub="接近上限时检查日志备份与复用等待" />
      </div>

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
import { getMetricLatest } from '@/api/metric'
import InstanceEmpty from '@/components/InstanceEmpty.vue'
import StatCard from '@/components/StatCard.vue'
import { useInstanceStore } from '@/stores/instance'

const SQL = {
  AVAILABILITY: 'sqlserver.availability',
  UPTIME: 'sqlserver.uptime',
  CONNECTIONS: 'sqlserver.conn.user',
  BLOCKED: 'sqlserver.blocked_sessions',
  MEMORY_PENDING: 'sqlserver.memory.grants_pending',
  WRITE_LATENCY: 'sqlserver.io.write_latency_ms',
  LOG_USED: 'sqlserver.storage.log_used_percent'
} as const

const instanceStore = useInstanceStore()
const inst = computed(() => instanceStore.current)
const loading = ref(false)
const values = ref<Record<string, number | null>>({})

const valueOf = (code: string) => values.value[code]
const display = (code: string) => valueOf(code) == null ? '暂无数据' : String(valueOf(code))
const positive = (code: string) => (valueOf(code) ?? 0) > 0
const atLeast = (code: string, threshold: number) => (valueOf(code) ?? 0) >= threshold

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
  if (valueOf(SQL.AVAILABILITY) === 0) return { title: 'SQL Server 当前无法连接', description: '请检查服务状态、网络连通性和监控账号权限。', type: 'error' }
  if (atLeast(SQL.LOG_USED, 80)) return { title: '事务日志空间需要关注', description: '请检查日志复用等待、日志备份策略和长事务。', type: 'warning' }
  if (positive(SQL.BLOCKED) || positive(SQL.MEMORY_PENDING)) return { title: '数据库存在性能等待', description: '请结合告警事件、慢 SQL 和阻塞链进一步排查。', type: 'warning' }
  if (valueOf(SQL.AVAILABILITY) == null) return { title: '正在等待 SQL Server 采集数据', description: '新接入实例通常在下一个分钟级采集周期后显示结论。', type: 'info' }
  return { title: 'SQL Server 运行正常', description: '当前未发现关键连接、阻塞、内存授权或日志空间风险。', type: 'success' }
})

async function load() {
  if (!inst.value) return
  loading.value = true
  try {
    const response = await getMetricLatest(inst.value.id, Object.values(SQL))
    values.value = response.values ?? {}
  } finally {
    loading.value = false
  }
}

watch(() => inst.value?.id, (id) => {
  values.value = {}
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
@media (max-width: 1100px) { .stat-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
</style>
