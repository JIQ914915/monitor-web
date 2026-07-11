<template>
  <div>
  <ProTable
    :data="list"
    :columns="columns"
    :loading="loading"
    :total="total"
    v-model:page-num="query.pageNum"
    v-model:page-size="query.pageSize"
    :show-add="false"
    :operation-width="200"
    :delete-confirm-msg="(row: any) => `确认删除主机「${row.name}」？`"
    :delete-request="remove"
    @search="search"
    @reset="reset"
    @page-change="load"
  >
    <template #toolbar>
      <el-button v-permission="'host:add'" type="primary" :icon="Plus" @click="openCreate">新增主机</el-button>
    </template>

    <template #search>
      <el-form-item label="关键词">
        <el-input v-model="query.keyword" placeholder="按名称 / IP 搜索" clearable style="width: 220px">
          <template #prefix><el-icon><Search /></el-icon></template>
        </el-input>
      </el-form-item>
      <el-form-item label="采集方式">
        <el-select v-model="query.collectMode" placeholder="采集方式" clearable style="width: 150px">
          <el-option v-for="m in modeItems" :key="m.value" :label="m.label" :value="m.value" />
        </el-select>
      </el-form-item>
      <el-form-item label="状态">
        <el-select v-model="query.status" placeholder="状态" clearable style="width: 110px">
          <el-option v-for="s in statusItems" :key="s.value" :label="s.label" :value="s.value" />
        </el-select>
      </el-form-item>
    </template>

    <template #col-osType="{ row }">
      <el-tag size="small" effect="plain" :type="osType(row.osType)">{{ osLabel(row.osType) }}</el-tag>
    </template>

    <template #col-endpoint="{ row }">
      <span v-if="row.collectMode === 'exporter'">{{ row.ip }}:{{ row.exporterPort }}</span>
      <span v-else>{{ row.ip }}</span>
    </template>

    <template #col-collectMode="{ row }">
      <el-tag size="small" effect="plain" :type="modeType(row.collectMode)">{{ modeLabel(row.collectMode) }}</el-tag>
    </template>

    <template #col-instanceCount="{ row }">
      <el-tag v-if="row.instanceCount" size="small" effect="plain">{{ row.instanceCount }} 个</el-tag>
      <el-tooltip v-else content="未关联实例时不采集该主机指标，请在实例管理中为实例选择所在主机" placement="top">
        <el-tag size="small" type="warning" effect="plain">未关联</el-tag>
      </el-tooltip>
    </template>

    <template #col-status="{ row }">
      <el-tag :type="statusType(row.status)" :effect="row.status === 'paused' ? 'dark' : 'light'" size="small">
        {{ statusLabel(row.status) }}
      </el-tag>
    </template>

    <template #operation="{ row, confirmDelete }">
      <el-button v-permission="'host:test'" link type="primary" size="small" :loading="rowTesting === row.id" @click="testRow(row as MonitorHost)">测试</el-button>
      <el-button v-permission="'host:edit'" link type="primary" size="small" @click="openEdit(row as MonitorHost)">编辑</el-button>
      <el-button
        v-permission="'host:edit'"
        link
        :type="row.status === 'paused' ? 'success' : 'warning'"
        size="small"
        @click="toggleStatus(row as MonitorHost)"
      >{{ row.status === 'paused' ? '恢复采集' : '暂停采集' }}</el-button>
      <el-button v-permission="'host:delete'" link type="danger" size="small" @click="confirmDelete(row as MonitorHost)">删除</el-button>
    </template>
  </ProTable>

  <CrudDrawer
    ref="drawerRef"
    :visible="dialogVisible"
    type="drawer"
    :mode="form.id ? 'edit' : 'create'"
    title="主机"
    size="560px"
    :form-ref="formRef"
    :confirm-on-save="false"
    @update:visible="dialogVisible = $event"
    @save="onDrawerSave"
  >
    <template #default>
      <el-form ref="formRef" :model="form" :rules="rules" label-width="100px">
      <el-form-item label="主机名称" prop="name">
        <el-input v-model="form.name" placeholder="如 生产库主机-01" />
      </el-form-item>
      <el-form-item label="主机 IP" prop="ip">
        <el-input v-model="form.ip" placeholder="IP / 域名" />
      </el-form-item>
      <el-form-item label="操作系统" prop="osType">
        <el-radio-group v-model="form.osType">
          <el-radio-button v-for="o in osItems" :key="o.value" :value="o.value">{{ o.label }}</el-radio-button>
        </el-radio-group>
        <div class="form-tip">
          Linux 主机部署 node_exporter，Windows 主机部署 windows_exporter；类型决定主机资源页的展示口径
        </div>
      </el-form-item>
      <el-form-item label="采集方式" prop="collectMode">
        <el-select v-model="form.collectMode" style="width: 100%">
          <el-option v-for="m in modeItems" :key="m.value" :label="m.label" :value="m.value" :disabled="m.value === 'ssh'" />
        </el-select>
        <div class="form-tip">
          Exporter 拉取：在主机上部署 node_exporter 后由平台定时拉取指标（推荐）；SSH 免 Agent 方式将在后续版本提供
        </div>
      </el-form-item>
      <template v-if="form.collectMode === 'exporter'">
        <el-form-item label="Exporter 端口" prop="exporterPort">
          <el-input-number v-model="form.exporterPort" :min="1" :max="65535" controls-position="right" style="width: 100%" />
        </el-form-item>
        <el-form-item label="指标路径">
          <el-input v-model="form.exporterPath" placeholder="/metrics" />
        </el-form-item>
        <el-form-item label="连通性测试">
          <el-button :loading="testing" @click="testConnection">测试连接</el-button>
          <span v-if="testResult" :class="['conn-result', testOk ? 'ok' : 'fail']">{{ testResult }}</span>
        </el-form-item>
      </template>
      <el-form-item label="备注">
        <el-input v-model="form.remark" type="textarea" :rows="2" placeholder="备注信息（可选）" />
      </el-form-item>
      </el-form>
    </template>
  </CrudDrawer>
  </div>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from 'element-plus'
