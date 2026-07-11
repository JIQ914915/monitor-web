import { ref } from 'vue'
import { listDictItems } from '@/api/dict'
import type { SysDictItem } from '@/types'

export type DictTagType = '' | 'success' | 'warning' | 'danger' | 'info' | 'primary'

/** 模块级缓存，所有组件实例共享，避免重复请求。 */
const dictCache = new Map<string, SysDictItem[]>()
const dictPending = new Map<string, Promise<SysDictItem[]>>()

async function fetchDict(dictType: string): Promise<SysDictItem[]> {
  if (dictCache.has(dictType)) return dictCache.get(dictType)!
  if (dictPending.has(dictType)) return dictPending.get(dictType)!

  const promise = listDictItems(dictType)
    .then((items) => {
      // 空结果不缓存：字典可能尚未初始化（迁移未执行/刚重启），缓存空数组会导致
      // 本次会话内不再重试，页面一直显示原始编码
      if (items.length > 0) dictCache.set(dictType, items)
      dictPending.delete(dictType)
      return items
    })
    .catch(() => {
      dictPending.delete(dictType)
      return [] as SysDictItem[]
    })

  dictPending.set(dictType, promise)
  return promise
}

/** 清空指定字典的缓存（字典项被修改后调用）。 */
export function clearDictCache(...dictTypes: string[]) {
  dictTypes.forEach((dt) => {
    dictCache.delete(dt)
    dictPending.delete(dt)
  })
}

/**
 * 通用字典 composable。
 *
 * 用法：
 * ```ts
 * const { getDictItems, getDictLabel, getDictTagType } = useDict('alert_level', 'enable_status')
 * ```
 *
 * @param dictTypes 需要加载的字典类型编码列表，组件挂载时自动并发加载。
 */
export function useDict(...dictTypes: string[]) {
  const dictMap = ref<Record<string, SysDictItem[]>>({})

  async function loadDict(dictType: string) {
    const items = await fetchDict(dictType)
    dictMap.value = { ...dictMap.value, [dictType]: items }
  }

  /** 获取指定字典类型的全部项。 */
  function getDictItems(dictType: string): SysDictItem[] {
    return dictMap.value[dictType] ?? []
  }

  /** 根据字典值获取对应标签文本，无匹配时返回原值。 */
  function getDictLabel(dictType: string, value?: string | null): string {
    if (!value) return ''
    return getDictItems(dictType).find((i) => i.itemValue === value)?.itemLabel ?? value
  }

  /** 根据字典值获取对应 el-tag type，无匹配时返回空字符串。 */
  function getDictTagType(dictType: string, value?: string | null): DictTagType {
    if (!value) return ''
    return (getDictItems(dictType).find((i) => i.itemValue === value)?.tagType ?? '') as DictTagType
  }

  // 组件挂载时并发加载
  dictTypes.forEach((dt) => loadDict(dt))

  return { dictMap, getDictItems, getDictLabel, getDictTagType, loadDict }
}
