<template>
  <div ref="containerRef" :class="['pro-table', { 'is-fullscreen': isFullscreen, 'is-embedded': embedded }]">

    <!-- ① 搜索区 ─────────────────────────────────────────────────── -->
    <el-card v-if="$slots.search" shadow="never" class="search-card">
      <el-form :inline="true" class="search-form-wrap" @submit.prevent="onSearch">
        <!-- 搜索条件（可折叠） -->
        <div ref="searchItemsRef" :class="['search-items', { 'search-items--collapsed': searchCollapsed && canCollapse }]">
          <slot name="search" />
        </div>
        <!-- 查询 / 重置 / 展开收起（始终右对齐） -->
        <el-form-item class="search-btns">
          <el-button type="primary" :icon="Search" :loading="loading" native-type="submit">查询</el-button>
          <el-button :icon="RefreshLeft" @click="onReset">重置</el-button>
          <el-button
            v-if="collapsible && canCollapse"
            link
            type="primary"
            :icon="searchCollapsed ? ArrowDown : ArrowUp"
            @click="searchCollapsed = !searchCollapsed"
          >{{ searchCollapsed ? '展开' : '收起' }}</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <!-- ② 列表区 ─────────────────────────────────────────────────── -->
    <el-card shadow="never" class="table-card">

      <!-- 工具栏 -->
      <div v-if="showToolbar" class="toolbar">

        <!-- 左：操作按钮 -->
        <div class="toolbar-left">
          <el-button v-if="showAdd" type="primary" :icon="Plus" @click="emit('add')">{{ addText }}</el-button>
          <el-button v-if="showImport" :icon="Upload" @click="emit('import')">导入</el-button>
          <el-button v-if="showExport" :icon="Download" @click="emit('export')">导出</el-button>

          <!-- 批量删除：有选中时才高亮可用 -->
          <template v-if="showBatchDelete">
            <el-button
              type="danger"
              :icon="Delete"
              :disabled="!selectedRows.length"
              @click="handleBatchDelete"
            >批量删除</el-button>
          </template>

          <!-- 自定义工具栏 -->
          <slot name="toolbar" />
        </div>

        <!-- 右：设置按钮组 -->
        <div class="toolbar-right">
          <slot name="toolbar-right" />

          <!-- 刷新 -->
          <el-tooltip content="刷新" placement="top">
            <el-button :icon="Refresh" circle @click="onSearch" />
          </el-tooltip>

          <!-- 密度 -->
          <el-dropdown
            v-if="showDensity"
            trigger="click"
            @command="(v: DensitySize) => density = v"
          >
            <el-button :icon="Grid" circle title="密度" />
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item command="large">
                  <el-icon v-if="density === 'large'"><Check /></el-icon>
                  <span :class="{ 'menu-item-active': density === 'large' }">宽松</span>
                </el-dropdown-item>
                <el-dropdown-item command="">
                  <el-icon v-if="density === ''"><Check /></el-icon>
                  <span :class="{ 'menu-item-active': density === '' }">默认</span>
                </el-dropdown-item>
                <el-dropdown-item command="small">
                  <el-icon v-if="density === 'small'"><Check /></el-icon>
                  <span :class="{ 'menu-item-active': density === 'small' }">紧凑</span>
                </el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>

          <!-- 列设置 -->
          <el-popover
            v-if="showColumnSettings"
            v-model:visible="colSettingsVisible"
            trigger="click"
            :width="220"
            placement="bottom-end"
            popper-class="col-settings-pop"
          >
            <template #reference>
              <el-button :icon="Setting" circle title="列设置" />
            </template>
            <div class="col-settings">
              <div class="col-settings-header">
                <el-checkbox
                  :model-value="allColsVisible"
                  :indeterminate="someColsHidden"
                  @change="toggleAllCols"
                >全选</el-checkbox>
                <el-button link type="primary" size="small" @click="resetColSettings">重置</el-button>
              </div>
              <el-divider style="margin: 8px 0" />
              <div
                v-for="col in settableColumns"
                :key="colKey(col)"
                class="col-item"
              >
                <el-checkbox
                  :model-value="!hiddenCols.has(colKey(col))"
                  @change="(v: CheckboxValueType) => toggleCol(colKey(col), v)"
                >{{ col.label }}</el-checkbox>
              </div>
            </div>
          </el-popover>

          <!-- 全屏 -->
          <el-tooltip v-if="showFullscreen" :content="isFullscreen ? '退出全屏' : '全屏'" placement="top">
            <el-button :icon="isFullscreen ? Rank : FullScreen" circle @click="toggleFullscreen" />
          </el-tooltip>
        </div>
      </div>

      <!-- 选中提示条 -->
      <transition name="selection-tip">
        <div v-if="selectedRows.length" class="selection-tip">
          <el-icon color="var(--el-color-primary)"><InfoFilled /></el-icon>
          <span>已选 <strong>{{ selectedRows.length }}</strong> 条</span>
          <el-button link size="small" @click="clearSelection">取消选择</el-button>
          <slot name="selection-actions" :rows="selectedRows" />
        </div>
      </transition>

      <!-- 表格 -->
      <el-table
        :key="tableRenderKey"
        ref="tableRef"
        v-loading="loading"
        :data="data"
        :stripe="stripe"
        :border="border"
        :size="density || undefined"
        :max-height="maxHeight"
        :height="height"
        :row-key="rowKey"
        :tree-props="treeProps"
        :default-expand-all="defaultExpandAll"
        :highlight-current-row="highlightCurrentRow"
        style="width: 100%"
        @selection-change="onSelectionChange"
        @row-click="(row: any) => emit('row-click', row)"
        @sort-change="(args: any) => emit('sort-change', args)"
      >
        <!-- 多选 -->
        <el-table-column v-if="showSelection" type="selection" width="45" :reserve-selection="!!rowKey" />
        <!-- 序号 -->
        <el-table-column v-if="showIndex" type="index" label="#" width="55" align="center" />

        <!-- 数据列 -->
        <template v-for="col in visibleColumns" :key="colKey(col)">
          <el-table-column
            :prop="col.prop"
            :label="col.label"
            :width="col.width"
            :min-width="col.minWidth ?? 100"
            :align="col.align ?? 'left'"
            :header-align="col.headerAlign ?? col.align ?? 'left'"
            :fixed="col.fixed"
            :show-overflow-tooltip="col.showOverflowTooltip ?? true"
            :sortable="col.sortable"
          >
            <template v-if="col.slot || col.formatter" #default="scope">
              <slot v-if="col.slot" :name="col.slot" v-bind="scope" />
              <span v-else-if="col.formatter">{{ col.formatter(scope.row) }}</span>
            </template>
          </el-table-column>
        </template>

        <!-- 操作列 -->
        <el-table-column
          v-if="showOperation && ($slots.operation || hasAnyDefaultOperation)"
          label="操作"
          :width="resolvedOperationWidth"
          fixed="right"
          align="center"
        >
          <template #default="scope">
            <slot
              v-if="$slots.operation"
              name="operation"
              v-bind="{ ...scope, confirmDelete: handleDelete }"
            />
            <template v-else>
              <el-button v-if="hasViewListener" link type="primary" size="small" @click="emit('view', scope.row)">详情</el-button>
              <el-button v-if="hasEditListener" link type="primary" size="small" @click="emit('edit', scope.row)">编辑</el-button>
              <el-button v-if="hasDeleteAction" link type="danger"  size="small" @click="handleDelete(scope.row)">删除</el-button>
            </template>
          </template>
        </el-table-column>

        <!-- 空状态 -->
        <template #empty>
          <slot name="empty">
            <el-empty description="暂无数据" :image-size="80" />
          </slot>
        </template>
      </el-table>

      <!-- 分页 -->
      <Pagination
        v-if="showPagination && total > 0"
        v-model:page-num="currentPageNum"
        v-model:page-size="currentPageSize"
        :total="total"
        :page-sizes="pageSizes"
        @change="emit('page-change')"
      />
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted, onBeforeUnmount, getCurrentInstance } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import type { CheckboxValueType, TableInstance } from 'element-plus'
import {
  Plus, Delete, Search, Refresh, RefreshLeft, Upload, Download,
  Setting, FullScreen, Rank, Grid, ArrowDown, ArrowUp, InfoFilled, Check,
} from '@element-plus/icons-vue'
import Pagination from '@/components/Pagination.vue'
import type { TableColumn } from './types'

