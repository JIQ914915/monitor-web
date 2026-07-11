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
    :operation-width="140"
    :delete-confirm-msg="(row: any) => `确认删除分组「${row.name}」？`"
    :delete-request="handleDelete"
    @search="search"
    @reset="handleReset"
    @edit="openEdit"
    @page-change="load"
  >
    <template #toolbar>
      <el-button v-permission="'system_group'" type="primary" :icon="Plus" @click="openCreate">新增分组</el-button>
    </template>

    <template #search>
      <el-form-item label="分组名称">
        <el-input v-model="query.keyword" placeholder="搜索分组名称" clearable style="width: 240px">
          <template #prefix><el-icon><Search /></el-icon></template>
        </el-input>
      </el-form-item>
    </template>

    <template #col-instanceCount="{ row }">{{ row.instanceCount ?? 0 }}</template>

    <template #col-parent="{ row }">{{ parentName(row.parentId) }}</template>

    <template #col-owner="{ row }">{{ ownerName(row.ownerId) }}</template>

    <template #col-members="{ row }">{{ (row.memberIds || []).length }} 人</template>
  </ProTable>

  <CrudDrawer
    ref="drawerRef"
    :visible="dialogVisible"
    type="drawer"
    :mode="form.id ? 'edit' : 'create'"
    title="分组"
    size="560px"
    :form-ref="formRef"
    :confirm-on-save="false"
    @update:visible="dialogVisible = $event"
    @save="onDrawerSave"
    @closed="resetForm"
  >
    <template #default>
      <el-form ref="formRef" :model="form" :rules="rules" label-width="92px">
      <el-form-item label="分组名称" prop="name">
        <el-input v-model="form.name" placeholder="如 核心业务组" />
      </el-form-item>
      <el-form-item label="父分组">
        <el-select v-model="form.parentId" clearable style="width: 100%" placeholder="不选则为一级分组">
          <el-option v-for="g in parentOptions" :key="g.id" :label="g.name" :value="g.id!" />
        </el-select>
      </el-form-item>
      <el-form-item label="负责人" prop="ownerId">
        <el-select
          v-model="form.ownerId"
          filterable
          clearable
          style="width: 100%"
          placeholder="选择负责人"
          @change="onOwnerChange"
        >
          <el-option v-for="u in ownerOptions" :key="u.id" :label="userLabel(u)" :value="u.id!" />
        </el-select>
      </el-form-item>
      <el-form-item label="小组成员">
        <el-select v-model="form.memberIds" multiple filterable collapse-tags style="width: 100%" placeholder="选择成员（不含负责人）">
          <el-option v-for="u in memberOptions" :key="u.id" :label="userLabel(u)" :value="u.id!" />
        </el-select>
      </el-form-item>
      <el-form-item label="描述">
        <el-input v-model="form.description" type="textarea" :rows="3" />
      </el-form-item>
      </el-form>
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
import { pageGroups, listGroups, createGroup, updateGroup, deleteGroup, type GroupQuery } from '@/api/group'
import { listUserOptions } from '@/api/user'
import type { InstanceGroup, UserOption } from '@/types'

const columns: TableColumn[] = [
  { prop: 'name', label: '分组名称', minWidth: 150, showOverflowTooltip: false },
  { label: '实例数量', width: 100, align: 'center', slot: 'col-instanceCount', showOverflowTooltip: false },
  { label: '父分组', width: 140, slot: 'col-parent', showOverflowTooltip: false },
  { label: '负责人', width: 120, slot: 'col-owner', showOverflowTooltip: false },
  { label: '成员', width: 90, align: 'center', slot: 'col-members', showOverflowTooltip: false },
  { prop: 'description', label: '描述', minWidth: 160 },
]

const { query, list, total, loading, load, search } = usePagination<InstanceGroup, GroupQuery>(
  (q) => pageGroups(q),
  { keyword: '' }
)

const allGroups = ref<InstanceGroup[]>([])
const userOptions = ref<UserOption[]>([])

function parentName(id?: number | null) {
  if (!id) return '-'
  return allGroups.value.find((g) => g.id === id)?.name || '-'
}

function userLabel(u: UserOption) {
  return u.name
}

function ownerName(id?: number | null) {
  if (id == null) return '-'
  const u = userOptions.value.find((x) => x.id === id)
  return u ? userLabel(u) : `#${id}`
}

const parentOptions = computed(() => allGroups.value.filter((g) => g.id !== form.id))

const ownerOptions = computed(() => userOptions.value.filter((u) => !(form.memberIds || []).includes(u.id!)))
const memberOptions = computed(() => userOptions.value.filter((u) => u.id !== form.ownerId))

function onOwnerChange() {
  if (form.ownerId != null) {
    form.memberIds = (form.memberIds || []).filter((id) => id !== form.ownerId)
  }
}

function handleReset() {
  query.keyword = ''
  search()
}

const dialogVisible = ref(false)
const drawerRef = ref<{ stopSaving: (close?: boolean) => void } | null>(null)
const formRef = ref<FormInstance>()
const form = reactive<InstanceGroup>({ name: '', parentId: null, ownerId: null, memberIds: [], description: '' })

const rules: FormRules<InstanceGroup> = {
  name: [{ required: true, message: '请输入分组名称', trigger: 'blur' }],
  ownerId: [{ required: true, message: '请选择负责人', trigger: 'change' }]
}

function resetForm() {
  Object.assign(form, { id: undefined, name: '', parentId: null, ownerId: null, memberIds: [], description: '' })
}

function openCreate() {
  resetForm()
  dialogVisible.value = true
}

function openEdit(row: InstanceGroup) {
  Object.assign(form, { ...row, memberIds: [...(row.memberIds || [])] })
  if (form.ownerId != null) form.memberIds = (form.memberIds || []).filter((id) => id !== form.ownerId)
  dialogVisible.value = true
}

async function onDrawerSave() {
  try {
    if (form.id) await updateGroup({ ...form })
    else await createGroup({ ...form })
    ElMessage.success('保存成功')
    drawerRef.value?.stopSaving(true)
    await refreshGroups()
    load()
  } catch {
    drawerRef.value?.stopSaving(false)
    ElMessage.error('保存失败，请稍后重试')
  }
}

async function handleDelete(row: InstanceGroup) {
  await deleteGroup(row.id!)
  await refreshGroups()
  load()
}

async function refreshGroups() {
  allGroups.value = await listGroups()
}

onMounted(async () => {
  await refreshGroups()
  userOptions.value = await listUserOptions()
  load()
})
</script>
