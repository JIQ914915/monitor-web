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
    :delete-confirm-msg="(row: any) => `确认删除角色「${row.name}」？`"
    :delete-request="remove"
    @search="search"
    @reset="reset"
    @page-change="load"
  >
    <template #toolbar>
      <el-button v-permission="'system_role'" type="primary" :icon="Plus" @click="openCreate">新增角色</el-button>
    </template>

    <template #search>
      <el-form-item label="关键词">
        <el-input v-model="query.keyword" placeholder="搜索角色名 / 编码" clearable style="width: 200px">
          <template #prefix><el-icon><Search /></el-icon></template>
        </el-input>
      </el-form-item>
      <el-form-item label="类型">
        <el-select v-model="query.type" placeholder="全部类型" clearable style="width: 130px">
          <el-option v-for="t in roleTypeItems" :key="t.value" :label="t.label" :value="t.value" />
        </el-select>
      </el-form-item>
      <el-form-item label="状态">
        <el-select v-model="query.status" placeholder="全部状态" clearable style="width: 120px">
          <el-option v-for="s in statusItems" :key="s.value" :label="s.label" :value="s.value" />
        </el-select>
      </el-form-item>
    </template>

    <template #col-type="{ row }">
      <el-tag :type="roleTypeTag(row.type)" size="small">{{ roleTypeLabel(row.type) }}</el-tag>
    </template>

    <template #col-userCount="{ row }">{{ row.userCount ?? 0 }}</template>

    <template #col-menuPerm="{ row }">
      <el-tag v-if="(row.permissions || []).includes('*:*')" type="danger" size="small">全部</el-tag>
      <span v-else>{{ visibleMenuCount(row as SysRole) }}/{{ menuList.length || '-' }}</span>
    </template>

    <template #col-status="{ row }">
      <el-tag :type="statusTag(row.status)" size="small">{{ statusLabel(row.status) }}</el-tag>
    </template>

    <template #operation="{ row, confirmDelete }">
      <el-button v-permission="'system_role'" link type="primary" size="small" @click="openEdit(row as SysRole)">编辑</el-button>
      <el-button v-permission="'system_role'" link :type="row.status === 'disabled' ? 'success' : 'warning'" size="small" @click="toggle(row as SysRole)">
        {{ row.status === 'disabled' ? statusLabel('enabled') : statusLabel('disabled') }}
      </el-button>
      <el-button v-permission="'system_role'" link type="info" size="small" @click="openPerm(row as SysRole)">权限配置</el-button>
      <el-button
        v-permission="'system_role'"
        link
        type="danger"
        size="small"
        :disabled="row.type === 'preset' || row.code === 'super_admin'"
        @click="confirmDelete(row as SysRole)"
      >删除</el-button>
    </template>
  </ProTable>

  <!-- 新增/编辑角色 -->
  <CrudDrawer
    ref="drawerRef"
    :visible="dialogVisible"
    type="drawer"
    :mode="form.id ? 'edit' : 'create'"
    title="角色"
    size="560px"
    :form-ref="formRef"
    :confirm-on-save="false"
    @update:visible="dialogVisible = $event"
    @save="onDrawerSave"
    @closed="resetForm"
  >
    <template #default>
      <el-form ref="formRef" :model="form" :rules="rules" label-width="92px">
      <el-form-item label="角色名称" prop="name">
        <el-input v-model="form.name" placeholder="如 DBA 用户" />
      </el-form-item>
      <el-form-item label="角色编码" prop="code">
        <el-input v-model="form.code" :disabled="!!form.id" placeholder="如 dba" />
      </el-form-item>
      <el-form-item label="角色类型">
        <el-select v-model="form.type" style="width: 100%" :disabled="form.type === 'preset' && !!form.id">
          <el-option v-for="t in roleTypeItems" :key="t.value" :label="t.label" :value="t.value" />
        </el-select>
      </el-form-item>
      <el-form-item label="描述">
        <el-input v-model="form.description" type="textarea" :rows="3" placeholder="请输入角色描述" />
      </el-form-item>
      <el-form-item label="状态">
        <el-switch v-model="statusEnabled" />
      </el-form-item>
      </el-form>
    </template>
  </CrudDrawer>

  <!-- 权限配置 -->
  <CrudDrawer
    ref="permDrawerRef"
    :visible="permVisible"
    type="drawer"
    mode="edit"
    title="角色权限"
    size="820px"
    :confirm-on-save="false"
    @update:visible="permVisible = $event"
    @save="onPermDrawerSave"
  >
    <template #default>
      <el-tabs v-model="permTab">
        <el-tab-pane label="菜单与按钮权限" name="menu">
          <div class="perm-ops">
            <el-button size="small" @click="selectAllVisible(true)">全部可见</el-button>
            <el-button size="small" @click="selectAllVisible(false)">全部隐藏</el-button>
            <el-button size="small" @click="grantAllButtons(true)">授予全部按钮</el-button>
            <el-button size="small" @click="grantAllButtons(false)">清除全部按钮</el-button>
            <span class="perm-tip">先开启菜单「可见」，再展开行勾选按钮权限；菜单不可见时其按钮权限自动失效。</span>
          </div>
          <el-table :data="permMenuRows" row-key="code" max-height="420" stripe>
            <el-table-column type="expand">
              <template #default="{ row }">
                <div class="perm-btns">
                  <template v-if="row.visible">
                    <template v-if="row.buttons.length">
                      <span class="perm-btns-label">按钮权限点：</span>
                      <el-checkbox-group v-model="row.selectedButtons">
                        <el-checkbox v-for="b in row.buttons" :key="b.code" :value="b.code" style="min-width: 150px">
                          {{ b.name }}<span class="perm-btn-code">（{{ b.code }}）</span>
                        </el-checkbox>
                      </el-checkbox-group>
                    </template>
                    <span v-else class="perm-btns-disabled">该菜单未配置按钮权限</span>
                  </template>
                  <span v-else class="perm-btns-disabled">需先开启「可见」才能授予按钮权限</span>
                </div>
              </template>
            </el-table-column>
            <el-table-column label="菜单名称" min-width="170" prop="name" />
            <el-table-column label="类型" width="90">
              <template #default="{ row }">
                <el-tag size="small" :type="row.type === '系统级' ? 'primary' : 'success'">{{ row.type }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column label="可见" width="70">
              <template #default="{ row }">
                <el-switch v-model="row.visible" @change="onVisibleChange(row as PermRow)" />
              </template>
            </el-table-column>
            <el-table-column label="按钮权限" width="100" align="center">
              <template #default="{ row }">
                <span :class="{ 'perm-count-on': row.visible && row.selectedButtons.length }">
                  {{ row.visible ? row.selectedButtons.length : 0 }}/{{ row.buttons.length }}
                </span>
              </template>
            </el-table-column>
          </el-table>
        </el-tab-pane>

        <el-tab-pane label="数据范围" name="scope">
          <p class="perm-tip" style="margin: 0 0 12px">控制该角色可查看和操作的实例范围。</p>
          <el-radio-group v-model="permScope.type">
            <el-radio value="all">全部实例</el-radio>
            <el-radio value="group">指定分组</el-radio>
            <el-radio value="self">仅本人负责</el-radio>
          </el-radio-group>
          <div v-if="permScope.type === 'group'" style="margin-top: 12px">
            <el-select v-model="permScope.groupIds" multiple filterable placeholder="选择分组" style="width: 100%">
              <el-option v-for="g in groupOptions" :key="g.id" :label="g.name" :value="g.id!" />
            </el-select>
          </div>
        </el-tab-pane>
      </el-tabs>
    </template>
  </CrudDrawer>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { ElMessage, type FormInstance, type FormRules } from 'element-plus'
import { Search, Plus } from '@element-plus/icons-vue'
import ProTable from '@/components/ProTable/index.vue'
import type { TableColumn } from '@/components/ProTable/types'
import { CrudDrawer } from '@/components/ProTable'
import { usePagination } from '@/composables/usePagination'
import { pageRoles, createRole, updateRole, deleteRole, toggleRole, type RoleQuery } from '@/api/role'
import { listMenus } from '@/api/menu-admin'
import { listGroupOptions } from '@/api/group'
import { listDictItems } from '@/api/dict'
import { useEnableStatusDict } from '@/composables/useEnableStatusDict'
import type { DataScopeType, GroupOption, SysMenu, SysRole } from '@/types'

const { statusItems, statusLabel, statusTag, loadEnableStatusDict } = useEnableStatusDict()

type TagType = 'success' | 'warning' | 'danger' | 'info' | 'primary'

interface PermRow {
  code: string
  name: string
  type: string
  visible: boolean
  buttons: { name: string; code: string }[]
  selectedButtons: string[]
}

const columns: TableColumn[] = [
  { prop: 'name', label: '角色名称', minWidth: 130, showOverflowTooltip: false },
  { prop: 'code', label: '角色编码', minWidth: 130, showOverflowTooltip: false },
  { label: '类型', width: 90, align: 'center', slot: 'col-type', showOverflowTooltip: false },
  { label: '关联用户数', width: 100, align: 'center', slot: 'col-userCount', showOverflowTooltip: false },
  { label: '菜单权限', width: 100, align: 'center', slot: 'col-menuPerm', showOverflowTooltip: false },
  { label: '状态', width: 80, align: 'center', slot: 'col-status', showOverflowTooltip: false },
  { prop: 'description', label: '描述', minWidth: 150 },
  { prop: 'createTime', label: '创建时间', width: 160 },
]

const FALLBACK_ROLE_TYPES: { value: string; label: string; tagType: TagType }[] = [
  { value: 'preset', label: '预设', tagType: 'success' },
  { value: 'custom', label: '自定义', tagType: 'info' }
]
const roleTypeItems = ref<{ value: string; label: string; tagType: TagType }[]>([...FALLBACK_ROLE_TYPES])
function roleTypeMeta(v?: string) {
  return roleTypeItems.value.find((t) => t.value === v)
}
function roleTypeLabel(v?: string) {
  return roleTypeMeta(v)?.label || v || '自定义'
}
function roleTypeTag(v?: string): TagType {
  return roleTypeMeta(v)?.tagType || 'info'
}

async function loadRoleTypeDict() {
  try {
    const rows = await listDictItems('role_type')
    if (rows.length) {
      roleTypeItems.value = rows.map((r) => ({
        value: r.itemValue,
        label: r.itemLabel,
        tagType: (r.tagType || 'info') as TagType
      }))
    }
  } catch {
    // 字典读取失败时保留内置兜底
  }
}

const { query, list, total, loading, load, search, reset } = usePagination<SysRole, RoleQuery>(
  (q) => pageRoles(q),
  { keyword: '', type: undefined, status: undefined }
)

const menuList = ref<SysMenu[]>([])
const groupOptions = ref<GroupOption[]>([])

function menuButtons(menu: SysMenu) {
  return (menu.buttons || [])
    .filter((b) => b.status !== 'disabled')
    .map((b) => ({ name: b.name, code: b.code }))
}

function visibleMenuCount(row: SysRole) {
  const perms = row.permissions || []
  return menuList.value.filter((m) => m.perm && perms.includes(m.perm)).length
}

// ===== 新增/编辑 =====
const dialogVisible = ref(false)
const drawerRef = ref<{ stopSaving: (close?: boolean) => void } | null>(null)
const formRef = ref<FormInstance>()
const form = reactive<SysRole>({ code: '', name: '', type: 'custom', status: 'enabled', description: '', permissions: [] })

const statusEnabled = computed({
  get: () => form.status !== 'disabled',
  set: (v: boolean) => { form.status = v ? 'enabled' : 'disabled' }
})

const rules: FormRules<SysRole> = {
  name: [{ required: true, message: '请输入角色名称', trigger: 'blur' }],
  code: [{ required: true, message: '请输入角色编码', trigger: 'blur' }]
}

function resetForm() {
  Object.assign(form, { id: undefined, code: '', name: '', type: 'custom', status: 'enabled', description: '', permissions: [] })
}

function openCreate() {
  resetForm()
  dialogVisible.value = true
}

function openEdit(row: SysRole) {
  Object.assign(form, { ...row, permissions: [...(row.permissions || [])] })
  dialogVisible.value = true
}

async function onDrawerSave() {
  try {
    if (form.id) await updateRole({ ...form })
    else await createRole({ ...form })
    ElMessage.success('保存成功')
    drawerRef.value?.stopSaving(true)
    load()
  } catch {
    drawerRef.value?.stopSaving(false)
    ElMessage.error('保存失败，请稍后重试')
  }
}

async function toggle(row: SysRole) {
  const next = row.status === 'disabled' ? 'enabled' : 'disabled'
  await toggleRole(row.id!, next)
  ElMessage.success('操作成功')
  load()
}

async function remove(row: SysRole) {
  await deleteRole(row.id!)
  load()
}

// ===== 权限配置 =====
const permVisible = ref(false)
const permDrawerRef = ref<{ stopSaving: (close?: boolean) => void } | null>(null)
const permTab = ref('menu')
const permRole = reactive<SysRole>({ code: '', name: '', permissions: [] })
const permMenuRows = ref<PermRow[]>([])
const permScope = reactive<{ type: DataScopeType; groupIds: number[] }>({ type: 'all', groupIds: [] })

function openPerm(row: SysRole) {
  Object.assign(permRole, { ...row })
  const isAll = (row.permissions || []).includes('*:*') || row.code === 'super_admin'
  const perms = row.permissions || []

  permMenuRows.value = menuList.value.map((m) => {
    const buttons = menuButtons(m)
    let visible: boolean
    let selectedButtons: string[]
    if (isAll) {
      visible = true
      selectedButtons = buttons.map((b) => b.code)
    } else {
      const btnHit = buttons.filter((b) => perms.includes(b.code)).map((b) => b.code)
      visible = (m.perm ? perms.includes(m.perm) : false) || btnHit.length > 0
      selectedButtons = visible ? btnHit : []
    }
    return { code: m.code, name: m.name, type: m.type, visible, buttons, selectedButtons }
  })

  permScope.type = (row.dataScope as DataScopeType) || 'self'
  permScope.groupIds = [...(row.dataScopeGroups || [])]
  permTab.value = 'menu'
  permVisible.value = true
}

function onVisibleChange(row: PermRow) {
  if (!row.visible) row.selectedButtons = []
}

function selectAllVisible(v: boolean) {
  permMenuRows.value.forEach((r) => {
    r.visible = v
    if (!v) r.selectedButtons = []
  })
}

function grantAllButtons(v: boolean) {
  permMenuRows.value.forEach((r) => {
    if (!r.visible) { r.selectedButtons = []; return }
    r.selectedButtons = v ? r.buttons.map((b) => b.code) : []
  })
}

async function onPermDrawerSave() {
  let permissions: string[]
  if (permRole.code === 'super_admin') {
    permissions = ['*:*']
  } else {
    const set = new Set<string>()
    permMenuRows.value.forEach((r) => {
      if (!r.visible) return
      const menu = menuList.value.find((m) => m.code === r.code)
      if (menu?.perm) set.add(menu.perm)
      r.selectedButtons.forEach((c) => set.add(c))
    })
    permissions = [...set]
  }

  try {
    await updateRole({
      ...permRole,
      permissions,
      dataScope: permScope.type,
      dataScopeGroups: permScope.type === 'group' ? [...permScope.groupIds] : []
    })
    ElMessage.success('权限已保存')
    permDrawerRef.value?.stopSaving(true)
    load()
  } catch {
    permDrawerRef.value?.stopSaving(false)
    ElMessage.error('保存失败，请稍后重试')
  }
}

onMounted(async () => {
  loadRoleTypeDict()
  loadEnableStatusDict()
  const [menus, groups] = await Promise.all([listMenus(), listGroupOptions()])
  menuList.value = menus.filter((m) => m.menuType !== 'group' && m.visible !== false)
  groupOptions.value = groups
  load()
})
</script>

<style scoped>
.perm-ops {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  margin-bottom: 10px;
}
.perm-tip {
  color: var(--muted);
  font-size: 12px;
}
.perm-btns {
  padding: 10px 24px 14px 48px;
}
.perm-btns-label {
  color: var(--ink-soft);
  font-size: 12px;
  margin-right: 8px;
}
.perm-btns-disabled {
  color: var(--muted);
  font-size: 13px;
}
.perm-btn-code {
  color: var(--muted);
  font-size: 12px;
}
.perm-count-on {
  color: var(--signal);
}
</style>
