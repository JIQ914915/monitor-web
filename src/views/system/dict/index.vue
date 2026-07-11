<template>
  <div class="dict-page">
    <div class="dict-body">
      <!-- 左侧字典类型 -->
      <div class="dict-types">
        <div class="dict-types-head">
          <span>字典类型</span>
          <el-button v-permission="'dict:create'" link type="primary" :icon="Plus" @click="openTypeCreate">新增</el-button>
        </div>
        <el-input v-model="typeKeyword" placeholder="搜索类型" clearable size="small" class="dict-types-search">
          <template #prefix><el-icon><Search /></el-icon></template>
        </el-input>
        <el-scrollbar class="dict-types-scroll">
          <div
            v-for="t in filteredTypes"
            :key="t.id"
            class="dict-type-item"
            :class="{ active: selectedType?.dictType === t.dictType }"
            @click="selectType(t)"
          >
            <div class="dict-type-main">
              <div class="dict-type-name-row">
                <span class="dict-type-name">{{ t.dictName }}</span>
                <el-tag :type="scopeTag(t.type)" size="small" class="dict-type-scope">{{ scopeLabel(t.type) }}</el-tag>
              </div>
              <span class="dict-type-code">{{ t.dictType }}</span>
            </div>
            <div v-if="canMutateType(t)" class="dict-type-ops" @click.stop>
              <el-button v-permission="'dict:update'" link type="primary" :icon="Edit" @click="openTypeEdit(t)" />
              <el-button v-permission="'dict:delete'" link type="danger" :icon="Delete" @click="removeType(t)" />
            </div>
          </div>
          <el-empty v-if="filteredTypes.length === 0" description="暂无字典类型" :image-size="60" />
        </el-scrollbar>
      </div>

      <!-- 右侧字典项 -->
      <div class="dict-items">
        <!-- 标题行（单独一行） -->
        <div class="dict-items-header">
          <span class="dict-items-title">
            {{ selectedType ? `${selectedType.dictName}（${selectedType.dictType}）` : '请选择左侧字典类型' }}
          </span>
          <el-tag v-if="selectedType" :type="scopeTag(selectedType.type)" size="small">{{ scopeLabel(selectedType.type) }}</el-tag>
          <span v-if="selectedType && isSystemScope(selectedType) && !isSuperAdmin" class="dict-readonly-tip">系统级字典仅可查看</span>
        </div>

        <!-- 字典项列表 -->
        <ProTable
          :data="items"
          :columns="itemColumns"
          :loading="itemsLoading"
          :show-pagination="false"
          :show-add="false"
          :operation-width="100"
          :delete-confirm-msg="(row: any) => `确认删除字典项「${row.itemLabel}」？`"
          :delete-request="removeItem"
          @search="loadItems"
          @edit="openItemEdit"
        >
          <template #toolbar>
            <el-button
              v-if="canMutateItems"
              v-permission="'dict:create'"
              type="primary"
              :icon="Plus"
              :disabled="!selectedType"
              @click="openItemCreate"
            >新增字典项</el-button>
          </template>

          <template #col-label="{ row }">
            <el-tag :type="tagType(row.tagType)" size="small">{{ row.itemLabel }}</el-tag>
          </template>

          <template #col-tagType="{ row }">{{ row.tagType || '-' }}</template>

          <template #col-status="{ row }">
            <el-tag :type="statusTag(row.status)" size="small">{{ statusLabel(row.status) }}</el-tag>
          </template>

          <template #operation="{ row, confirmDelete }">
            <template v-if="canMutateItems">
              <el-button v-permission="'dict:update'" link type="primary" size="small" @click="openItemEdit(row as SysDictItem)">编辑</el-button>
              <el-button
                v-permission="'dict:delete'"
                link
                type="danger"
                size="small"
                @click="confirmDelete(row as SysDictItem)"
              >删除</el-button>
            </template>
            <span v-else class="dict-readonly-text">只读</span>
          </template>
        </ProTable>
      </div>
    </div>

    <!-- 字典类型 抽屉 -->
    <CrudDrawer
      ref="typeDrawerRef"
      :visible="typeVisible"
      type="drawer"
      :mode="typeForm.id ? 'edit' : 'create'"
      title="字典类型"
      size="460px"
      :form-ref="typeFormRef"
      :confirm-on-save="false"
      @update:visible="typeVisible = $event"
      @save="onTypeDrawerSave"
      @closed="resetTypeForm"
    >
      <template #default>
        <el-form ref="typeFormRef" :model="typeForm" :rules="typeRules" label-width="96px">
        <el-form-item label="类型名称" prop="dictName">
          <el-input v-model="typeForm.dictName" placeholder="如 实例状态" />
        </el-form-item>
        <el-form-item label="类型编码" prop="dictType">
          <el-input v-model="typeForm.dictType" placeholder="如 instance_status" />
        </el-form-item>
        <el-form-item label="状态">
          <el-switch v-model="typeForm.status" active-value="enabled" inactive-value="disabled" />
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="typeForm.remark" type="textarea" :rows="2" placeholder="备注（可选）" />
        </el-form-item>
        </el-form>
      </template>
    </CrudDrawer>

    <!-- 字典项 抽屉 -->
    <CrudDrawer
      ref="itemDrawerRef"
      :visible="itemVisible"
      type="drawer"
      :mode="itemForm.id ? 'edit' : 'create'"
      title="字典项"
      size="460px"
      :form-ref="itemFormRef"
      :confirm-on-save="false"
      @update:visible="itemVisible = $event"
      @save="onItemDrawerSave"
      @closed="resetItemForm"
    >
      <template #default>
        <el-form ref="itemFormRef" :model="itemForm" :rules="itemRules" label-width="96px">
        <el-form-item label="字典标签" prop="itemLabel">
          <el-input v-model="itemForm.itemLabel" placeholder="如 正常" />
        </el-form-item>
        <el-form-item label="字典值" prop="itemValue">
          <el-input v-model="itemForm.itemValue" placeholder="如 normal" />
        </el-form-item>
        <el-form-item label="标签颜色">
          <el-select v-model="itemForm.tagType" clearable placeholder="标签颜色（可选）" style="width: 100%">
            <el-option v-for="c in TAG_TYPES" :key="c.value" :value="c.value" :label="c.label">
              <el-tag :type="c.value" size="small">{{ c.label }}</el-tag>
            </el-option>
          </el-select>
        </el-form-item>
        <el-form-item label="排序">
          <el-input-number v-model="itemForm.sort" :min="0" controls-position="right" style="width: 100%" />
        </el-form-item>
        <el-form-item label="状态">
          <el-switch v-model="itemForm.status" active-value="enabled" inactive-value="disabled" />
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="itemForm.remark" type="textarea" :rows="2" placeholder="备注（可选）" />
        </el-form-item>
        </el-form>
      </template>
    </CrudDrawer>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from 'element-plus'
