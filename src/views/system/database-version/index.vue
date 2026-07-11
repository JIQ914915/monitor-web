<template>
  <div class="version-page">
    <div class="version-body">
      <!-- 左侧：数据库类型导航 -->
      <div class="type-nav">
        <div class="type-nav-head">
          <span>数据库类型</span>
          <el-button v-permission="'db_type:create'" link type="primary" :icon="Plus" @click="openTypeCreate">新增</el-button>
        </div>
        <el-scrollbar class="type-nav-scroll">
          <div
            v-for="t in typeOptions"
            :key="t.code"
            class="type-nav-item"
            :class="{ active: selectedDbType === t.code }"
            @click="selectType(t.code)"
          >
            <div class="type-nav-main">
              <span class="type-nav-label">{{ t.label }}</span>
              <span class="type-nav-code">{{ t.code }}</span>
            </div>
            <div class="type-nav-ops" @click.stop>
              <el-button v-permission="'db_type:update'" link type="primary" :icon="Edit" @click="openTypeEdit(t)" />
              <el-button v-permission="'db_type:delete'" link type="danger" :icon="Delete" @click="handleTypeDelete(t)" />
            </div>
          </div>
          <el-empty v-if="typeOptions.length === 0" description="无数据库类型" :image-size="50" />
        </el-scrollbar>
      </div>

      <!-- 右侧：版本列表 -->
      <div class="version-list">
        <!-- 标题行（单独一行） -->
        <div class="version-list-header">
          <span class="version-list-title">
            {{ selectedDbType ? `${selectedLabel} 版本配置` : '请选择左侧数据库类型' }}
          </span>
        </div>

        <ProTable
          :data="versions"
          :columns="versionColumns"
          :loading="listLoading"
          :show-pagination="false"
          :show-add="false"
          :operation-width="150"
          :delete-confirm-msg="(row: any) => `确认删除版本「${row.versionName ?? row.versionCode}」？`"
          :delete-request="handleDelete"
          @search="loadVersions"
          @edit="openEdit"
        >
          <template #toolbar>
            <el-button
              v-permission="'db_version:create'"
              type="primary"
              :icon="Plus"
              :disabled="!selectedDbType"
              @click="openCreate"
            >新增版本</el-button>
          </template>

        </ProTable>
      </div>
    </div>

    <!-- 新增/编辑抽屉 -->
    <CrudDrawer
      ref="drawerRef"
      :visible="drawerVisible"
      type="drawer"
      :mode="form.id ? 'edit' : 'create'"
      title="数据库版本"
      size="480px"
      :form-ref="formRef"
      :confirm-on-save="false"
      @update:visible="drawerVisible = $event"
      @save="submit"
      @closed="resetVersionForm"
    >
      <template #default>
        <el-form ref="formRef" :model="form" :rules="rules" label-width="96px">
        <el-form-item label="数据库类型" prop="dbType">
          <el-select v-model="form.dbType" placeholder="选择数据库类型" style="width: 100%" :disabled="!!form.id">
            <el-option v-for="t in typeOptions" :key="t.code" :value="t.code.toLowerCase()" :label="t.label" />
          </el-select>
        </el-form-item>
        <el-form-item label="版本编码" prop="versionCode">
          <el-input v-model="form.versionCode" placeholder="如 8.0" :disabled="!!form.id" />
        </el-form-item>
        <el-form-item label="版本名称">
          <el-input v-model="form.versionName" placeholder="如 MySQL 8.0（可选，留空自动生成）" />
        </el-form-item>
        <el-form-item label="排序">
          <el-input-number v-model="form.sortOrder" :min="0" controls-position="right" style="width: 100%" />
        </el-form-item>
        <el-form-item label="说明">
          <el-input v-model="form.description" type="textarea" :rows="2" placeholder="说明（可选）" />
        </el-form-item>
        </el-form>
      </template>
    </CrudDrawer>

    <!-- 类型新增/编辑抽屉 -->
    <CrudDrawer
      ref="typeDrawerRef"
      :visible="typeDrawerVisible"
      type="drawer"
      :mode="typeForm.id ? 'edit' : 'create'"
      title="数据库类型"
      size="520px"
      :form-ref="typeFormRef"
      :confirm-on-save="false"
      @update:visible="typeDrawerVisible = $event"
      @save="submitType"
      @closed="resetTypeForm"
    >
      <template #default>
        <el-form ref="typeFormRef" :model="typeForm" :rules="typeRules" label-width="110px">
        <el-form-item label="类型编码" prop="code">
          <el-input v-model="typeForm.code" placeholder="如 MYSQL（新增后建议不修改）" :disabled="!!typeForm.id" />
        </el-form-item>
        <el-form-item label="展示名" prop="label">
          <el-input v-model="typeForm.label" placeholder="如 MySQL" />
        </el-form-item>
        <el-form-item label="默认端口">
          <el-input-number v-model="typeForm.defaultPort" :min="1" :max="65535" controls-position="right" style="width: 100%" />
        </el-form-item>
        <el-form-item label="JDBC 驱动类">
          <el-input v-model="typeForm.driverClass" placeholder="如 com.mysql.cj.jdbc.Driver" />
        </el-form-item>
        <el-form-item label="URL 模板">
          <el-input
            v-model="typeForm.urlTemplate"
            type="textarea"
            :rows="6"
            placeholder="如 jdbc:mysql://{host}:{port}/{database}?useSSL=false"
          />
          <div class="form-hint">支持占位符：{host} {port} {database}</div>
        </el-form-item>
        <el-form-item label="采集器实现类">
          <el-input v-model="typeForm.collectorClass" placeholder="全限定类名（可选）" />
        </el-form-item>
        <el-form-item label="排序">
          <el-input-number v-model="typeForm.sortOrder" :min="0" controls-position="right" style="width: 100%" />
        </el-form-item>
        <el-form-item label="是否启用">
          <el-switch v-model="typeForm.enabled" />
        </el-form-item>
        <el-form-item label="说明">
          <el-input v-model="typeForm.description" type="textarea" :rows="2" placeholder="说明（可选）" />
        </el-form-item>
        </el-form>
      </template>
    </CrudDrawer>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from 'element-plus'
