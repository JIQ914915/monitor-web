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
    :operation-width="220"
    :delete-confirm-msg="(row: any) => `确认删除用户「${row.username}」？`"
    :delete-request="remove"
    @search="search"
    @reset="reset"
    @page-change="load"
  >
    <template #toolbar>
      <el-button v-permission="'system_user'" type="primary" :icon="Plus" @click="openCreate">新增用户</el-button>
    </template>

    <template #search>
      <el-form-item label="关键词">
        <el-input v-model="query.keyword" placeholder="搜索用户名 / 姓名 / 邮箱" clearable style="width: 220px">
          <template #prefix><el-icon><Search /></el-icon></template>
        </el-input>
      </el-form-item>
      <el-form-item label="角色">
        <el-select v-model="query.roleCode" placeholder="全部角色" clearable style="width: 150px">
          <el-option v-for="r in roleOptions" :key="r.code" :label="r.name" :value="r.code" />
        </el-select>
      </el-form-item>
      <el-form-item label="状态">
        <el-select v-model="query.enabled" placeholder="全部状态" clearable style="width: 120px">
          <el-option :label="statusLabel('enabled')" :value="true" />
          <el-option :label="statusLabel('disabled')" :value="false" />
        </el-select>
      </el-form-item>
    </template>

    <template #col-roles="{ row }">
      <el-tag
        v-for="code in row.roles"
        :key="code"
        size="small"
        effect="plain"
        style="margin-right: 4px"
      >{{ roleName(code) }}</el-tag>
    </template>

    <template #col-status="{ row }">
      <el-tag :type="statusTag(row.enabled ? 'enabled' : 'disabled')" size="small">
        {{ statusLabel(row.enabled ? 'enabled' : 'disabled') }}
      </el-tag>
    </template>

    <template #col-lastLogin="{ row }">{{ row.lastLoginTime || '-' }}</template>

    <template #operation="{ row, confirmDelete }">
      <el-button v-permission="'system_user'" link type="primary" size="small" @click="openEdit(row as SysUser)">编辑</el-button>
      <el-button v-permission="'system_user'" link :type="row.enabled ? 'warning' : 'success'" size="small" @click="toggle(row as SysUser)">
        {{ row.enabled ? statusLabel('disabled') : statusLabel('enabled') }}
      </el-button>
      <el-button v-permission="'system_user'" link type="info" size="small" @click="resetPwd(row as SysUser)">重置密码</el-button>
      <el-button v-permission="'system_user'" link type="danger" size="small" @click="confirmDelete(row as SysUser)">删除</el-button>
    </template>
  </ProTable>

  <CrudDrawer
    ref="drawerRef"
    :visible="dialogVisible"
    type="drawer"
    :mode="form.id ? 'edit' : 'create'"
    title="用户"
    size="540px"
    :form-ref="formRef"
    :confirm-on-save="false"
    @update:visible="dialogVisible = $event"
    @save="onDrawerSave"
    @closed="resetForm"
  >
    <template #default>
      <el-form ref="formRef" :model="form" :rules="rules" label-width="92px">
      <el-form-item label="用户名" prop="username">
        <el-input v-model="form.username" :disabled="!!form.id" placeholder="登录用户名" />
      </el-form-item>
      <el-form-item label="姓名" prop="nickname">
        <el-input v-model="form.nickname" placeholder="显示姓名" />
      </el-form-item>
      <el-form-item label="邮箱" prop="email">
        <el-input v-model="form.email" placeholder="如 user@example.com" />
      </el-form-item>
      <el-form-item label="电话" prop="phone">
        <el-input v-model="form.phone" placeholder="联系电话" />
      </el-form-item>
      <el-form-item v-if="!form.id" label="初始密码">
        <el-input v-model="form.password" placeholder="留空则默认 123456" />
      </el-form-item>
      <el-form-item label="角色" prop="roles">
        <el-select v-model="form.roles" multiple collapse-tags filterable style="width: 100%" placeholder="选择角色（可多选）">
          <el-option v-for="r in roleOptions" :key="r.code" :label="r.name" :value="r.code" />
        </el-select>
      </el-form-item>
      <el-form-item label="状态">
        <el-switch v-model="form.enabled" />
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
import { usePagination } from '@/composables/usePagination'
import {
  pageUsers,
  createUser,
  updateUser,
  deleteUser,
  toggleUser,
  resetUserPassword,
  type UserQuery
} from '@/api/user'
import { listRoles } from '@/api/role'
import type { SysRole, SysUser } from '@/types'
import { useEnableStatusDict } from '@/composables/useEnableStatusDict'

