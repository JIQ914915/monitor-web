import { createRouter, createWebHistory } from 'vue-router'
import { constantRoutes, LAYOUT_NAME } from './routes'
import { useUserStore } from '@/stores/user'
import { usePermissionStore } from '@/stores/permission'

const router = createRouter({
  history: createWebHistory(),
  routes: constantRoutes,
  scrollBehavior: () => ({ top: 0 })
})

// 全局守卫：鉴权 + 用户信息 + 动态菜单路由注册
router.beforeEach(async (to) => {
  const userStore = useUserStore()
  if (to.meta.public) return true

  if (!userStore.token) {
    return { path: '/login', query: { redirect: to.fullPath } }
  }

  if (!userStore.info) {
    try {
      await userStore.loadInfo()
    } catch {
      userStore.logout()
      return { path: '/login' }
    }
  }

  const permissionStore = usePermissionStore()
  if (!permissionStore.loaded) {
    const routes = await permissionStore.generateRoutes()
    routes.forEach((r) => router.addRoute(LAYOUT_NAME, r))
    // 动态路由刚注册，按 path 重新解析以命中新路由。
    // 注意：不能用 { ...to }，否则会把首次匹配到的 NotFound 的 name 带上，
    // vue-router 解析时 name 优先级高于 path，会再次落回 404。
    return { path: to.path, query: to.query, hash: to.hash, replace: true }
  }
  return true
})

router.afterEach((to) => {
  const base = import.meta.env.VITE_APP_TITLE || '数据库监控平台'
  document.title = to.meta.title ? `${to.meta.title as string} · ${base}` : base
})

export default router
