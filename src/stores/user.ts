import { defineStore } from 'pinia'
import type { UserInfo } from '@/types'
import { login as loginApi, getUserInfo } from '@/api/auth'
import { useThemeStore } from './theme'
import { usePermissionStore } from './permission'

interface UserState {
  token: string
  info: UserInfo | null
}

export const useUserStore = defineStore('user', {
  state: (): UserState => ({
    token: '',
    info: null
  }),
  getters: {
    roles: (s): string[] => s.info?.roles ?? [],
    /** 多角色权限并集（§5.5） */
    permissions: (s): string[] => s.info?.permissions ?? []
  },
  actions: {
    async login(username: string, password: string) {
      const { token } = await loginApi(username, password)
      this.token = token
    },
    async loadInfo() {
      this.info = await getUserInfo()
      // 加载账号级主题偏好（系统默认 + 用户覆盖，§8.5）
      useThemeStore().loadRemote()
      return this.info
    },
    /** 按钮级权限校验（menu:action，§11.11.6） */
    hasPermission(code: string): boolean {
      return this.permissions.includes('*:*') || this.permissions.includes(code)
    },
    hasRole(role: string): boolean {
      return this.roles.includes(role)
    },
    logout() {
      this.token = ''
      this.info = null
      // 重置权限/动态路由状态，下次登录会重新生成菜单与路由（避免换账号后沿用旧路由）
      usePermissionStore().reset()
    }
  },
  persist: {
    pick: ['token']
  }
})
