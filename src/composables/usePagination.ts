import { reactive, ref, type Ref } from 'vue'
import type { PageParam, PageResult } from '@/types'

export interface UsePaginationReturn<T, Q extends PageParam> {
  /** 响应式查询条件（含 pageNum/pageSize + 业务过滤项） */
  query: Q
  list: Ref<T[]>
  total: Ref<number>
  loading: Ref<boolean>
  /** 按当前 query 拉取（分页器翻页/改页大小时调用） */
  load: () => Promise<void>
  /** 重新查询：重置到第 1 页再拉取（条件变更/点查询时调用） */
  search: () => Promise<void>
  /** 重置过滤条件为初始值并重新查询 */
  reset: () => Promise<void>
}

/**
 * 通用分页查询封装：统一管理 query / list / total / loading 与翻页逻辑，
 * 配合 Pagination.vue 与 POST 分页接口（fetcher）复用，避免各列表页重复样板。
 */
export function usePagination<T, Q extends PageParam = PageParam>(
  fetcher: (query: Q) => Promise<PageResult<T>>,
  initial: Partial<Q> = {}
): UsePaginationReturn<T, Q> {
  const query = reactive({ pageNum: 1, pageSize: 10, ...initial }) as Q
  const list = ref<T[]>([]) as Ref<T[]>
  const total = ref(0)
  const loading = ref(false)

  async function load() {
    loading.value = true
    try {
      const res = await fetcher(query)
      list.value = res.list
      total.value = res.total
    } finally {
      loading.value = false
    }
  }

  function search() {
    query.pageNum = 1
    return load()
  }

  function reset() {
    Object.keys(initial).forEach((k) => {
      ;(query as Record<string, unknown>)[k] = (initial as Record<string, unknown>)[k]
    })
    query.pageNum = 1
    return load()
  }

  return { query, list, total, loading, load, search, reset }
}