// ── 类型 ─────────────────────────────────────────────────────────────────────
type DensitySize = 'large' | '' | 'small'

// ── Props ────────────────────────────────────────────────────────────────────
const props = withDefaults(defineProps<{
  data: any[]
  columns: TableColumn[]
  loading?: boolean
  total?: number
  // 多选 / 序号 / 操作列
  showSelection?: boolean
  showIndex?: boolean
  showOperation?: boolean
  /** 操作列宽度；不传时使用默认值，可按页面覆盖 */
  operationWidth?: number | string
  // 分页
  showPagination?: boolean
  pageNum?: number
  pageSize?: number
  pageSizes?: number[]
  // 表格样式
  stripe?: boolean
  border?: boolean
  maxHeight?: string | number
  height?: string | number
  rowKey?: string
  treeProps?: Record<string, string>
  defaultExpandAll?: boolean
  highlightCurrentRow?: boolean
  /** 嵌入模式：平铺进已有卡片（去掉自带卡片边框、阴影和内边距） */
  embedded?: boolean
  // 工具栏整体
  showToolbar?: boolean
  // 工具栏：内置按钮
  showAdd?: boolean
  addText?: string
  showBatchDelete?: boolean
  showImport?: boolean
  showExport?: boolean
  // 工具栏：右侧设置按钮
  showDensity?: boolean
  showColumnSettings?: boolean
  showFullscreen?: boolean
  // 搜索折叠
  collapsible?: boolean
  defaultCollapsed?: boolean
  // 确认文字
  deleteConfirmMsg?: string | ((row: any) => string)
  batchDeleteConfirmMsg?: string
  // 可选：由表格统一执行删除请求（用于封装确认+提示）
  deleteRequest?: (row: any) => Promise<void> | void
  batchDeleteRequest?: (rows: any[]) => Promise<void> | void
  deleteSuccessMsg?: string | ((row: any) => string) | false
  batchDeleteSuccessMsg?: string | ((rows: any[]) => string) | false
}>(), {
  loading: false,
  total: 0,
  showSelection: false,
  showIndex: false,
  showOperation: true,
  operationWidth: 160,
  showPagination: true,
  pageNum: 1,
  pageSize: 10,
  pageSizes: () => [10, 20, 50, 100],
  stripe: true,
  border: true,
  highlightCurrentRow: false,
  embedded: false,
  showToolbar: true,
  showAdd: true,
  addText: '新增',
  showBatchDelete: false,
  showImport: false,
  showExport: false,
  showDensity: true,
  showColumnSettings: true,
  showFullscreen: true,
  collapsible: false,
  defaultCollapsed: false,
  deleteConfirmMsg: '确认删除该条记录？删除后不可恢复。',
  batchDeleteConfirmMsg: '确认批量删除所选记录？删除后不可恢复。',
  deleteSuccessMsg: '删除成功',
  batchDeleteSuccessMsg: '删除成功',
})