import { Plus, Edit, Delete } from '@element-plus/icons-vue'
import ProTable from '@/components/ProTable/index.vue'
import type { TableColumn } from '@/components/ProTable/types'
import { CrudDrawer } from '@/components/ProTable'
import {
  listDbTypesAdmin,
  createDbType,
  updateDbType,
  deleteDbType,
  listDbVersions,
  createDbVersion,
  updateDbVersion,
  deleteDbVersion
} from '@/api/db-type'
import type { DatabaseTypeMgmt, DatabaseVersionMgmt } from '@/types'

const versionColumns: TableColumn[] = [
  { prop: 'versionCode', label: '版本编码', width: 110 },
  { prop: 'versionName', label: '版本名称', minWidth: 200 },
  { prop: 'sortOrder', label: '排序', width: 70, align: 'center' },
  { prop: 'description', label: '说明', minWidth: 200 },
]

// ===== 左侧类型导航 =====
const typeOptions = ref<DatabaseTypeMgmt[]>([])
const selectedDbType = ref<string>('')

const selectedLabel = computed(
  () => typeOptions.value.find((t) => t.code === selectedDbType.value)?.label ?? selectedDbType.value
)

async function loadTypes() {
  const prevSelected = selectedDbType.value
  const list = await listDbTypesAdmin()
  typeOptions.value = list
  if (!list.length) {
    selectedDbType.value = ''
    versions.value = []
    return
  }
  if (prevSelected && list.some((t) => t.code === prevSelected)) {
    selectedDbType.value = prevSelected
  } else {
    selectedDbType.value = list[0].code ?? ''
  }
  loadVersions()
}

function selectType(code: string) {
  selectedDbType.value = code
  loadVersions()
}

// ===== 右侧版本列表 =====
const versions = ref<DatabaseVersionMgmt[]>([])
const listLoading = ref(false)

async function loadVersions() {
  if (!selectedDbType.value) return
  listLoading.value = true
  try {
    versions.value = await listDbVersions(selectedDbType.value.toLowerCase())
  } finally {
    listLoading.value = false
  }
}

// ===== 新增/编辑 =====
const drawerVisible = ref(false)
const drawerRef = ref<{ stopSaving: (close?: boolean) => void } | null>(null)
const formRef = ref<FormInstance>()
const form = reactive<DatabaseVersionMgmt>(emptyForm())

function emptyForm(): DatabaseVersionMgmt {
  return {
    id: undefined,
    dbType: selectedDbType.value?.toLowerCase() ?? '',
    versionCode: '',
    versionName: '',
    sortOrder: 0,
    description: ''
  }
}

const rules: FormRules = {
  dbType: [{ required: true, message: '请选择数据库类型', trigger: 'change' }],
  versionCode: [{ required: true, message: '请输入版本编码', trigger: 'blur' }]
}

function openCreate() {
  Object.assign(form, emptyForm())
  form.dbType = selectedDbType.value?.toLowerCase() ?? ''
  drawerVisible.value = true
}

function openEdit(row: DatabaseVersionMgmt) {
  Object.assign(form, { ...row })
  drawerVisible.value = true
}