import { Search, Plus } from '@element-plus/icons-vue'
import ProTable from '@/components/ProTable/index.vue'
import type { TableColumn } from '@/components/ProTable/types'
import { CrudDrawer } from '@/components/ProTable'
import {
  pageHosts,
  createHost,
  updateHost,
  deleteHost,
  toggleHost,
  testHostConnection,
  type HostQuery,
  type MonitorHost
} from '@/api/host'
import { listDictItems } from '@/api/dict'
import { usePagination } from '@/composables/usePagination'

const columns: TableColumn[] = [
  { prop: 'name', label: '主机名称', minWidth: 160, fixed: 'left' },
  { label: '操作系统', width: 110, align: 'center', slot: 'col-osType', showOverflowTooltip: false },
  { label: '采集地址', minWidth: 160, slot: 'col-endpoint', showOverflowTooltip: false },
  { label: '采集方式', width: 130, slot: 'col-collectMode', showOverflowTooltip: false },
  { label: '关联实例', width: 100, align: 'center', slot: 'col-instanceCount', showOverflowTooltip: false },
  { label: '状态', width: 100, align: 'center', slot: 'col-status', showOverflowTooltip: false },
  { prop: 'remark', label: '备注', minWidth: 140 },
]

type TagType = 'success' | 'warning' | 'danger' | 'info' | 'primary'
interface DictOption { value: string; label: string; tagType: TagType }

const FALLBACK_STATUS: DictOption[] = [
  { value: 'normal', label: '正常', tagType: 'success' },
  { value: 'abnormal', label: '异常', tagType: 'danger' },
  { value: 'paused', label: '已暂停', tagType: 'info' }
]
const FALLBACK_MODE: DictOption[] = [
  { value: 'exporter', label: 'Exporter 拉取', tagType: 'primary' },
  { value: 'ssh', label: 'SSH 免 Agent', tagType: 'warning' },
  { value: 'none', label: '不采集', tagType: 'info' }
]
const FALLBACK_OS: DictOption[] = [
  { value: 'linux', label: 'Linux', tagType: 'primary' },
  { value: 'windows', label: 'Windows', tagType: 'success' }
]
const statusItems = ref<DictOption[]>([...FALLBACK_STATUS])
const modeItems = ref<DictOption[]>([...FALLBACK_MODE])
const osItems = ref<DictOption[]>([...FALLBACK_OS])

function statusType(s: string): TagType {
  return statusItems.value.find((x) => x.value === s)?.tagType || 'info'
}
function statusLabel(s: string): string {
  return statusItems.value.find((x) => x.value === s)?.label || s
}
function modeType(m: string): TagType {
  return modeItems.value.find((x) => x.value === m)?.tagType || 'info'
}
function modeLabel(m: string): string {
  return modeItems.value.find((x) => x.value === m)?.label || m
}
function osType(o?: string): TagType {
  return osItems.value.find((x) => x.value === o)?.tagType || 'info'
}
function osLabel(o?: string): string {
  return osItems.value.find((x) => x.value === o)?.label || o || 'Linux'
}

async function loadDicts() {
  try {
    const [statusRows, modeRows, osRows] = await Promise.all([
      listDictItems('host_status'),
      listDictItems('host_collect_mode'),
      listDictItems('host_os_type')
    ])
    if (statusRows.length) {
      statusItems.value = statusRows.map((r) => ({
        value: r.itemValue, label: r.itemLabel, tagType: (r.tagType || 'info') as TagType
      }))
    }
    if (modeRows.length) {
      modeItems.value = modeRows.map((r) => ({
        value: r.itemValue, label: r.itemLabel, tagType: (r.tagType || 'info') as TagType
      }))
    }
    if (osRows.length) {
      osItems.value = osRows.map((r) => ({
        value: r.itemValue, label: r.itemLabel, tagType: (r.tagType || 'info') as TagType
      }))
    }
  } catch {
    // 字典读取失败时保留内置兜底
  }
}