// ── Emits ────────────────────────────────────────────────────────────────────
const emit = defineEmits<{
  search: []
  reset: []
  add: []
  edit: [row: any]
  view: [row: any]
  delete: [row: any]
  'batch-delete': [rows: any[]]
  import: []
  export: []
  'selection-change': [rows: any[]]
  'page-change': []
  'row-click': [row: any]
  'sort-change': [args: any]
  'update:pageNum': [v: number]
  'update:pageSize': [v: number]
}>()

const instance = getCurrentInstance()
const hasViewListener = computed(() => !!instance?.vnode.props?.onView)
const hasEditListener = computed(() => !!instance?.vnode.props?.onEdit)
const hasDeleteListener = computed(() => !!instance?.vnode.props?.onDelete)
const hasDeleteAction = computed(() => hasDeleteListener.value || !!props.deleteRequest)
const hasAnyDefaultOperation = computed(
  () => hasViewListener.value || hasEditListener.value || hasDeleteAction.value
)

// ── 树形表格展开 key（defaultExpandAll 变化时强制重渲染 el-table）────────────────
const tableRenderKey = ref(0)
watch(() => props.defaultExpandAll, () => { tableRenderKey.value++ })

// ── 操作列宽度（默认值 + 可覆盖）──────────────────────────────────────────────
const DEFAULT_OPERATION_WIDTH = 160
const resolvedOperationWidth = computed(() => {
  if (props.operationWidth === '' || props.operationWidth === undefined || props.operationWidth === null) {
    return DEFAULT_OPERATION_WIDTH
  }
  return props.operationWidth
})

// ── 分页双向绑定 ───────────────────────────────────────────────────────────────
const currentPageNum = computed({
  get: () => props.pageNum,
  set: (v) => emit('update:pageNum', v),
})
const currentPageSize = computed({
  get: () => props.pageSize,
  set: (v) => emit('update:pageSize', v),
})

// ── 搜索折叠 ──────────────────────────────────────────────────────────────────
const searchCollapsed = ref(props.defaultCollapsed)
const searchItemsRef = ref<HTMLElement>()
const canCollapse = ref(false)
let searchResizeObserver: ResizeObserver | undefined

