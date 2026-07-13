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
    :operation-width="170"
    :delete-confirm-msg="(row: any) => `确认删除实例「${row.name}」？`"
    :delete-request="remove"
    @search="search"
    @reset="reset"
    @page-change="load"
  >
    <template #toolbar>
      <el-button v-permission="'instance:add'" type="primary" :icon="Plus" :disabled="dbTypeLoadError" @click="openCreate">新增实例</el-button>
    </template>

    <template #search>
      <el-form-item label="关键词">
        <el-input v-model="query.keyword" placeholder="按名称 / 主机搜索" clearable style="width: 220px">
          <template #prefix><el-icon><Search /></el-icon></template>
        </el-input>
      </el-form-item>
      <el-form-item label="数据库类型">
        <el-select v-model="query.dbTypeId" placeholder="数据库类型" clearable style="width: 140px">
          <el-option v-for="t in dbTypeOptions" :key="t.id" :label="t.label" :value="t.id" />
        </el-select>
      </el-form-item>
      <el-form-item label="所属分组">
        <el-select v-model="query.groupId" placeholder="所属分组" clearable style="width: 150px">
          <el-option v-for="g in groups" :key="g.id" :label="g.name" :value="g.id!" />
        </el-select>
      </el-form-item>
      <el-form-item label="状态">
        <el-select v-model="query.status" placeholder="状态" clearable style="width: 110px">
          <el-option v-for="s in STATUS_OPTIONS" :key="s.value" :label="s.label" :value="s.value" />
        </el-select>
      </el-form-item>
    </template>

    <template #col-typeVersion="{ row }">
      <el-tag size="small" effect="plain">{{ row.dbType }} {{ row.dbVersion }}</el-tag>
    </template>

    <template #col-host="{ row }">{{ row.host }}:{{ row.port }}</template>

    <template #col-groups="{ row }">
      <el-tag
        v-for="gid in row.groupIds"
        :key="gid"
        size="small"
        effect="plain"
        style="margin-right: 4px"
      >{{ groupName(gid) }}</el-tag>
    </template>

    <template #col-owner="{ row }">
      <div><el-tag size="small" type="info" effect="plain">A {{ userName(row.ownerAId) }}</el-tag></div>
      <div style="margin-top: 2px"><el-tag size="small" type="info" effect="plain">B {{ userName(row.ownerBId) }}</el-tag></div>
    </template>

    <template #col-health="{ row }">
      <HealthGauge :value="row.health" :size="48" :stroke="5" :show-label="false" />
    </template>

    <template #col-status="{ row }">
      <el-tag
        :type="statusType(row.status)"
        :effect="row.status === 'paused' ? 'dark' : 'light'"
        size="small"
      >{{ statusLabel(row.status) }}</el-tag>
    </template>

    <template #operation="{ row, confirmDelete }">
      <el-button v-permission="'instance:edit'" link type="primary" size="small" @click="openEdit(row as DbInstance)">编辑</el-button>
      <el-button
        v-permission="'instance:edit'"
        link
        :type="row.status === 'paused' ? 'success' : 'warning'"
        size="small"
        @click="toggleStatus(row as DbInstance)"
      >{{ row.status === 'paused' ? '恢复采样' : '暂停采样' }}</el-button>
      <el-button v-permission="'instance:delete'" link type="danger" size="small" @click="confirmDelete(row as DbInstance)">删除</el-button>
    </template>
  </ProTable>

  <CrudDrawer
    ref="drawerRef"
    :visible="dialogVisible"
    type="drawer"
    :mode="form.id ? 'edit' : 'create'"
    title="实例"
    size="560px"
    :form-ref="formRef"
    :confirm-on-save="false"
    @update:visible="dialogVisible = $event"
    @save="onDrawerSave"
  >
    <template #default>
      <el-alert v-if="dbTypeLoadError" title="数据库类型加载失败，请恢复网络或刷新页面后重试" type="error" :closable="false" show-icon class="mb-4" />
      <el-form ref="formRef" :model="form" :rules="rules" label-width="100px">
      <el-form-item label="实例名称" prop="name">
        <el-input v-model="form.name" placeholder="如 mysql-prod-01" />
      </el-form-item>
      <el-form-item label="数据库类型" prop="dbTypeId">
        <el-select v-model="form.dbTypeId" style="width: 100%" :disabled="!!form.id" @change="onDbTypeChange">
          <el-option v-for="t in dbTypeOptions" :key="t.id" :label="t.label" :value="t.id" />
        </el-select>
      </el-form-item>
      <el-form-item label="版本" prop="dbVersionId">
        <el-select v-model="form.dbVersionId" style="width: 100%" :disabled="!!form.id">
          <el-option
            v-for="v in versionOptions"
            :key="v.id"
            :label="v.deprecated ? `${v.label}（已弃用）` : v.label"
            :value="v.id"
          />
        </el-select>
      </el-form-item>
      <el-form-item label="主机地址" prop="host">
        <el-input v-model="form.host" placeholder="IP / 域名" />
      </el-form-item>
      <el-form-item label="端口" prop="port">
        <el-input-number v-model="form.port" :min="1" :max="65535" controls-position="right" style="width: 100%" />
      </el-form-item>
      <el-form-item label="采集账号">
        <el-input v-model="form.connUser" placeholder="只读监控账号" />
      </el-form-item>
      <el-form-item label="采集密码">
        <el-input v-model="form.connPassword" type="password" show-password :placeholder="form.id ? '留空则不修改' : '采集账号密码'" />
      </el-form-item>
      <el-form-item label="数据库名称">
        <el-input
          v-model="form.databaseName"
          placeholder="可选，如 mydb；填写后采集建连时替换 URL 中的 {database}"
        />
      </el-form-item>
      <el-form-item label="所在主机">
        <el-select
          v-model="form.hostId"
          filterable
          clearable
          style="width: 100%"
          placeholder="可选；关联后可查看该实例的 CPU / 内存 / 磁盘等主机指标"
        >
          <el-option
            v-for="h in hostOptions"
            :key="h.id"
            :label="`${h.name}（${h.ip}${h.osType === 'windows' ? ' · Windows' : ' · Linux'}）`"
            :value="h.id"
          />
        </el-select>
      </el-form-item>
      <el-form-item label="连接测试">
        <div class="conn-test-block">
          <div>
            <el-button :loading="testing" @click="testConnection">测试连接</el-button>
            <span v-if="testResult" :class="['conn-result', testOk ? 'ok' : 'fail']">{{ testResult }}</span>
          </div>
          <!-- 采集账号权限逐项检测结果：缺失项标黄并给出受影响能力与补齐 SQL -->
          <div v-if="permChecks.length" class="perm-check-list">
            <div v-for="c in permChecks" :key="c.name" class="perm-check-item">
              <el-tag
                :type="c.granted === true ? 'success' : c.granted === false ? 'warning' : 'info'"
                size="small"
                effect="plain"
              >
                {{ c.granted === true ? '✓' : c.granted === false ? '缺失' : '未知' }}
              </el-tag>
              <span class="perm-name">{{ c.name }}</span>
              <template v-if="c.granted !== true">
                <span class="perm-affected">影响：{{ c.affected }}</span>
                <el-tooltip v-if="c.grantHint" placement="top" :content="c.grantHint">
                  <el-link type="primary" :underline="false" class="perm-hint">补齐方法</el-link>
                </el-tooltip>
              </template>
            </div>
          </div>
        </div>
      </el-form-item>
      <el-form-item label="所属分组" prop="groupIds">
        <el-select v-model="form.groupIds" multiple filterable style="width: 100%" placeholder="可多选">
          <el-option v-for="g in groups" :key="g.id" :label="g.name" :value="g.id!" />
        </el-select>
      </el-form-item>
      <el-form-item label="负责人A" prop="ownerAId">
        <el-select
          v-model="form.ownerAId"
          filterable
          clearable
          style="width: 100%"
          placeholder="主负责人"
          @change="onOwnerAChange"
        >
          <el-option v-for="u in ownerAOptions" :key="u.id" :label="userLabel(u)" :value="u.id!" />
        </el-select>
      </el-form-item>
      <el-form-item label="负责人B">
        <el-select
          v-model="form.ownerBId"
          filterable
          clearable
          style="width: 100%"
          placeholder="备份负责人（可选）"
        >
          <el-option v-for="u in ownerBOptions" :key="u.id" :label="userLabel(u)" :value="u.id!" />
        </el-select>
      </el-form-item>
      <el-form-item label="来源白名单">
        <el-input
          v-model="whitelistText"
          type="textarea"
          :rows="3"
          placeholder="连接来源白名单（可选），每行一个 IP 或前缀通配，如：&#10;192.168.1.10&#10;10.0.1.*&#10;配置后将监测白名单外的连接来源并告警；留空 = 不启用"
        />
      </el-form-item>
      <el-form-item label="备注">
        <el-input v-model="form.remark" type="textarea" :rows="2" placeholder="备注信息（可选）" />
      </el-form-item>
      </el-form>
    </template>
  </CrudDrawer>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from 'element-plus'
