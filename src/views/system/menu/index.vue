<template>
  <div>
    <ProTable
      :data="displayData"
      :columns="columns"
      :loading="loading"
      :show-pagination="false"
      :show-add="false"
      :operation-width="230"
      :delete-confirm-msg="(row: any) => `确认删除菜单「${row.name}」？`"
      :delete-request="remove"
      row-key="id"
      :tree-props="{ children: 'children' }"
      :default-expand-all="expandAll"
      @search="load"
    >
      <!-- 搜索区：关键词过滤（客户端） -->
      <template #search>
        <el-form-item label="">
          <el-input
            v-model="keyword"
            placeholder="搜索菜单名 / 编码"
            clearable
            style="width: 240px"
          >
            <template #prefix><el-icon><Search /></el-icon></template>
          </el-input>
        </el-form-item>
      </template>

      <!-- 工具栏左侧 -->
      <template #toolbar>
        <el-button v-permission="'system_menu'" type="primary" :icon="Plus" @click="openCreate(null)">
          新增菜单
        </el-button>
        <el-button @click="expandAll = !expandAll">
          {{ expandAll ? '收起全部' : '展开全部' }}
        </el-button>
      </template>

      <!-- 菜单名称列 -->
      <template #col-name="{ row }">
        <el-icon v-if="row.icon" style="vertical-align: -2px; margin-right: 6px">
          <component :is="resolveIcon(row.icon)" />
        </el-icon>
        <span>{{ row.name }}</span>
        <el-tag v-if="row.visible === false" size="small" type="info" effect="plain" style="margin-left: 6px">隐藏</el-tag>
      </template>

      <!-- 节点类型列 -->
      <template #col-menuType="{ row }">
        <el-tag size="small" :type="row.menuType === 'group' ? 'warning' : 'primary'" effect="plain">
          {{ row.menuType === 'group' ? '目录' : '页面' }}
        </el-tag>
      </template>

      <!-- 状态列 -->
      <template #col-status="{ row }">
        <el-tag :type="statusTag(row.status)" size="small">{{ statusLabel(row.status) }}</el-tag>
      </template>

      <!-- 按钮权限列 -->
      <template #col-buttons="{ row }">
        <el-button
          v-if="row.menuType !== 'group'"
          v-permission="'system_menu'"
          link
          type="primary"
          :icon="Operation"
          @click="openButtons(row as SysMenu)"
        >
          配置（{{ (row.buttons || []).length }}）
        </el-button>
        <span v-else style="color: var(--muted)">—</span>
      </template>

      <!-- 操作列 -->
      <template #operation="{ row, confirmDelete }">
        <el-button
          v-if="row.menuType === 'group'"
          v-permission="'system_menu'"
          link type="primary"
          @click="openCreate(row as SysMenu)"
        >新增子级</el-button>
        <el-button v-permission="'system_menu'" link type="primary" @click="openEdit(row as SysMenu)">编辑</el-button>
        <el-button v-permission="'system_menu'" link type="primary" @click="toggle(row as SysMenu)">
          {{ row.status === 'enabled' ? statusLabel('disabled') : statusLabel('enabled') }}
        </el-button>
        <el-button v-permission="'system_menu'" link type="danger" @click="onDeleteClick(row as SysMenu, confirmDelete)">删除</el-button>
      </template>
    </ProTable>

    <!-- 新增/编辑抽屉 -->
    <CrudDrawer
      ref="menuDrawerRef"
      :visible="dialogVisible"
      type="drawer"
      :mode="form.id ? 'edit' : 'create'"
      title="菜单"
      size="600px"
      :form-ref="formRef"
      :confirm-on-save="false"
      @update:visible="dialogVisible = $event"
      @save="onMenuDrawerSave"
      @closed="reset"
    >
      <template #default>
        <el-form ref="formRef" :model="form" :rules="rules" label-width="92px">
        <el-form-item label="节点类型" prop="menuType">
          <el-radio-group v-model="form.menuType">
            <el-radio-button value="group">目录/分组</el-radio-button>
            <el-radio-button value="menu">页面</el-radio-button>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="上级菜单">
          <el-select v-model="form.parentId" clearable placeholder="顶级菜单" style="width: 100%">
            <el-option label="顶级菜单" :value="null as any" />
            <el-option v-for="g in parentOptions" :key="g.id" :label="g.name" :value="g.id as number" />
          </el-select>
        </el-form-item>
        <el-form-item label="菜单名称" prop="name">
          <el-input v-model="form.name" />
        </el-form-item>
        <el-form-item label="菜单编码" prop="code">
          <el-input v-model="form.code" :disabled="!!form.id" placeholder="全局唯一，如 instances / system_user" />
        </el-form-item>
        <el-form-item label="业务分类">
          <el-select v-model="form.type" style="width: 100%">
            <el-option label="系统级" value="系统级" />
            <el-option label="实例级" value="实例级" />
          </el-select>
        </el-form-item>
        <el-form-item label="图标">
          <el-input v-model="form.icon" placeholder="Element Plus 图标名，如 Coin" />
        </el-form-item>
        <el-form-item label="路由" prop="route">
          <el-input v-model="form.route" placeholder="相对父级的 path 段，如 instances / user / detail/:id" />
        </el-form-item>
        <template v-if="form.menuType !== 'group'">
          <el-form-item label="组件路径">
            <el-input v-model="form.component" placeholder="相对 src/views，不含 .vue，如 system/user" />
          </el-form-item>
          <el-form-item label="重定向">
            <el-input v-model="form.redirect" placeholder="可空，如 /instances" />
          </el-form-item>
          <el-form-item label="权限码">
            <el-input v-model="form.perm" placeholder="menu:action，可空" />
          </el-form-item>
          <el-form-item v-if="form.visible === false" label="高亮归属">
            <el-input v-model="form.activeMenu" placeholder="隐藏页面高亮的菜单 path，如 /instances" />
          </el-form-item>
        </template>
        <el-form-item label="排序">
          <el-input-number v-model="form.sort" :min="0" :max="999" />
        </el-form-item>
        <el-form-item label="菜单显示">
          <el-switch v-model="form.visible" />
          <span class="form-tip">关闭后该菜单不在导航中显示，但路由仍可访问</span>
        </el-form-item>
        <el-form-item label="状态">
          <el-switch v-model="statusEnabled" />
        </el-form-item>
        <el-form-item label="描述">
          <el-input v-model="form.description" type="textarea" :rows="2" />
        </el-form-item>
        </el-form>
      </template>
    </CrudDrawer>

    <!-- 按钮权限配置 -->
    <CrudDrawer
      ref="btnDrawerRef"
      :visible="btnVisible"
      type="drawer"
      mode="edit"
      title="按钮权限配置"
      size="720px"
      :confirm-on-save="false"
      @update:visible="btnVisible = $event"
      @save="onBtnDrawerSave"
    >
      <template #default>
        <el-alert
          type="info"
          :closable="false"
          style="margin-bottom: 12px"
          title="为该页面配置操作按钮（权限点）。权限标识用于后端鉴权与角色授权，需全局唯一，建议命名为 菜单编码:操作（如 user:create）。"
        />
        <el-table :data="btnRows" border size="small" style="width: 100%">
        <el-table-column label="序号" type="index" width="60" align="center" />
        <el-table-column label="按钮名称" min-width="160">
          <template #default="{ row }">
            <el-input v-model="row.name" placeholder="如：新增 / 编辑 / 导出" />
          </template>
        </el-table-column>
        <el-table-column label="权限标识" min-width="220">
          <template #default="{ row }">
            <el-input v-model="row.code" placeholder="如：user:create" />
          </template>
        </el-table-column>
        <el-table-column label="状态" width="90" align="center">
          <template #default="{ row }">
            <el-switch v-model="row.status" active-value="enabled" inactive-value="disabled" />
          </template>
        </el-table-column>
        <el-table-column label="操作" width="80" align="center">
          <template #default="{ $index }">
            <el-button type="danger" link size="small" @click="removeButton($index)">删除</el-button>
          </template>
        </el-table-column>
        </el-table>
        <div style="margin-top: 12px">
          <el-button size="small" :icon="Plus" @click="addButton">添加按钮</el-button>
          <el-button size="small" @click="seedDefaultButtons">填充默认按钮</el-button>
          <span v-if="!btnRows.length" style="margin-left: 8px; color: var(--muted)">暂未配置按钮权限</span>
        </div>
      </template>
    </CrudDrawer>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, type Component } from 'vue'
