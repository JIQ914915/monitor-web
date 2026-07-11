import request from './request'
import type { PageParam, PageResult, SysMenu } from '@/types'

export interface MenuQuery extends PageParam {
  keyword?: string
}

export function pageMenus(data: MenuQuery) {
  return request<PageResult<SysMenu>>({ url: '/v1/menus/page', method: 'post', data })
}

export function listMenus() {
  return request<SysMenu[]>({ url: '/v1/menus/list', method: 'get' })
}

export function createMenu(data: SysMenu) {
  return request<number>({ url: '/v1/menus', method: 'post', data })
}

export function updateMenu(data: SysMenu) {
  return request<void>({ url: '/v1/menus/update', method: 'post', data })
}

export function deleteMenu(id: number) {
  return request<void>({ url: '/v1/menus/delete', method: 'post', data: { id } })
}

export function toggleMenu(id: number, status: string) {
  return request<void>({ url: '/v1/menus/toggle', method: 'post', data: { id, status } })
}
