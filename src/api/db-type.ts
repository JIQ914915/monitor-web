import request from './request'
import type { DatabaseTypeMgmt, DatabaseVersionMgmt, DbTypeOption } from '@/types'

// ===== 数据库类型下拉（实例表单用，保持原有接口） =====

/** 启用的数据库类型选项（含默认端口与版本列表），供实例表单下拉动态获取。 */
export function listDbTypes() {
  return request<DbTypeOption[]>({ url: '/v1/database-types', method: 'get' })
}

// ===== 数据库类型管理 CRUD =====

export function listDbTypesAdmin() {
  return request<DatabaseTypeMgmt[]>({ url: '/v1/database-types/admin', method: 'get' })
}

export function createDbType(data: DatabaseTypeMgmt) {
  return request<number>({ url: '/v1/database-types/admin', method: 'post', data })
}

export function updateDbType(data: DatabaseTypeMgmt) {
  return request<void>({ url: '/v1/database-types/admin/update', method: 'post', data })
}

export function deleteDbType(id: number) {
  return request<void>({ url: '/v1/database-types/admin/delete', method: 'post', data: { id } })
}

// ===== 数据库版本管理 CRUD =====

export function listDbVersions(dbType?: string) {
  return request<DatabaseVersionMgmt[]>({
    url: '/v1/database-versions',
    method: 'get',
    params: dbType ? { dbType } : {}
  })
}

export function createDbVersion(data: DatabaseVersionMgmt) {
  return request<number>({ url: '/v1/database-versions', method: 'post', data })
}

export function updateDbVersion(data: DatabaseVersionMgmt) {
  return request<void>({ url: '/v1/database-versions/update', method: 'post', data })
}

export function deleteDbVersion(id: number) {
  return request<void>({ url: '/v1/database-versions/delete', method: 'post', data: { id } })
}