function resetVersionForm() {
  Object.assign(form, emptyForm())
}

async function submit() {
  await formRef.value?.validate()
  try {
    if (form.id) {
      await updateDbVersion({ ...form })
    } else {
      await createDbVersion({ ...form })
    }
    ElMessage.success('保存成功')
    drawerRef.value?.stopSaving(true)
    loadVersions()
  } catch {
    drawerRef.value?.stopSaving(false)
    ElMessage.error('保存失败，请稍后重试')
  }
}

async function handleDelete(row: DatabaseVersionMgmt) {
  await deleteDbVersion(row.id!)
  loadVersions()
}

onMounted(loadTypes)

// ===== 类型管理 =====
const typeDrawerVisible = ref(false)
const typeDrawerRef = ref<{ stopSaving: (close?: boolean) => void } | null>(null)
const typeFormRef = ref<FormInstance>()
const typeForm = reactive<DatabaseTypeMgmt>(emptyTypeForm())

function emptyTypeForm(): DatabaseTypeMgmt {
  return {
    id: undefined,
    code: '',
    label: '',
    driverClass: '',
    urlTemplate: '',
    collectorClass: '',
    defaultPort: undefined,
    sortOrder: 0,
    enabled: true,
    description: ''
  }
}

const typeRules: FormRules = {
  code: [{ required: true, message: '请输入类型编码', trigger: 'blur' }],
  label: [{ required: true, message: '请输入展示名', trigger: 'blur' }]
}

function openTypeCreate() {
  Object.assign(typeForm, emptyTypeForm())
  typeDrawerVisible.value = true
}

function openTypeEdit(row: DatabaseTypeMgmt) {
  Object.assign(typeForm, { ...row })
  typeDrawerVisible.value = true
}

function resetTypeForm() {
  Object.assign(typeForm, emptyTypeForm())
}

async function submitType() {
  await typeFormRef.value?.validate()
  try {
    if (typeForm.id) {
      await updateDbType({ ...typeForm })
    } else {
      await createDbType({ ...typeForm })
    }
    ElMessage.success('保存成功')
    typeDrawerRef.value?.stopSaving(true)
    await loadTypes()
  } catch {
    typeDrawerRef.value?.stopSaving(false)
    ElMessage.error('保存失败，请稍后重试')
  }
}

async function handleTypeDelete(row: DatabaseTypeMgmt) {
  try {
    await ElMessageBox.confirm(
      `确认删除数据库类型「${row.label}（${row.code}）」？删除后相关实例可能无法采集。`,
      '删除确认',
      { type: 'warning' }
    )
  } catch {
    return
  }
  await deleteDbType(row.id!)
  ElMessage.success('删除成功')
  if (selectedDbType.value === row.code) {
    selectedDbType.value = ''
  }
  await loadTypes()
}
</script>

<style scoped>
.version-page {
  display: flex;
  flex-direction: column;
  gap: 0;
}
.version-body {
  display: flex;
  gap: 16px;
  height: calc(100vh - 200px);
  min-height: 420px;
}
.type-nav {
  width: 220px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  border: 1px solid var(--el-border-color-lighter, #ebeef5);
  border-radius: var(--radius-base);
  padding: 8px;
  background: var(--el-bg-color);
}
.type-nav-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 4px 6px 10px;
  font-weight: 600;
  color: var(--ink);
  font-size: 14px;
}
.type-nav-scroll {
  flex: 1;
}
.type-nav-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 9px 10px;
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: background 0.15s;
}
.type-nav-item:hover {
  background: var(--el-fill-color-light, #f5f7fa);
}
.type-nav-item.active {
  background: var(--el-color-primary-light-9, #ecf5ff);
}
.type-nav-label {
  font-size: 14px;
  color: var(--ink);
}
.type-nav-item.active .type-nav-label {
  color: var(--el-color-primary, #409eff);
  font-weight: 600;
}
.type-nav-code {
  font-size: 12px;
  color: var(--muted, #909399);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.type-nav-main {
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.type-nav-ops {
  display: none;
  flex-shrink: 0;
}
.type-nav-item:hover .type-nav-ops {
  display: inline-flex;
}
.version-list {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
  overflow: hidden;
}
.version-list-header {
  padding: 10px 16px;
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color-lighter, #ebeef5);
  border-radius: var(--radius-base);
  flex-shrink: 0;
}
.version-list-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--ink);
}
.muted {
  color: var(--muted, #909399);
  font-size: 13px;
}

.form-hint {
  font-size: 12px;
  color: var(--muted, #909399);
  margin-top: 4px;
}
</style>