import { Search, Plus } from '@element-plus/icons-vue'
import ProTable from '@/components/ProTable/index.vue'
import type { TableColumn } from '@/components/ProTable/types'
import { CrudDrawer } from '@/components/ProTable'
import HealthGauge from '@/components/HealthGauge.vue'
import {
  pageInstances,
  createInstance,
  updateInstance,
  deleteInstance,
  toggleInstance,
  testInstanceConnection,
  type InstanceQuery,
  type PermissionCheck
} from '@/api/instance'
import { listGroups } from '@/api/group'
import { listHostOptions, type HostOption } from '@/api/host'
import { listUserOptions } from '@/api/user'
import { listDbTypes } from '@/api/meta'
import { listDictItems } from '@/api/dict'
import { usePagination } from '@/composables/usePagination'
import type { DbInstance, DbTypeOption, DbVersionOption, InstanceGroup, UserOption } from '@/types'

const columns: TableColumn[] = [
  { prop: 'name', label: '实例名称', minWidth: 170, fixed: 'left' },
  { label: '类型/版本', width: 140, slot: 'col-typeVersion', showOverflowTooltip: false },
  { label: '主机', minWidth: 160, slot: 'col-host', showOverflowTooltip: false },
  { label: '所属分组', minWidth: 180, slot: 'col-groups', showOverflowTooltip: false },
  { label: '负责人', width: 150, slot: 'col-owner', showOverflowTooltip: false },
  { label: '健康分', width: 100, align: 'center', slot: 'col-health', showOverflowTooltip: false },
  { label: '状态', width: 100, align: 'center', slot: 'col-status', showOverflowTooltip: false },
  { prop: 'remark', label: '备注', minWidth: 140 },
]

