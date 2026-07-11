import request from './request'
import type { MenuNode } from '@/types'

/** 获取当前用户的菜单树（按多角色权限并集过滤，§5.5 / §11.11.7） */
export function getMenuTree() {
  return request<MenuNode[]>({ url: '/v1/auth/menus', method: 'get' })
}
