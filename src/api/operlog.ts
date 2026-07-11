import request from './request'
import type { PageParam, PageResult, SysOperLog } from '@/types'

export interface OperLogQuery extends PageParam {
  keyword?: string
  username?: string
  action?: string
  module?: string
  startTime?: string
  endTime?: string
}

export function pageOperLogs(data: OperLogQuery) {
  return request<PageResult<SysOperLog>>({ url: '/v1/oper-logs/page', method: 'post', data })
}

export function exportOperLogs(data: OperLogQuery) {
  return request<SysOperLog[]>({ url: '/v1/oper-logs/export', method: 'post', data })
}