const dbTypeOptions = ref<DbTypeOption[]>([])
const dbTypeLoadError = ref(false)
function typeOptionById(id?: number | null) {
  return id == null ? undefined : dbTypeOptions.value.find((t) => t.id === id)
}

type InstanceStatus = DbInstance['status']
type TagType = 'success' | 'warning' | 'danger' | 'info' | 'primary'
const FALLBACK_STATUS: { value: string; label: string; tagType: TagType }[] = [
  { value: 'normal', label: '正常', tagType: 'success' },
  { value: 'abnormal', label: '异常', tagType: 'danger' },
  { value: 'paused', label: '暂停', tagType: 'info' }
]
const statusItems = ref<{ value: string; label: string; tagType: TagType }[]>([...FALLBACK_STATUS])
const STATUS_OPTIONS = computed(() => statusItems.value.map((s) => ({ value: s.value, label: s.label })))
function statusMeta(s: string) {
  return statusItems.value.find((x) => x.value === s)
}
function statusType(s: InstanceStatus): TagType {
  return statusMeta(s)?.tagType || 'info'
}
function statusLabel(s: InstanceStatus): string {
  return statusMeta(s)?.label || s
}

async function loadStatusDict() {
  try {
    const rows = await listDictItems('instance_status')
    if (rows.length) {
      statusItems.value = rows.map((r) => ({
        value: r.itemValue,
        label: r.itemLabel,
        tagType: (r.tagType || 'info') as TagType
      }))
    }
  } catch {
    // 字典读取失败时保留内置兜底
  }
}

