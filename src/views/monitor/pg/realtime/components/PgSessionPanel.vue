<template>
  <el-card shadow="never" class="diagnostic-card">
    <template #header><div class="header"><span>实时会话与阻塞诊断</span><el-button size="small" :loading="loading" @click="loadAll">刷新现场</el-button></div></template>
    <el-tabs v-model="tab">
      <el-tab-pane label="实时会话" name="sessions">
        <el-form :inline="true" :model="filters" class="filters">
          <el-form-item label="数据库"><el-input v-model="filters.database" clearable /></el-form-item>
          <el-form-item label="用户"><el-input v-model="filters.user" clearable /></el-form-item>
          <el-form-item label="状态"><el-input v-model="filters.state" clearable /></el-form-item>
          <el-form-item label="等待类型"><el-input v-model="filters.waitEventType" clearable /></el-form-item>
          <el-form-item><el-button type="primary" @click="loadSessions">查询</el-button></el-form-item>
        </el-form>
        <el-table :data="sessions" v-loading="loading" max-height="460" stripe>
          <el-table-column prop="pid" label="PID" width="90" fixed />
          <el-table-column prop="database" label="数据库" min-width="110" />
          <el-table-column prop="user" label="用户" min-width="100" />
          <el-table-column prop="application" label="应用" min-width="130" show-overflow-tooltip />
          <el-table-column prop="clientAddress" label="客户端" min-width="125" />
          <el-table-column prop="state" label="状态" width="130" />
          <el-table-column label="持续时间" width="100"><template #default="{ row }">{{ formatDuration(row.durationSeconds) }}</template></el-table-column>
          <el-table-column label="等待事件" min-width="150"><template #default="{ row }">{{ [row.waitEventType, row.waitEvent].filter(Boolean).join(':') || '—' }}</template></el-table-column>
          <el-table-column label="阻塞者" min-width="120"><template #default="{ row }"><el-tag v-if="row.rootBlocker" type="danger">根阻塞者</el-tag><span v-else>{{ row.blockedBy?.join(', ') || '—' }}</span></template></el-table-column>
          <el-table-column prop="query" label="SQL" min-width="320" show-overflow-tooltip />
          <el-table-column label="操作" width="260" fixed="right"><template #default="{ row }">
            <el-button link @click="copyText(String(row.pid), 'PID')">复制 PID</el-button>
            <el-button link :disabled="!row.query" @click="copyText(row.query || '', 'SQL')">复制 SQL</el-button>
            <el-button v-permission="'pg_session:cancel'" link type="warning" @click="act(row as PgSession, false)">取消</el-button>
            <el-button v-permission="'pg_session:terminate'" link type="danger" @click="act(row as PgSession, true)">终止</el-button>
          </template></el-table-column>
        </el-table>
      </el-tab-pane>
      <el-tab-pane :label="'阻塞树 (' + trees.length + ')'" name="blocking">
        <el-alert v-if="!trees.length" type="success" :closable="false" title="当前未检测到会话阻塞" />
        <el-table v-else :data="trees" row-key="pid" default-expand-all max-height="460">
          <el-table-column prop="pid" label="阻塞关系 / PID" width="180" />
          <el-table-column prop="database" label="数据库" width="110" />
          <el-table-column prop="user" label="用户" width="100" />
          <el-table-column prop="application" label="应用" min-width="130" show-overflow-tooltip />
          <el-table-column label="影响会话" width="100"><template #default="{ row }"><el-tag type="danger">{{ row.affectedSessions }}</el-tag></template></el-table-column>
          <el-table-column label="持续时间" width="100"><template #default="{ row }">{{ formatDuration(row.durationSeconds) }}</template></el-table-column>
          <el-table-column label="锁对象" min-width="180"><template #default="{ row }">{{ row.lockedObjects?.join(', ') || '—' }}</template></el-table-column>
          <el-table-column prop="query" label="SQL" min-width="360" show-overflow-tooltip />
        </el-table>
      </el-tab-pane>
      <el-tab-pane :label="'能力检测 (' + capabilities.length + ')'" name="capabilities">
        <el-table :data="capabilities" max-height="460">
          <el-table-column prop="name" label="能力" min-width="220" />
          <el-table-column label="状态" width="120"><template #default="{ row }"><DictTag dict="capability_status" :value="row.status" size="small" /></template></el-table-column>
          <el-table-column prop="message" label="检测结果与建议" min-width="420"><template #default="{ row }">{{ row.message || '已满足' }}</template></el-table-column>
        </el-table>
      </el-tab-pane>
      <el-tab-pane :label="'数据库覆盖 (' + databases.length + ')'" name="databases">
        <el-table :data="databases" max-height="420">
          <el-table-column prop="name" label="数据库" min-width="180" />
          <el-table-column label="容量" width="140"><template #default="{ row }">{{ formatBytes(row.sizeBytes) }}</template></el-table-column>
          <el-table-column label="允许连接" width="110"><template #default="{ row }"><el-tag :type="row.allowConnections ? 'success' : 'info'">{{ row.allowConnections ? '是' : '否' }}</el-tag></template></el-table-column>
          <el-table-column label="账号可连接" width="120"><template #default="{ row }"><el-tag :type="row.connectable ? 'success' : 'danger'">{{ row.connectable ? '是' : '否' }}</el-tag></template></el-table-column>
          <el-table-column label="对象采集范围" width="140"><template #default="{ row }"><el-tag :type="row.inScope ? 'primary' : 'info'">{{ row.inScope ? '已纳入' : '未纳入' }}</el-tag></template></el-table-column>
        </el-table>
      </el-tab-pane>
    </el-tabs>
  </el-card>