function updateSearchCollapsible() {
  const element = searchItemsRef.value
  if (!props.collapsible || !element) {
    canCollapse.value = false
    return
  }
  const firstItem = element.querySelector<HTMLElement>('.el-form-item')
  const firstRowHeight = firstItem?.offsetHeight || 32
  canCollapse.value = element.scrollHeight > firstRowHeight + 2
}

function onSearch() { emit('search') }
function onReset() { emit('reset') }

// ── 多选 ─────────────────────────────────────────────────────────────────────
const tableRef = ref<TableInstance>()
const selectedRows = ref<any[]>([])

function onSelectionChange(rows: any[]) {
  selectedRows.value = rows
  emit('selection-change', rows)
}

function clearSelection() {
  tableRef.value?.clearSelection()
  selectedRows.value = []
}

// ── 删除确认 ──────────────────────────────────────────────────────────────────
async function handleDelete(row: any) {
  const msg = typeof props.deleteConfirmMsg === 'function'
    ? props.deleteConfirmMsg(row)
    : props.deleteConfirmMsg
  try {
    await ElMessageBox.confirm(msg, '删除确认', {
      confirmButtonText: '确认删除',
      cancelButtonText: '取消',
      type: 'warning',
      confirmButtonClass: 'el-button--danger',
    })
  } catch { return }
  if (props.deleteRequest) {
    await props.deleteRequest(row)
    const successMsg = typeof props.deleteSuccessMsg === 'function'
      ? props.deleteSuccessMsg(row)
      : props.deleteSuccessMsg
    if (successMsg) ElMessage.success(successMsg)
    return
  }
  emit('delete', row)
}

async function handleBatchDelete() {
  if (!selectedRows.value.length) return
  try {
    await ElMessageBox.confirm(props.batchDeleteConfirmMsg, '批量删除确认', {
      confirmButtonText: '确认删除',
      cancelButtonText: '取消',
      type: 'warning',
      confirmButtonClass: 'el-button--danger',
    })
  } catch { return }
  if (props.batchDeleteRequest) {
    await props.batchDeleteRequest(selectedRows.value)
    const successMsg = typeof props.batchDeleteSuccessMsg === 'function'
      ? props.batchDeleteSuccessMsg(selectedRows.value)
      : props.batchDeleteSuccessMsg
    if (successMsg) ElMessage.success(successMsg)
    clearSelection()
    return
  }
  emit('batch-delete', selectedRows.value)
}

// ── 列设置 ────────────────────────────────────────────────────────────────────
/** 列的唯一 key */
function colKey(col: TableColumn) { return col.prop ?? col.label }

/** 可以设置显示/隐藏的列（不包含特殊列） */
const settableColumns = computed(() => props.columns)

/** 当前隐藏的列 key 集合 */
const hiddenCols = ref<Set<string>>(
  new Set(props.columns.filter((c) => c.hide).map(colKey))
)

/** 监听 columns 变化时重新初始化 */
watch(() => props.columns, (cols) => {
  hiddenCols.value = new Set(cols.filter((c) => c.hide).map(colKey))
})

const visibleColumns = computed(() =>
  props.columns.filter((c) => !hiddenCols.value.has(colKey(c)))
)

const allColsVisible = computed(() => hiddenCols.value.size === 0)
const someColsHidden = computed(() =>
  hiddenCols.value.size > 0 && hiddenCols.value.size < props.columns.length
)

// CheckboxValueType 兼容 string|number|boolean，这里语义上只会是 boolean
function toggleCol(key: string, visible: CheckboxValueType) {
  const set = new Set(hiddenCols.value)
  visible ? set.delete(key) : set.add(key)
  hiddenCols.value = set
}

function toggleAllCols(v: CheckboxValueType) {
  hiddenCols.value = v ? new Set() : new Set(props.columns.map(colKey))
}

function resetColSettings() {
  hiddenCols.value = new Set(props.columns.filter((c) => c.hide).map(colKey))
}

const colSettingsVisible = ref(false)

// ── 密度 ─────────────────────────────────────────────────────────────────────
const density = ref<DensitySize>('')

// ── 全屏 ─────────────────────────────────────────────────────────────────────
const containerRef = ref<HTMLElement>()
const isFullscreen = ref(false)

function toggleFullscreen() {
  if (document.fullscreenElement) {
    document.exitFullscreen()
  } else {
    containerRef.value?.requestFullscreen?.()
  }
}