import { ElMessage, type FormInstance, type FormRules } from 'element-plus'
import { Search, Plus, Operation } from '@element-plus/icons-vue'
import * as Icons from '@element-plus/icons-vue'
import ProTable from '@/components/ProTable/index.vue'
import type { TableColumn } from '@/components/ProTable/types'
import { CrudDrawer } from '@/components/ProTable'
import { listMenus, createMenu, updateMenu, deleteMenu, toggleMenu } from '@/api/menu-admin'
import type { MenuButton, SysMenu } from '@/types'
import { usePermissionStore } from '@/stores/permission'
import { useEnableStatusDict } from '@/composables/useEnableStatusDict'

const permission = usePermissionStore()
const { statusLabel, statusTag, loadEnableStatusDict } = useEnableStatusDict()

const DEFAULT_BUTTON_ACTIONS = [
  { name: '查看', action: 'view' },
  { name: '新增', action: 'create' },
  { name: '编辑', action: 'update' },
  { name: '删除', action: 'delete' },
  { name: '导出', action: 'export' }
]

const columns: TableColumn[] = [
  { label: '菜单名称', minWidth: 200, slot: 'col-name', showOverflowTooltip: false },
  { label: '节点类型', width: 90, align: 'center', slot: 'col-menuType', showOverflowTooltip: false },
  { prop: 'code', label: '菜单编码', minWidth: 120 },
  { prop: 'route', label: '路由', minWidth: 130 },
  { prop: 'component', label: '组件', minWidth: 140 },
  { prop: 'perm', label: '权限码', minWidth: 120 },
  { prop: 'sort', label: '排序', width: 70, align: 'center' },
  { label: '状态', width: 80, align: 'center', slot: 'col-status', showOverflowTooltip: false },
  { label: '按钮权限', width: 120, align: 'center', slot: 'col-buttons', showOverflowTooltip: false },
]