import { Search, Plus, Edit, Delete } from '@element-plus/icons-vue'
import ProTable from '@/components/ProTable/index.vue'
import type { TableColumn } from '@/components/ProTable/types'
import { CrudDrawer } from '@/components/ProTable'
import {
  listDictTypes,
  createDictType,
  updateDictType,
  deleteDictType,
  listDictItems,
  createDictItem,
  updateDictItem,
  deleteDictItem
} from '@/api/dict'
import type { SysDictItem, SysDictType } from '@/types'
import { useEnableStatusDict } from '@/composables/useEnableStatusDict'
import { useUserStore } from '@/stores/user'

const userStore = useUserStore()
const isSuperAdmin = computed(() => userStore.hasRole('super_admin'))

type TagKind = 'success' | 'warning' | 'danger' | 'info' | 'primary'
const FALLBACK_SCOPE_TYPES: { value: string; label: string; tagType: TagKind }[] = [
  { value: 'system', label: '系统级', tagType: 'success' },
  { value: 'custom', label: '自定义', tagType: 'info' }
]
const scopeTypeItems = ref([...FALLBACK_SCOPE_TYPES])

function scopeMeta(v?: string) {
  return scopeTypeItems.value.find((t) => t.value === v)
}
function scopeLabel(v?: string) {
  return scopeMeta(v)?.label || (v === 'system' ? '系统级' : '自定义')
}
function scopeTag(v?: string): TagKind {
  return scopeMeta(v)?.tagType || (v === 'system' ? 'success' : 'info')
}
function isSystemScope(t?: SysDictType | null) {
  return t?.type === 'system'
}
function canMutateType(t: SysDictType) {
  return !isSystemScope(t) || isSuperAdmin.value
}

