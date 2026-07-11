import { defineStore } from 'pinia'
import type { DbInstance } from '@/types'

interface InstanceState {
  /** 当前选中实例（前端围绕“当前实例”动线，方案 §8.4） */
  current: DbInstance | null
  /** 最近访问实例 id */
  recentIds: number[]
  /** 收藏实例 id */
  favoriteIds: number[]
}

export const useInstanceStore = defineStore('instance', {
  state: (): InstanceState => ({
    current: null,
    recentIds: [],
    favoriteIds: []
  }),
  actions: {
    setCurrent(ins: DbInstance) {
      this.current = ins
      this.recentIds = [ins.id, ...this.recentIds.filter((i) => i !== ins.id)].slice(0, 8)
    },
    toggleFavorite(id: number) {
      this.favoriteIds = this.favoriteIds.includes(id)
        ? this.favoriteIds.filter((i) => i !== id)
        : [...this.favoriteIds, id]
    }
  },
  persist: {
    // current 一并持久化：刷新页面后保持选中实例（状态等字段可能略旧，各页面按 id 重新拉数据）
    pick: ['current', 'recentIds', 'favoriteIds']
  }
})