const groups = ref<InstanceGroup[]>([])
const users = ref<UserOption[]>([])
const hostOptions = ref<HostOption[]>([])

function userLabel(u: UserOption) {
  return u.name
}
function userName(id?: number | null) {
  if (id == null) return '-'
  const u = users.value.find((x) => x.id === id)
  return u ? userLabel(u) : `#${id}`
}
const ownerAOptions = computed(() => users.value.filter((u) => u.id !== form.ownerBId))
const ownerBOptions = computed(() => users.value.filter((u) => u.id !== form.ownerAId))
function onOwnerAChange() {
  if (form.ownerAId != null && form.ownerBId === form.ownerAId) form.ownerBId = null
}

const { query, list, total, loading, load, search } = usePagination<DbInstance, InstanceQuery>(
  (q) => pageInstances(q),
  { keyword: '' }
)

function groupName(id: number) {
  return groups.value.find((g) => g.id === id)?.name || `#${id}`
}

function reset() {
  query.keyword = ''
  query.dbTypeId = undefined
  query.groupId = undefined
  query.status = undefined
  search()
}

// ===== 新增 / 编辑 =====
const dialogVisible = ref(false)
const drawerRef = ref<{ stopSaving: (close?: boolean) => void } | null>(null)
const formRef = ref<FormInstance>()
const form = reactive<DbInstance>(emptyForm())

function emptyForm(): DbInstance {
  return {
    id: 0,
    name: '',
    host: '',
    port: 3306,
    dbTypeId: null,
    dbVersionId: null,
    remark: '',
    groupIds: [],
    ownerAId: null,
    ownerBId: null,
    connUser: '',
    connPassword: '',
    databaseName: '',
    hostId: null,
    health: 0,
    status: 'normal',
    connSourceWhitelist: []
  }
}

// 来源白名单：textarea（每行一条）↔ 数组 双向映射
const whitelistText = computed({
  get: () => (form.connSourceWhitelist ?? []).join('\n'),
  set: (v: string) => {
    form.connSourceWhitelist = v.split('\n').map(s => s.trim()).filter(Boolean)
  }
})

const versionOptions = computed<DbVersionOption[]>(() => typeOptionById(form.dbTypeId)?.versions ?? [])

const rules: FormRules<DbInstance> = {
  name: [{ required: true, message: '请输入实例名称', trigger: 'blur' }],
  dbTypeId: [{ required: true, message: '请选择数据库类型', trigger: 'change' }],
  dbVersionId: [{ required: true, message: '请选择版本', trigger: 'change' }],
  host: [{ required: true, message: '请输入主机地址', trigger: 'blur' }],
  port: [{ required: true, message: '请输入端口', trigger: 'blur' }],
  groupIds: [{ required: true, type: 'array', min: 1, message: '请至少选择一个分组', trigger: 'change' }],
  ownerAId: [{ required: true, message: '请选择负责人A', trigger: 'change' }]
}

function onDbTypeChange() {
  const opt = typeOptionById(form.dbTypeId)
  form.dbVersionId = opt?.versions?.[0]?.id ?? null
  if (opt?.defaultPort) form.port = opt.defaultPort
}

// ===== 连接测试 =====
const testing = ref(false)
const testResult = ref('')
const testOk = ref(false)
const permChecks = ref<PermissionCheck[]>([])

async function testConnection() {
  if (!form.host || !form.port) {
    ElMessage.warning('请先填写主机地址和端口')
    return
  }
  const typeCode = form.id ? undefined : typeOptionById(form.dbTypeId)?.code
  if (!form.id && !typeCode) {
    ElMessage.warning('请先选择数据库类型')
    return
  }
  testing.value = true
  testResult.value = ''
  permChecks.value = []
  try {
    const result = await testInstanceConnection({
      instanceId: form.id || undefined,
      dbType: typeCode,
      host: form.host,
      port: form.port,
      // PostgreSQL 建连必须指定库：优先用表单填写的监控库
      databaseName: form.databaseName || undefined,
      connUser: form.connUser,
      connPassword: form.connPassword
    })
    testOk.value = true
    testResult.value = `连接成功，版本：${result.version}`
    permChecks.value = result.checks ?? []
    const missing = permChecks.value.filter(c => c.granted === false)
    if (missing.length) {
      ElMessage.warning(`连接成功，但采集账号缺少 ${missing.length} 项权限，部分监控能力将受限`)
    } else {
      ElMessage.success('连接成功')
    }
  } catch (e) {
    testOk.value = false
    testResult.value = `连接失败：${(e as Error)?.message || '无法连接'}`
  } finally {
    testing.value = false
  }
}