const { statusLabel, statusTag, loadEnableStatusDict } = useEnableStatusDict()

const columns: TableColumn[] = [
  { prop: 'username', label: '用户名', minWidth: 120 },
  { prop: 'nickname', label: '姓名', minWidth: 100 },
  { prop: 'email', label: '邮箱', minWidth: 170 },
  { prop: 'phone', label: '电话', minWidth: 120, showOverflowTooltip: false },
  { label: '角色', minWidth: 180, slot: 'col-roles', showOverflowTooltip: false },
  { label: '状态', width: 80, align: 'center', slot: 'col-status', showOverflowTooltip: false },
  { label: '最后登录', width: 160, slot: 'col-lastLogin', showOverflowTooltip: false },
  { prop: 'createTime', label: '创建时间', width: 160 },
]

const { query, list, total, loading, load, search, reset } = usePagination<SysUser, UserQuery>(
  (q) => pageUsers(q),
  { keyword: '', roleCode: undefined, enabled: undefined }
)

const roleOptions = ref<SysRole[]>([])
function roleName(code: string) {
  return roleOptions.value.find((r) => r.code === code)?.name || code
}

const dialogVisible = ref(false)
const drawerRef = ref<{ stopSaving: (close?: boolean) => void } | null>(null)
const formRef = ref<FormInstance>()
const form = reactive<SysUser>({ username: '', nickname: '', email: '', phone: '', password: '', roles: [], enabled: true })

const rules: FormRules<SysUser> = {
  username: [{ required: true, message: '请输入用户名', trigger: 'blur' }],
  nickname: [{ required: true, message: '请输入姓名', trigger: 'blur' }],
  email: [{ type: 'email', message: '邮箱格式不正确', trigger: 'blur' }],
  roles: [{ required: true, type: 'array', min: 1, message: '请至少选择一个角色', trigger: 'change' }]
}

function resetForm() {
  Object.assign(form, { id: undefined, username: '', nickname: '', email: '', phone: '', password: '', roles: [], enabled: true })
}

function openCreate() {
  resetForm()
  dialogVisible.value = true
}

function openEdit(row: SysUser) {
  Object.assign(form, { ...row, password: '', roles: [...(row.roles || [])] })
  dialogVisible.value = true
}

async function onDrawerSave() {
  try {
    if (form.id) await updateUser({ ...form })
    else await createUser({ ...form })
    ElMessage.success('保存成功')
    drawerRef.value?.stopSaving(true)
    load()
  } catch {
    drawerRef.value?.stopSaving(false)
    ElMessage.error('保存失败，请稍后重试')
  }
}

async function toggle(row: SysUser) {
  await toggleUser(row.id!, !row.enabled)
  ElMessage.success('操作成功')
  load()
}

async function resetPwd(row: SysUser) {
  await ElMessageBox.confirm(`确认将「${row.username}」的密码重置为默认 123456？`, '重置密码', { type: 'warning' })
  await resetUserPassword(row.id!)
  ElMessage.success('密码已重置为 123456')
}

async function remove(row: SysUser) {
  await deleteUser(row.id!)
  load()
}

onMounted(async () => {
  loadEnableStatusDict()
  roleOptions.value = await listRoles()
  load()
})
</script>
