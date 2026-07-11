import request from './request'
import type { RetentionConfig } from '@/types'

export interface RetentionListResult {
  /** 出厂默认：category -> days */
  factory: Record<string, number>
  configs: RetentionConfig[]
}

export function getRetention() {
  return request<RetentionListResult>({ url: '/v1/retention/list', method: 'get' })
}

export function saveRetention(configs: RetentionConfig[]) {
  return request<void>({ url: '/v1/retention/save', method: 'post', data: configs })
}
