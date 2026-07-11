import request from './request'
import type { PageResult } from '@/types'

/** 报告分段内容：summary（结论+键值对）/ table（列+行）/ list（建议条目）/ chart（趋势折线图） */
export interface ReportSection {
  title: string
  type: 'summary' | 'table' | 'list' | 'chart'
  summary?: string
  kv?: { label: string; value: string }[]
  columns?: { key: string; label: string }[]
  rows?: Record<string, unknown>[]
  emptyText?: string
  items?: string[]
  /** chart 分段：单位符号（如 %、ms、GB） */
  unit?: string
  /** chart 分段：曲线列表，点为 [毫秒时间戳, 值] */
  series?: { name: string; points: [number, number][] }[]
  /** chart 分段：竖向标记线（如告警触发/恢复时刻） */
  markers?: { ts: number; label: string; color?: string }[]
}

/** 报告归档列表项 */
export interface ReportVo {
  id: number
  reportCode: string
  title: string
  reportType: string
  cycle?: string | null
  scopeType: string
  scopeText?: string
  instanceIds?: number[]
  timeRange: string
  genMode: string
  status: string
  createdBy?: string
  generateTime?: string
}

/** 报告详情（含分段正文） */
export interface ReportDetailVo extends ReportVo {
  content?: { sections?: ReportSection[] }
}

/** 定时报告任务 */
export interface ReportScheduleVo {
  id: number
  name: string
  reportType: string
  cycle?: string | null
  scopeType: string
  scopeText?: string
  instanceIds?: number[]
  timeRange: string
  frequency: string
  runTime: string
  nextRun?: string
  lastRunTime?: string
  enabled: boolean
  createdBy?: string
  notifyEmails?: string[]
}

/** 报告生成 / 定时任务保存入参 */
export interface ReportGenerateRequest {
  reportType: string
  cycle?: string
  scopeType?: string
  instanceIds?: number[]
  groupIds?: number[]
  ownerIds?: number[]
  timeRange?: string
  /** reportType=event 时必填：告警事件 ID */
  eventId?: number
}

export interface ReportScheduleSaveRequest extends ReportGenerateRequest {
  id?: number
  frequency: string
  runTime: string
  /** 报告生成后推送的收件邮箱列表（空则不推送） */
  notifyEmails?: string[]
}

/** 报告归档分页 */
export function pageReports(data: { pageNum: number; pageSize: number; keyword?: string; reportType?: string }) {
  return request<PageResult<ReportVo>>({ url: '/v1/reports/page', method: 'post', data })
}

/** 报告详情（含分段正文） */
export function getReportDetail(id: number) {
  return request<ReportDetailVo>({ url: '/v1/reports/detail', method: 'post', data: { id } })
}

/** 立即生成报告，返回归档报告 ID */
export function generateReport(data: ReportGenerateRequest) {
  return request<number>({ url: '/v1/reports/generate', method: 'post', data })
}

/** 删除归档报告 */
export function deleteReport(id: number) {
  return request<void>({ url: '/v1/reports/delete', method: 'post', data: { id } })
}

/** 定时任务列表 */
export function listReportSchedules() {
  return request<ReportScheduleVo[]>({ url: '/v1/reports/schedules/list', method: 'post', data: {} })
}

/** 保存定时任务 */
export function saveReportSchedule(data: ReportScheduleSaveRequest) {
  return request<number>({ url: '/v1/reports/schedules/save', method: 'post', data })
}

/** 启停定时任务 */
export function toggleReportSchedule(id: number, enabled: boolean) {
  return request<void>({ url: '/v1/reports/schedules/toggle', method: 'post', data: { id, enabled } })
}

/** 删除定时任务 */
export function deleteReportSchedule(id: number) {
  return request<void>({ url: '/v1/reports/schedules/delete', method: 'post', data: { id } })
}

/** 立即执行一次定时任务，返回生成的报告 ID */
export function runReportScheduleNow(id: number) {
  return request<number>({ url: '/v1/reports/schedules/run-now', method: 'post', data: { id } })
}
