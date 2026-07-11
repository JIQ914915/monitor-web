import type { RouteRecordRaw } from 'vue-router'

/** Layout 根路由名：动态菜单路由作为其 children 挂载（§11.11.7） */
export const LAYOUT_NAME = 'Layout'

/** 静态路由：登录、布局容器、常驻首页、404。其余由 permission store 动态注册。 */
export const constantRoutes: RouteRecordRaw[] = [
  {
    path: '/login',
    name: 'Login',
    component: () => import('@/views/login/index.vue'),
    meta: { title: '登录', public: true }
  },
  {
    path: '/',
    name: LAYOUT_NAME,
    component: () => import('@/layout/index.vue'),
    redirect: '/dashboard',
    children: [
      {
        path: 'dashboard',
        name: 'Dashboard',
        component: () => import('@/views/dashboard/index.vue'),
        meta: { title: '总览', icon: 'Odometer', affix: true }
      }
    ]
  },
  {
    // 不能标 public：否则刷新时未注册的动态路由会命中此兜底并被守卫直接放行，
    // 导致无法注册动态路由而卡在 404。去掉 public 后，守卫会先鉴权+注册动态路由再按 path 重试。
    path: '/:pathMatch(.*)*',
    name: 'NotFound',
    component: () => import('@/views/error/404.vue'),
    meta: { title: '页面不存在' }
  }
]
