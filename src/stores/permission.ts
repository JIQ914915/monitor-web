import { defineStore } from 'pinia'
import type { RouteRecordRaw } from 'vue-router'
import type { MenuNode } from '@/types'
import { getMenuTree } from '@/api/menu'

// 预扫描 views 下所有页面组件，供动态路由按 component 字段解析
const viewModules = import.meta.glob('../views/**/*.vue')

function loadView(component?: string) {
  if (component) {
    // 规范：每个页面都是 views/{component}/index.vue 目录结构
    const key = `../views/${component}/index.vue`
    if (viewModules[key]) return viewModules[key]
  }
  // 未实现的页面统一用占位页兜底（脚手架阶段）
  return viewModules['../views/common/Placeholder.vue']
}

function toRoute(node: MenuNode): RouteRecordRaw {
  const route: RouteRecordRaw = {
    path: node.path,
    name: node.name,
    redirect: node.redirect,
    meta: { ...node.meta },
    children: node.children?.map(toRoute)
  } as RouteRecordRaw
  if (node.component || !node.children?.length) {
    route.component = loadView(node.component)
  }
  return route
}

interface PermissionState {
  loaded: boolean
  menus: MenuNode[]
  routes: RouteRecordRaw[]
}

export const usePermissionStore = defineStore('permission', {
  state: (): PermissionState => ({
    loaded: false,
    menus: [],
    routes: []
  }),
  actions: {
    async generateRoutes(): Promise<RouteRecordRaw[]> {
      const menus = await getMenuTree()
      this.menus = menus
      this.routes = menus.map(toRoute)
      this.loaded = true
      return this.routes
    },
    /** 仅刷新侧边/顶栏菜单展示（标题/图标/显隐），不重建已注册的动态路由。菜单管理保存后调用。 */
    async refreshMenus(): Promise<void> {
      this.menus = await getMenuTree()
    },
    reset() {
      this.loaded = false
      this.menus = []
      this.routes = []
    }
  }
})