const loading = ref(false)
const keyword = ref('')
const flatMenus = ref<SysMenu[]>([])
const expandAll = ref(true)

function resolveIcon(name?: string): Component | undefined {
  if (!name) return undefined
  return (Icons as Record<string, Component>)[name]
}

async function load() {
  loading.value = true
  try {
    flatMenus.value = await listMenus()
  } finally {
    loading.value = false
  }
}

const parentOptions = computed(() => flatMenus.value.filter((m) => m.menuType === 'group' && m.id !== form.id))

function buildTree(rows: SysMenu[]): SysMenu[] {
  const map = new Map<number, SysMenu>()
  const roots: SysMenu[] = []
  rows.forEach((r) => map.set(r.id!, { ...r, children: [] }))
  rows.forEach((r) => {
    const node = map.get(r.id!)!
    if (r.parentId != null && map.has(r.parentId)) map.get(r.parentId)!.children!.push(node)
    else roots.push(node)
  })
  const sortRec = (list: SysMenu[]) => {
    list.sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0))
    list.forEach((n) => n.children && sortRec(n.children))
  }
  sortRec(roots)
  const clean = (list: SysMenu[]) => list.forEach((n) => (!n.children?.length ? delete n.children : clean(n.children!)))
  clean(roots)
  return roots
}

const displayData = computed<SysMenu[]>(() => {
  const kw = keyword.value.trim().toLowerCase()
  if (kw) {
    return flatMenus.value
      .filter((m) => m.name.toLowerCase().includes(kw) || m.code.toLowerCase().includes(kw))
      .map((m) => ({ ...m, children: undefined }))
  }
  return buildTree(flatMenus.value)
})

// ===== 新增/编辑 =====
const dialogVisible = ref(false)
const menuDrawerRef = ref<{ stopSaving: (close?: boolean) => void } | null>(null)
const formRef = ref<FormInstance>()
const form = reactive<SysMenu>({ ...emptyForm() })

function emptyForm(): SysMenu {
  return {
    id: undefined,
    name: '',
    code: '',
    type: '系统级',
    menuType: 'menu',
    parentId: null,
    icon: '',
    route: '',
    component: '',
    redirect: '',
    perm: '',
    sort: 0,
    visible: true,
    activeMenu: '',
    status: 'enabled',
    description: ''
  }
}

const statusEnabled = computed({
  get: () => form.status === 'enabled',
  set: (v: boolean) => (form.status = v ? 'enabled' : 'disabled')
})