const { statusLabel, statusTag, loadEnableStatusDict } = useEnableStatusDict()

const TAG_TYPES: { value: TagKind; label: string }[] = [
  { value: 'success', label: '成功(绿)' },
  { value: 'warning', label: '警告(橙)' },
  { value: 'danger', label: '危险(红)' },
  { value: 'info', label: '信息(灰)' },
  { value: 'primary', label: '主要(蓝)' }
]
function tagType(t?: string): TagKind {
  return (TAG_TYPES.find((x) => x.value === t)?.value || 'info') as TagKind
}

const itemColumns: TableColumn[] = [
  { label: '字典标签', minWidth: 140, slot: 'col-label', showOverflowTooltip: false },
  { prop: 'itemValue', label: '字典值', minWidth: 140 },
  { label: '标签颜色', width: 120, slot: 'col-tagType', showOverflowTooltip: false },
  { prop: 'sort', label: '排序', width: 80, align: 'center' },
  { label: '状态', width: 90, align: 'center', slot: 'col-status', showOverflowTooltip: false },
  { prop: 'remark', label: '备注', minWidth: 140 },
]

// ===== 字典类型 =====
const types = ref<SysDictType[]>([])
const typeKeyword = ref('')
const selectedType = ref<SysDictType | null>(null)

const canMutateItems = computed(() =>
  selectedType.value ? canMutateType(selectedType.value) : false
)

const filteredTypes = computed(() => {
  const kw = typeKeyword.value.trim().toLowerCase()
  if (!kw) return types.value
  return types.value.filter(
    (t) => t.dictName.toLowerCase().includes(kw) || t.dictType.toLowerCase().includes(kw)
  )
})

async function loadTypes(keepSelection = true) {
  types.value = await listDictTypes()
  if (types.value.length === 0) {
    selectedType.value = null
    items.value = []
    return
  }
  const stillThere = selectedType.value && types.value.find((t) => t.dictType === selectedType.value!.dictType)
  if (!keepSelection || !stillThere) {
    selectType(types.value[0])
  }
}

function selectType(t: SysDictType) {
  selectedType.value = t
  loadItems()
}

// ===== 字典项 =====
const items = ref<SysDictItem[]>([])
const itemsLoading = ref(false)

async function loadItems() {
  if (!selectedType.value) return
  itemsLoading.value = true
  try {
    items.value = await listDictItems(selectedType.value.dictType)
  } finally {
    itemsLoading.value = false
  }
}

// ===== 类型 新增/编辑 =====
const typeVisible = ref(false)
const typeDrawerRef = ref<{ stopSaving: (close?: boolean) => void } | null>(null)
const typeFormRef = ref<FormInstance>()
const typeForm = reactive<SysDictType>(emptyType())

function emptyType(): SysDictType {
  return { id: undefined, dictType: '', dictName: '', type: 'custom', status: 'enabled', remark: '' }
}

const typeRules: FormRules = {
  dictName: [{ required: true, message: '请输入类型名称', trigger: 'blur' }],
  dictType: [{ required: true, message: '请输入类型编码', trigger: 'blur' }]
}

function openTypeCreate() {
  Object.assign(typeForm, emptyType())
  typeVisible.value = true
}
function openTypeEdit(t: SysDictType) {
  Object.assign(typeForm, { ...t })
  typeVisible.value = true
}
function resetTypeForm() {
  Object.assign(typeForm, emptyType())
}
async function onTypeDrawerSave() {
  try {
    if (typeForm.id) await updateDictType({ ...typeForm })
    else await createDictType({ ...typeForm })
    ElMessage.success('保存成功')
    const editedType = typeForm.dictType
    typeDrawerRef.value?.stopSaving(true)
    await loadTypes(true)
    const target = types.value.find((t) => t.dictType === editedType)
    if (target) selectType(target)
  } catch {
    typeDrawerRef.value?.stopSaving(false)
    ElMessage.error('保存失败，请稍后重试')
  }
}
async function removeType(t: SysDictType) {
  try {
    await ElMessageBox.confirm(`确认删除字典类型「${t.dictName}」及其全部字典项？`, '删除确认', { type: 'warning' })
  } catch {
    return
  }
  await deleteDictType(t.id!)
  ElMessage.success('删除成功')
  if (selectedType.value?.dictType === t.dictType) selectedType.value = null
  await loadTypes(false)
}

