import request from './request'
import type { PageParam, PageResult, SysUser, UserOption } from '@/types'

export interface UserQuery extends PageParam {
  keyword?: string
  roleCode?: string
  enabled?: boolean
}

export function pageUsers(data: UserQuery) {
  return request<PageResult<SysUser>>({ url: '/v1/users/page', method: 'post', data })
}

/** 用户选项（id + 展示名），供负责人/成员等下拉选择，替代借用分页接口。 */
export function listUserOptions() {
  return request<UserOption[]>({ url: '/v1/users/options', method: 'get' })
}

export function getUser(id: number) {
  return request<SysUser>({ url: '/v1/users/get', method: 'post', data: { id } })
}

export function createUser(data: SysUser) {
  return request<number>({ url: '/v1/users', method: 'post', data })
}

export function updateUser(data: SysUser) {
  return request<void>({ url: '/v1/users/update', method: 'post', data })
}

export function deleteUser(id: number) {
  return request<void>({ url: '/v1/users/delete', method: 'post', data: { id } })
}

export function toggleUser(id: number, enabled: boolean) {
  return request<void>({ url: '/v1/users/toggle', method: 'post', data: { id, enabled } })
}

export function resetUserPassword(id: number) {
  return request<void>({ url: '/v1/users/reset-password', method: 'post', data: { id } })
}