const { query, list, total, loading, load, search } = usePagination<MonitorHost, HostQuery>(
  (q) => pageHosts(q),
  { keyword: '' }
)

function reset() {
  query.keyword = ''
  query.status = undefined
  query.collectMode = undefined
  search()
}

// ===== 新增 / 编辑 =====
const dialogVisible = ref(false)
const drawerRef = ref<{ stopSaving: (close?: boolean) => void } | null>(null)
const formRef = ref<FormInstance>()
const form = reactive<MonitorHost>(emptyForm())

function emptyForm(): MonitorHost {
  return {
    id: 0,
    name: '',
    ip: '',
    osType: 'linux',
    collectMode: 'exporter',
    exporterPort: 9100,
    exporterPath: '/metrics',
    remark: '',
    status: 'normal'
  }
}

const rules: FormRules<MonitorHost> = {
  name: [{ required: true, message: '请输入主机名称', trigger: 'blur' }],
  ip: [{ required: true, message: '请输入主机 IP / 域名', trigger: 'blur' }],
  osType: [{ required: true, message: '请选择操作系统类型', trigger: 'change' }],
  collectMode: [{ required: true, message: '请选择采集方式', trigger: 'change' }],
  exporterPort: [{ required: true, message: '请输入 exporter 端口', trigger: 'blur' }]
}

function openCreate() {
  Object.assign(form, emptyForm())
  form.id = 0
  testResult.value = ''
  dialogVisible.value = true
}

function openEdit(row: MonitorHost) {
  Object.assign(form, { ...row })
  if (!form.osType) form.osType = 'linux'
  testResult.value = ''
  dialogVisible.value = true
}

async function onDrawerSave() {
  try {
    const payload = { ...form }
    if (form.id) await updateHost(payload)
    else {
      delete (payload as Partial<MonitorHost>).id
      await createHost(payload)
    }
    ElMessage.success('保存成功')
    drawerRef.value?.stopSaving(true)
    load()
  } catch {
    drawerRef.value?.stopSaving(false)
    ElMessage.error('保存失败，请稍后重试')
  }
}

// ===== 连通性测试 =====
const testing = ref(false)
const testResult = ref('')
const testOk = ref(false)
const rowTesting = ref<number | null>(null)

async function testConnection() {
  if (!form.ip) {
    ElMessage.warning('请先填写主机 IP')
    return
  }
  testing.value = true
  testResult.value = ''
  try {
    const detail = await testHostConnection({
      ip: form.ip,
      exporterPort: form.exporterPort,
      exporterPath: form.exporterPath,
      osType: form.osType
    })
    testOk.value = true
    testResult.value = `连接成功：${detail}`
    ElMessage.success('连接成功')
  } catch (e) {
    testOk.value = false
    testResult.value = (e as Error)?.message || '连接失败'
  } finally {
    testing.value = false
  }
}

async function testRow(row: MonitorHost) {
  rowTesting.value = row.id!
  try {
    const detail = await testHostConnection({
      ip: row.ip,
      exporterPort: row.exporterPort,
      exporterPath: row.exporterPath,
      osType: row.osType
    })
    ElMessage.success(`「${row.name}」连接成功：${detail}`)
  } catch (e) {
    ElMessage.error(`「${row.name}」${(e as Error)?.message || '连接失败'}`)
  } finally {
    rowTesting.value = null
  }
}

async function toggleStatus(row: MonitorHost) {
  const resume = row.status === 'paused'
  const action = resume ? '恢复采集' : '暂停采集'
  try {
    await ElMessageBox.confirm(
      `确认${action}主机「${row.name}」？${resume ? '' : '暂停后将不再采集该主机指标。'}`,
      `${action}确认`,
      { type: 'warning' }
    )
  } catch {
    return
  }
  await toggleHost(row.id!, resume ? 'normal' : 'paused')
  ElMessage.success(`${action}成功`)
  load()
}

async function remove(row: MonitorHost) {
  await deleteHost(row.id!)
  load()
}

onMounted(() => {
  loadDicts()
  load()
})
</script>

<style scoped>
.form-tip {
  font-size: 12px;
  color: var(--el-text-color-secondary, #909399);
  line-height: 1.5;
  margin-top: 4px;
}
.conn-result {
  margin-left: 12px;
  font-size: 13px;
  word-break: break-all;
}
.conn-result.ok {
  color: var(--el-color-success, #67c23a);
}
.conn-result.fail {
  color: var(--el-color-danger, #f56c6c);
}
</style>
