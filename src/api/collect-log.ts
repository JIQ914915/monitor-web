import request from './request'
import type { CollectLogRecord, CollectTaskSummary } from '@/types'

export interface CollectTaskQuery {
  dbType?: string
  frequency?: string
  /** running / stopped / error */
  status?: string
}

/**
 * 采集任务列表：每个实例 × 频率一行，含最新采集状态与 24h 成功率。
 * 对应后端 POST /collect-logs/tasks
 */
export function listCollectTasks(data?: CollectTaskQuery) {
  return request<CollectTaskSummary[]>({ url: '/v1/collect-logs/tasks', method: 'post', data })
}

/**
 * 单实例单频率的历史采集日志（倒序，默认 50 条，最大 200）。
 * 对应后端 POST /collect-logs/query
 */
export function listCollectLogs(instanceId: number, frequency: string, limit = 50) {
  return request<CollectLogRecord[]>({
    url: '/v1/collect-logs/query',
    method: 'post',
    data: { instanceId, frequency, limit }
  })
}
