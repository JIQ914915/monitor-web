import { defineStore } from 'pinia'
import type { RouteLocationNormalized } from 'vue-router'

export interface TagView {
  path: string
  fullPath: string
  title: string
  name?: string
  affix?: boolean
}

interface TagsViewState {
  visited: TagView[]
}

export const useTagsViewStore = defineStore('tagsView', {
  state: (): TagsViewState => ({
    visited: []
  }),
  actions: {
    addView(route: RouteLocationNormalized) {
      if (route.meta.public) return
      if (this.visited.some((v) => v.path === route.path)) return
      this.visited.push({
        path: route.path,
        fullPath: route.fullPath,
        title: (route.meta.title as string) || '未命名',
        name: route.name as string | undefined,
        affix: Boolean(route.meta.affix)
      })
    },
    removeView(path: string): TagView | undefined {
      const idx = this.visited.findIndex((v) => v.path === path)
      if (idx === -1) return
      const removed = this.visited[idx]
      if (removed.affix) return
      this.visited.splice(idx, 1)
      return this.visited[idx] || this.visited[idx - 1]
    },
    closeOthers(path: string) {
      this.visited = this.visited.filter((v) => v.affix || v.path === path)
    },
    closeLeft(path: string) {
      const idx = this.visited.findIndex((v) => v.path === path)
      if (idx === -1) return
      this.visited = this.visited.filter((v, i) => v.affix || i >= idx)
    },
    closeRight(path: string) {
      const idx = this.visited.findIndex((v) => v.path === path)
      if (idx === -1) return
      this.visited = this.visited.filter((v, i) => v.affix || i <= idx)
    },
    closeAll() {
      this.visited = this.visited.filter((v) => v.affix)
    },
    /** 切换实例后关闭全部实例级页面标签（/monitor/** 各类型分组页）。 */
    closeInstanceScoped() {
      this.visited = this.visited.filter((v) => v.affix || !v.path.startsWith('/monitor/'))
    }
  }
})