</template>

<script setup lang="ts">
import { reactive, ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { cancelPgSession, getPgBlockingTree, listPgDatabases, listPgSessions, terminatePgSession, type PgBlockingNode, type PgDatabase, type PgSession } from '@/api/postgresql'
import { getInstanceCapabilities, type InstanceCapability } from '@/api/instance'
import DictTag from '@/components/DictTag.vue'

const props = defineProps<{ instanceId: number }>()
const tab = ref('sessions')
const loading = ref(false)
const sessions = ref<PgSession[]>([])
const trees = ref<PgBlockingNode[]>([])
const databases = ref<PgDatabase[]>([])
const capabilities = ref<InstanceCapability[]>([])
const filters = reactive({ database: '', user: '', state: '', waitEventType: '' })

async function loadSessions() { sessions.value = await listPgSessions({ instanceId: props.instanceId, ...filters }) }
async function loadAll() {
  loading.value = true
  try {
    const [s, t, d, c] = await Promise.allSettled([listPgSessions({ instanceId: props.instanceId, ...filters }), getPgBlockingTree(props.instanceId), listPgDatabases(props.instanceId), getInstanceCapabilities(props.instanceId)])
    sessions.value = s.status === 'fulfilled' ? s.value : []
    trees.value = t.status === 'fulfilled' ? t.value : []
    databases.value = d.status === 'fulfilled' ? d.value : []
    capabilities.value = c.status === 'fulfilled' ? c.value : []
  } finally { loading.value = false }
}
async function act(row: PgSession, terminate: boolean) {
  const verb = terminate ? '终止会话' : '取消查询'
  const context = 'PID ' + row.pid + '；数据库 ' + (row.database || '—') + '；用户 ' + (row.user || '—') + '；应用 ' + (row.application || '—') + '；客户端 ' + (row.clientAddress || '—') + '；持续 ' + formatDuration(row.durationSeconds) + '。'
  if (terminate) {
    await ElMessageBox.confirm(context + ' 未提交事务将回滚，请再次确认业务影响。', '终止会话二次确认', { type: 'warning', confirmButtonText: '继续填写原因' })
  }
  const { value } = await ElMessageBox.prompt(context + (terminate ? ' 请填写终止原因。' : ' 数据库将尝试取消当前语句。'), verb, { inputPlaceholder: '请输入操作原因', inputValidator: v => !!v?.trim() || '操作原因不能为空', type: 'warning' })
  if (terminate) await terminatePgSession(props.instanceId, row.pid, value.trim())
  else await cancelPgSession(props.instanceId, row.pid, value.trim())
  ElMessage.success(verb + '请求已执行')
  await loadAll()
}
async function copyText(value: string, label: string) {
  await navigator.clipboard.writeText(value)
  ElMessage.success(label + ' 已复制')
}
function formatDuration(seconds: number) {
  if (seconds < 60) return seconds + 's'
  if (seconds < 3600) return Math.floor(seconds / 60) + 'm'
  return Math.floor(seconds / 3600) + 'h ' + Math.floor(seconds % 3600 / 60) + 'm'
}
function formatBytes(value: number) {
  if (value < 1024 ** 2) return (value / 1024).toFixed(1) + ' KB'
  if (value < 1024 ** 3) return (value / 1024 ** 2).toFixed(1) + ' MB'
  return (value / 1024 ** 3).toFixed(2) + ' GB'
}
watch(() => props.instanceId, loadAll, { immediate: true })
</script>

<style scoped>
.header { display: flex; align-items: center; justify-content: space-between; font-weight: 600; }
.filters :deep(.el-input) { width: 130px; }
</style>