// ===== 字典项 新增/编辑 =====
const itemVisible = ref(false)
const itemDrawerRef = ref<{ stopSaving: (close?: boolean) => void } | null>(null)
const itemFormRef = ref<FormInstance>()
const itemForm = reactive<SysDictItem>(emptyItem())

function emptyItem(): SysDictItem {
  return {
    id: undefined,
    dictType: selectedType.value?.dictType || '',
    itemValue: '',
    itemLabel: '',
    tagType: 'info',
    sort: (items.value.length + 1) * 1,
    status: 'enabled',
    remark: ''
  }
}

const itemRules: FormRules = {
  itemLabel: [{ required: true, message: '请输入字典标签', trigger: 'blur' }],
  itemValue: [{ required: true, message: '请输入字典值', trigger: 'blur' }]
}

function openItemCreate() {
  if (!selectedType.value) return
  Object.assign(itemForm, emptyItem())
  itemVisible.value = true
}
function openItemEdit(row: SysDictItem) {
  Object.assign(itemForm, { ...row })
  itemVisible.value = true
}
function resetItemForm() {
  Object.assign(itemForm, emptyItem())
}
async function onItemDrawerSave() {
  try {
    const payload = { ...itemForm, dictType: selectedType.value!.dictType }
    if (payload.id) await updateDictItem(payload)
    else await createDictItem(payload)
    ElMessage.success('保存成功')
    itemDrawerRef.value?.stopSaving(true)
    await loadItems()
  } catch {
    itemDrawerRef.value?.stopSaving(false)
    ElMessage.error('保存失败，请稍后重试')
  }
}
async function removeItem(row: SysDictItem) {
  await deleteDictItem(row.id!)
  await loadItems()
}

onMounted(() => {
  loadEnableStatusDict()
  listDictItems('dict_type_scope').then((rows) => {
    if (rows.length > 0) {
      scopeTypeItems.value = rows.map((r) => ({
        value: r.itemValue,
        label: r.itemLabel,
        tagType: (r.tagType || 'info') as TagKind
      }))
    }
  }).catch(() => {})
  loadTypes(false)
})
</script>

<style scoped>
.dict-page {
  display: flex;
  flex-direction: column;
}
.dict-body {
  display: flex;
  gap: 16px;
  height: calc(100vh - 160px);
  min-height: 420px;
}

/* 左侧类型面板 */
.dict-types {
  width: 260px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  border: 1px solid var(--el-border-color-lighter, #ebeef5);
  border-radius: var(--radius-base);
  padding: 8px;
  background: var(--el-bg-color);
}
.dict-types-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 4px 6px 8px;
  font-weight: 600;
  color: var(--ink);
}
.dict-types-search {
  margin-bottom: 8px;
}
.dict-types-scroll {
  flex: 1;
}
.dict-type-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 10px;
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: background 0.15s;
}
.dict-type-item:hover {
  background: var(--el-fill-color-light, #f5f7fa);
}
.dict-type-item.active {
  background: var(--el-color-primary-light-9, #ecf5ff);
}
.dict-type-main {
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.dict-type-name-row {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}
.dict-type-name {
  color: var(--ink);
  font-size: 14px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.dict-type-scope {
  flex-shrink: 0;
  transform: scale(0.9);
}
.dict-type-item.active .dict-type-name {
  color: var(--el-color-primary, #409eff);
  font-weight: 600;
}
.dict-type-code {
  color: var(--muted);
  font-size: 12px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.dict-type-ops {
  display: none;
  flex-shrink: 0;
}
.dict-type-item:hover .dict-type-ops {
  display: inline-flex;
}

/* 右侧字典项区域 */
.dict-items {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

/* 标题行（单独一行） */
.dict-items-header {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 16px;
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color-lighter, #ebeef5);
  border-radius: var(--radius-base);
}
.dict-readonly-tip,
.dict-readonly-text {
  color: var(--muted);
  font-size: 12px;
}
.dict-readonly-tip {
  margin-left: auto;
}
.dict-items-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--ink);
}
</style>