function onFullscreenChange() {
  isFullscreen.value = !!document.fullscreenElement
}

onMounted(async () => {
  document.addEventListener('fullscreenchange', onFullscreenChange)
  await nextTick()
  updateSearchCollapsible()
  if (searchItemsRef.value && typeof ResizeObserver !== 'undefined') {
    searchResizeObserver = new ResizeObserver(updateSearchCollapsible)
    searchResizeObserver.observe(searchItemsRef.value)
  }
})
onBeforeUnmount(() => {
  document.removeEventListener('fullscreenchange', onFullscreenChange)
  searchResizeObserver?.disconnect()
})

// ── 暴露 ─────────────────────────────────────────────────────────────────────
defineExpose({ clearSelection, selectedRows, tableRef })
</script>

<style scoped>
.pro-table {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

/* 全屏模式 */
.pro-table.is-fullscreen {
  position: fixed;
  inset: 0;
  z-index: 9999;
  background: var(--el-bg-color);
  padding: 12px;
  overflow-y: auto;
  gap: 12px;
}

/* 嵌入模式：平铺进外层卡片 */
.pro-table.is-embedded .table-card {
  border: none;
  box-shadow: none;
  border-radius: 0;
}
.pro-table.is-embedded .table-card :deep(.el-card__body) {
  padding: 0;
}
.pro-table.is-embedded :deep(.el-table__body-wrapper) {
  max-height: none;
  overflow-y: visible;
}

/* 搜索区 ─────────────────────────────── */
.search-card :deep(.el-card__body) {
  padding: 12px 20px;
}

/* 消除 el-form-item 默认 margin-bottom（校验提示在 search 场景不需要占位） */
.search-card :deep(.el-form-item) {
  margin-bottom: 0;
}

/* 搜索条件与按钮分区布局，避免控件和按钮进入同一个换行流。 */
.search-form-wrap {
  display: grid !important;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: start;
  column-gap: 24px;
  row-gap: 12px;
  width: 100%;
}

.search-items {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px 20px;
  min-width: 0;
}

.search-items :deep(.el-form-item) {
  margin-right: 0;
  min-width: 0;
}

/* 折叠时保留首行常用条件，通过按钮可展开全部条件。 */
.search-items--collapsed {
  max-height: 32px;
  overflow: hidden;
}

.search-btns {
  margin-left: 0 !important;
  margin-right: 0 !important;
  min-height: 32px;
  flex-shrink: 0;
}

.search-btns :deep(.el-form-item__content) {
  flex-wrap: nowrap;
}

@media (max-width: 900px) {
  .search-form-wrap {
    grid-template-columns: minmax(0, 1fr);
  }

  .search-btns {
    justify-self: end;
  }
}
/* 工具栏 ─────────────────────────────── */
.toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 0;
  border-top: 1px solid var(--el-border-color-lighter);
  border-bottom: 1px solid var(--el-border-color-lighter);
  flex-wrap: wrap;
  gap: 8px;
}

/* 分割线与表头之间的间距 */
.pro-table :deep(.el-table) {
  margin-top: 8px;
}

.toolbar-left,
.toolbar-right {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

/* 选中提示条 ─────────────────────────── */
.selection-tip {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  margin-bottom: 10px;
  background: var(--el-color-primary-light-9);
  border: 1px solid var(--el-color-primary-light-7);
  border-radius: var(--radius-sm);
  font-size: 13px;
  color: var(--el-text-color-regular);
}

.selection-tip strong {
  color: var(--el-color-primary);
}

.selection-tip-enter-active,
.selection-tip-leave-active {
  transition: all 0.25s ease;
}
.selection-tip-enter-from,
.selection-tip-leave-to {
  opacity: 0;
  transform: translateY(-6px);
}

/* 列设置弹出层 ────────────────────────── */
.col-settings {
  padding: 4px 0;
}

.col-settings-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.col-item {
  padding: 4px 0;
}

/* 密度菜单激活态 ──────────────────────── */
.menu-item-active {
  color: var(--el-color-primary);
  font-weight: 500;
}

/* 表格多选框：保持方形，与单选框区分 */
.pro-table :deep(.el-checkbox__inner) {
  border-radius: 2px !important;
}

/* 表头背景 */
.pro-table :deep(.el-table__header-wrapper th.el-table__cell) {
  background-color: var(--el-fill-color-light);
  color: var(--el-text-color-regular);
  font-weight: 600;
}
</style>
