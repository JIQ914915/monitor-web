import request from './request'
import type { CollectLogRecord, CollectTaskStats, CollectTaskSummary, PageResult } from '@/types'

export interface CollectTaskQuery {
  keyword?: string
  dbType?: string
  frequency?: string
  /** running / stopped / error */
  status?: string
  pageNum?: number
  pageSize?: number
}

/** 数据库实例/主机采集任务后台分页。 */
export function listCollectTasks(data?: CollectTaskQuery) {
  return request<PageResult<CollectTaskSummary>>({ url: '/v1/collect-logs/tasks', method: 'post', data })
}

/** 当前任务过滤条件下的频率和状态统计。 */
export function getCollectTaskStats(data?: CollectTaskQuery) {
  return request<CollectTaskStats>({ url: '/v1/collect-logs/tasks/stats', method: 'post', data })
}

/** 单实例或单主机、单频率的历史采集日志后台分页。 */
export function listCollectLogs(task: CollectTaskSummary, pageNum = 1, pageSize = 20) {
  const target = task.targetType === 'host'
    ? { hostId: task.hostId }
    : { instanceId: task.instanceId }
  return request<PageResult<CollectLogRecord>>({
    url: '/v1/collect-logs/query',
    method: 'post',
    data: { ...target, frequency: task.frequency, pageNum, pageSize }
  })
}