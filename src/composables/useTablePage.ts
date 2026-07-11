import { ref } from 'vue'
import { ElMessageBox, ElMessage } from 'element-plus'
import type { FormInstance } from 'element-plus'
import { usePagination } from './usePagination'
import type { PageParam, PageResult } from '@/types'

/** 抽屉/弹窗模式：新增 / 编辑 / 查看（只读） */
type DialogMode = 'create' | 'edit' | 'view'

interface UseTablePageOptions<T, F extends PageParam> {
  /** 分页查询接口 */
  fetcher: (query: F) => Promise<PageResult<T>>
  /** 初始查询条件（含业务过滤字段） */
  initialQuery?: Partial<F>
  /** 删除接口；传入则 handleDelete 可用 */
  deleteFn?: (id: number) => Promise<unknown>
  /** 批量删除接口；传入则 handleBatchDelete 可用 */
  batchDeleteFn?: (ids: number[]) => Promise<unknown>
  /** 删除确认提示文字 */
  deleteConfirmMsg?: string
  /** 批量删除确认提示文字 */
  batchDeleteConfirmMsg?: string
}

/**
 * 通用表格页封装：在 usePagination 基础上增加弹窗（新增/编辑）、删除确认、
 * 多选等横切关注点，消除各列表页面的重复样板代码。
 *
 * @example
 * ```ts
 * const { query, list, total, loading, load, search, reset,
 *         dialogVisible, dialogMode, currentRow, submitLoading,
 *         openCreate, openEdit, closeDialog, handleDelete } =
 *   useTablePage({ fetcher: pageUsers, initialQuery: { keyword: '' }, deleteFn: deleteUser })
 * ```
 */
export function useTablePage<T extends { id: number }, F extends PageParam = PageParam>(
  options: UseTablePageOptions<T, F>
) {
  const {
    fetcher,
    initialQuery = {},
    deleteFn,
    batchDeleteFn,
    deleteConfirmMsg = '确认删除该条记录？删除后不可恢复。',
    batchDeleteConfirmMsg = '确认批量删除所选记录？删除后不可恢复。',
  } = options

  const pagination = usePagination<T, F>(fetcher, initialQuery as Partial<F>)

  const dialogVisible = ref(false)
  const dialogMode = ref<DialogMode>('create')
  const formRef = ref<FormInstance>()
  const submitLoading = ref(false)
  const currentRow = ref<T | null>(null)
  const selection = ref<T[]>([])

  function openCreate() {
    currentRow.value = null
    dialogMode.value = 'create'
    dialogVisible.value = true
  }

  function openEdit(row: T) {
    currentRow.value = { ...row }
    dialogMode.value = 'edit'
    dialogVisible.value = true
  }

  /** 以只读模式打开查看抽屉/弹窗 */
  function openView(row: T) {
    currentRow.value = { ...row }
    dialogMode.value = 'view'
    dialogVisible.value = true
  }

  function closeDialog() {
    dialogVisible.value = false
    formRef.value?.resetFields()
    currentRow.value = null
  }

  async function handleDelete(id: number) {
    if (!deleteFn) return
    try {
      await ElMessageBox.confirm(deleteConfirmMsg, '操作确认', {
        confirmButtonText: '确认删除',
        cancelButtonText: '取消',
        type: 'warning',
        confirmButtonClass: 'el-button--danger',
      })
    } catch {
      return
    }
    try {
      await deleteFn(id)
      ElMessage.success('删除成功')
      // 若当前页仅剩一条数据则退回上一页，避免空页
      if (pagination.list.value.length === 1 && pagination.query.pageNum > 1) {
        pagination.query.pageNum--
      }
      await pagination.load()
    } catch {
      // request.ts 统一处理接口报错
    }
  }

  async function handleBatchDelete() {
    if (!batchDeleteFn || !selection.value.length) return
    try {
      await ElMessageBox.confirm(batchDeleteConfirmMsg, '批量删除确认', {
        confirmButtonText: '确认删除',
        cancelButtonText: '取消',
        type: 'warning',
        confirmButtonClass: 'el-button--danger',
      })
    } catch {
      return
    }
    try {
      await batchDeleteFn(selection.value.map((r) => r.id))
      ElMessage.success('批量删除成功')
      selection.value = []
      await pagination.load()
    } catch {
      // 由 request.ts 统一处理接口报错
    }
  }

  function handleSelectionChange(rows: T[]) {
    selection.value = rows
  }

  return {
    // 分页相关（来自 usePagination）
    ...pagination,
    // 弹窗相关
    dialogVisible,
    dialogMode,
    formRef,
    submitLoading,
    currentRow,
    // 多选
    selection,
    // 操作方法
    openCreate,
    openEdit,
    openView,
    closeDialog,
    handleDelete,
    handleBatchDelete,
    handleSelectionChange,
  }
}
