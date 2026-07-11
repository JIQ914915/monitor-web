import { ref } from 'vue'
import { listDictItems } from '@/api/dict'

export type TagType = 'success' | 'warning' | 'danger' | 'info' | 'primary'

export interface StatusItem {
  value: string
  label: string
  tagType: TagType
}

/** 启用/停用状态字典兜底（字典 enable_status 不可用时使用）。 */
const FALLBACK_ENABLE_STATUS: StatusItem[] = [
  { value: 'enabled', label: '启用', tagType: 'success' },
  { value: 'disabled', label: '停用', tagType: 'info' }
]

/**
 * 启用/停用状态字典（enable_status）：统一菜单/角色/字典等模块的状态标签与颜色，
 * 避免各页面硬编码「启用/停用」文案与 tag 颜色。字典不可用时回退内置项。
 */
export function useEnableStatusDict() {
  const statusItems = ref<StatusItem[]>([...FALLBACK_ENABLE_STATUS])

  function statusMeta(v?: string) {
    return statusItems.value.find((x) => x.value === v)
  }
  function statusLabel(v?: string): string {
    return statusMeta(v)?.label || v || ''
  }
  function statusTag(v?: string): TagType {
    return statusMeta(v)?.tagType || 'info'
  }

  async function loadEnableStatusDict() {
    try {
      const rows = await listDictItems('enable_status')
      if (rows.length) {
        statusItems.value = rows.map((r) => ({
          value: r.itemValue,
          label: r.itemLabel,
          tagType: (r.tagType || 'info') as TagType
        }))
      }
    } catch {
      // 字典读取失败时保留内置兜底
    }
  }

  return { statusItems, statusMeta, statusLabel, statusTag, loadEnableStatusDict }
}
