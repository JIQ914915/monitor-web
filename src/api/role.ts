import request from './request'
import type { PageParam, PageResult, SysRole } from '@/types'

export interface RoleQuery extends PageParam {
  keyword?: string
  type?: string
  status?: string
}

export function pageRoles(data: RoleQuery) {
  return request<PageResult<SysRole>>({ url: '/v1/roles/page', method: 'post', data })
}

export function listRoles() {
  return request<SysRole[]>({ url: '/v1/roles/list', method: 'get' })
}

export function createRole(data: SysRole) {
  return request<number>({ url: '/v1/roles', method: 'post', data })
}

export function updateRole(data: SysRole) {
  return request<void>({ url: '/v1/roles/update', method: 'post', data })
}

export function deleteRole(id: number) {
  return request<void>({ url: '/v1/roles/delete', method: 'post', data: { id } })
}

export function toggleRole(id: number, status: string) {
  return request<void>({ url: '/v1/roles/toggle', method: 'post', data: { id, status } })
}