const rules: FormRules = {
  name: [{ required: true, message: '请输入菜单名称', trigger: 'blur' }],
  code: [{ required: true, message: '请输入菜单编码', trigger: 'blur' }],
  menuType: [{ required: true, message: '请选择节点类型', trigger: 'change' }],
  route: [{ required: true, message: '请输入路由 path 段', trigger: 'blur' }]
}

function reset() {
  Object.assign(form, emptyForm())
}

function openCreate(parent: SysMenu | null) {
  reset()
  if (parent) form.parentId = parent.id ?? null
  dialogVisible.value = true
}

function openEdit(row: SysMenu) {
  Object.assign(form, { ...emptyForm(), ...row, children: undefined })
  dialogVisible.value = true
}

async function onMenuDrawerSave() {
  try {
    const { children, ...payload } = form
    void children
    if (payload.menuType === 'group') {
      payload.component = ''
      payload.perm = ''
    }
    if (form.id) await updateMenu(payload)
    else await createMenu(payload)
    ElMessage.success('保存成功')
    menuDrawerRef.value?.stopSaving(true)
    load()
    permission.refreshMenus()
  } catch {
    menuDrawerRef.value?.stopSaving(false)
    ElMessage.error('保存失败，请稍后重试')
  }
}

async function toggle(row: SysMenu) {
  await toggleMenu(row.id!, row.status === 'enabled' ? 'disabled' : 'enabled')
  ElMessage.success('操作成功')
  load()
  permission.refreshMenus()
}

async function onDeleteClick(row: SysMenu, confirmDelete: (targetRow: SysMenu) => Promise<void>) {
  if (flatMenus.value.some((m) => m.parentId === row.id)) {
    ElMessage.warning('该目录下存在子菜单，请先删除子菜单')
    return
  }
  await confirmDelete(row)
}

async function remove(row: SysMenu) {
  await deleteMenu(row.id!)
  load()
  permission.refreshMenus()
}

// ===== 按钮权限配置 =====
const btnVisible = ref(false)
const btnDrawerRef = ref<{ stopSaving: (close?: boolean) => void } | null>(null)
const btnMenu = ref<SysMenu | null>(null)
const btnRows = ref<MenuButton[]>([])

function defaultButtons(code: string): MenuButton[] {
  return DEFAULT_BUTTON_ACTIONS.map((b) => ({ name: b.name, code: `${code}:${b.action}`, status: 'enabled' }))
}

function openButtons(row: SysMenu) {
  btnMenu.value = row
  btnRows.value = (row.buttons || []).map((b) => ({ ...b }))
  btnVisible.value = true
}

function addButton() {
  btnRows.value.push({ name: '', code: `${btnMenu.value?.code || ''}:`, status: 'enabled' })
}

function seedDefaultButtons() {
  const existing = new Set(btnRows.value.map((b) => b.code))
  defaultButtons(btnMenu.value?.code || '').forEach((b) => {
    if (!existing.has(b.code)) btnRows.value.push(b)
  })
}

function removeButton(idx: number) {
  btnRows.value.splice(idx, 1)
}

async function onBtnDrawerSave() {
  if (btnRows.value.some((b) => !b.name || !b.code || b.code.endsWith(':'))) {
    ElMessage.warning('请填写完整的按钮名称与权限标识')
    btnDrawerRef.value?.stopSaving(false)
    return
  }
  const codes = btnRows.value.map((b) => b.code)
  if (new Set(codes).size !== codes.length) {
    ElMessage.warning('权限标识不能重复')
    btnDrawerRef.value?.stopSaving(false)
    return
  }
  if (!btnMenu.value) return
  try {
    const { children, ...payload } = btnMenu.value
    void children
    await updateMenu({ ...payload, buttons: btnRows.value.map((b) => ({ ...b })) })
    ElMessage.success('按钮权限配置已保存')
    btnDrawerRef.value?.stopSaving(true)
    load()
  } catch {
    btnDrawerRef.value?.stopSaving(false)
    ElMessage.error('保存失败，请稍后重试')
  }
}

onMounted(() => {
  loadEnableStatusDict()
  load()
})
</script>

<style scoped>
.form-tip {
  margin-left: 10px;
  color: var(--muted);
  font-size: 12px;
}
</style>
