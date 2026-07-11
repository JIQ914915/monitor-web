import request from './request'
import type { PageParam, PageResult } from '@/types'

/** 主机（host 表，主机指标采集配置）。 */
export interface MonitorHost {
  id?: number
  hostCode?: string
  name: string
  ip: string
  osType?: string
  /** 采集方式（字典 host_collect_mode）：exporter / ssh / none */
  collectMode: string
  exporterPort?: number | null
  exporterPath?: string
  remark?: string
  /** 状态（字典 host_status）：normal / abnormal / paused */
  status: string
  /** 关联实例数（后端解析，只读） */
  instanceCount?: number
  createTime?: string
  updateTime?: string
}

/** 主机下拉选项。 */
export interface HostOption {
  id: number
  name: string
  ip: string
  /** 操作系统类型（字典 host_os_type）：linux / windows */
  osType?: string
}

export interface HostQuery extends PageParam {
  keyword?: string
  status?: string
  collectMode?: string
}

export function pageHosts(data: HostQuery) {
  return request<PageResult<MonitorHost>>({ url: '/v1/hosts/page', method: 'post', data })
}

export function getHost(id: number) {
  return request<MonitorHost>({ url: '/v1/hosts/get', method: 'post', data: { id } })
}

export function listHostOptions() {
  return request<HostOption[]>({ url: '/v1/hosts/options', method: 'post', data: {} })
}

export function createHost(data: MonitorHost) {
  return request<number>({ url: '/v1/hosts', method: 'post', data })
}

export function updateHost(data: MonitorHost) {
  return request<void>({ url: '/v1/hosts/update', method: 'post', data })
}

export function deleteHost(id: number) {
  return request<void>({ url: '/v1/hosts/delete', method: 'post', data: { id } })
}

export function toggleHost(id: number, status: string) {
  return request<void>({ url: '/v1/hosts/toggle', method: 'post', data: { id, status } })
}

/** exporter 连通性测试，成功返回版本描述文本；传 osType 时同时校验 exporter 与类型是否匹配。 */
export function testHostConnection(data: { ip: string; exporterPort?: number | null; exporterPath?: string; osType?: string }) {
  return request<string>({ url: '/v1/hosts/test-connection', method: 'post', data })
}