function openCreate() {
  if (dbTypeLoadError.value || !dbTypeOptions.value.length) {
    ElMessage.error('数据库类型加载失败，暂不能新增实例')
    return
  }
  Object.assign(form, emptyForm())
  form.id = 0
  const first = dbTypeOptions.value[0]
  if (first) {
    form.dbTypeId = first.id
    form.dbVersionId = first.versions?.[0]?.id ?? null
    if (first.defaultPort) form.port = first.defaultPort
  }
  testResult.value = ''
  permChecks.value = []
  dialogVisible.value = true
}

function openEdit(row: DbInstance) {
  Object.assign(form, {
    ...row,
    connPassword: '',
    groupIds: [...(row.groupIds || [])],
    connSourceWhitelist: [...(row.connSourceWhitelist || [])]
  })
  testResult.value = ''
  permChecks.value = []
  dialogVisible.value = true
}

async function onDrawerSave() {
  if (dbTypeLoadError.value || !dbTypeOptions.value.length) {
    drawerRef.value?.stopSaving(false)
    ElMessage.error('数据库类型加载失败，暂不能保存实例')
    return
  }
  try {
    const payload = { ...form }
    if (form.id) {
      delete (payload as Partial<DbInstance>).dbTypeId
      delete (payload as Partial<DbInstance>).dbVersionId
      delete (payload as Partial<DbInstance>).dbType
      delete (payload as Partial<DbInstance>).dbVersion
      await updateInstance(payload)
    } else {
      delete (payload as Partial<DbInstance>).id
      await createInstance(payload)
    }
    ElMessage.success('保存成功')
    drawerRef.value?.stopSaving(true)
    load()
  } catch {
    drawerRef.value?.stopSaving(false)
    ElMessage.error('保存失败，请稍后重试')
  }
}

async function toggleStatus(row: DbInstance) {
  const resume = row.status === 'paused'
  const action = resume ? '恢复采样' : '暂停采样'
  try {
    await ElMessageBox.confirm(
      `确认${action}实例「${row.name}」？${resume ? '' : '暂停后将不再采集该实例。'}`,
      `${action}确认`,
      { type: 'warning' }
    )
  } catch {
    return
  }
  await toggleInstance(row.id, resume ? 'normal' : 'paused')
  ElMessage.success(`${action}成功`)
  load()
}

async function remove(row: DbInstance) {
  await deleteInstance(row.id)
  load()
}

async function loadDbTypes() {
  try {
    const types = await listDbTypes()
    dbTypeOptions.value = types
    dbTypeLoadError.value = !types.length
  } catch {
    dbTypeOptions.value = []
    dbTypeLoadError.value = true
  }
}

async function loadHostOptions() {
  try {
    hostOptions.value = await listHostOptions()
  } catch {
    hostOptions.value = []
  }
}

onMounted(async () => {
  loadStatusDict()
  loadDbTypes()
  loadHostOptions()
  groups.value = await listGroups()
  users.value = await listUserOptions()
  load()
})
</script>

<style scoped>
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

.conn-test-block {
  display: flex;
  flex-direction: column;
  gap: 6px;
  width: 100%;
}

.perm-check-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 8px 10px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 6px;
  background: var(--el-fill-color-lighter);
}

.perm-check-item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  line-height: 20px;
}

.perm-name {
  color: var(--el-text-color-primary);
}

.perm-affected {
  color: var(--el-text-color-secondary);
}

.perm-hint {
  font-size: 12px;
}
</style>
