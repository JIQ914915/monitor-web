import request from './request'
import type { PageResult, PageParam } from '@/types'
import type {
  AlertRuleVo,
  AlertRulePageRequest,
  AlertRuleSaveRequest,
  NotifyChannelConfig,
  NotifyChannelSaveRequest
} from '@/types/alert'
import type { AlertEventOperateLogVo, AlertEventVo, AlertNotifyRecordVo } from '@/types/monitor'

/** 分页查询告警规则 */
export function pageAlertRules(data: AlertRulePageRequest) {
  return request<PageResult<AlertRuleVo>>({ url: '/v1/alerts/rules/page', method: 'post', data })
}

/** 查询规则详情（按 ruleCode） */
export function getAlertRule(ruleCode: string) {
  return request<AlertRuleVo>({ url: `/v1/alerts/rules/${encodeURIComponent(ruleCode)}`, method: 'get' })
}

/** 新建或更新告警规则 */
export function saveAlertRule(data: AlertRuleSaveRequest) {
  return request<AlertRuleVo>({ url: '/v1/alerts/rules/save', method: 'post', data })
}

/**
 * 切换启用/停用（按 ruleCode）。
 * - 内置规则传 instanceId：写 per-instance 覆盖（不影响全局默认值）
 * - 自定义规则可不传 instanceId：直接修改全局状态
 */
export function toggleAlertRule(ruleCode: string, enabled: boolean, instanceId?: number) {
  return request<void>({
    url: `/v1/alerts/rules/${encodeURIComponent(ruleCode)}/toggle`,
    method: 'put',
    data: { enabled, instanceId }
  })
}

/** 一键开启常用规则（系统推荐且适配当前实例的内置规则；已启用的跳过，返回本次新开启数量） */
export function enableRecommendedAlertRules(instanceId: number) {
  return request<number>({ url: '/v1/alerts/rules/enable-recommended', method: 'post', data: { instanceId } })
}

/** 删除告警规则（按 ruleCode） */
export function deleteAlertRule(ruleCode: string) {
  return request<void>({ url: `/v1/alerts/rules/${encodeURIComponent(ruleCode)}`, method: 'delete' })
}

/** 单独更新规则扫描间隔（按 ruleCode） */
export function updateAlertRuleScanInterval(ruleCode: string, scanIntervalMin: number, instanceId?: number) {
  return request<void>({
    url: `/v1/alerts/rules/${encodeURIComponent(ruleCode)}/scan-interval`,
    method: 'put',
    data: { scanIntervalMin, instanceId }
  })
}

/** 批量确认告警事件（单向流转：仅 pending -> confirmed） */
export function confirmAlertEvents(ids: number[], remark?: string) {
  return request<number>({ url: '/v1/alerts/events/confirm', method: 'post', data: { ids, remark } })
}

/** 批量受理告警事件（后端状态为 handling，单向流转：pending/confirmed -> handling） */
export function handlingAlertEvents(ids: number[], remark?: string) {
  return request<number>({ url: '/v1/alerts/events/handling', method: 'post', data: { ids, remark } })
}

/** 批量静默告警事件（后端状态为 ignored，并写入静默窗口） */
export function silenceAlertEvents(ids: number[], silenceHours: number, remark?: string) {
  return request<number>({ url: '/v1/alerts/events/silence', method: 'post', data: { ids, silenceHours, remark } })
}

/** 批量关闭告警事件（后端状态为 closed） */
export function closeAlertEvents(ids: number[], remark?: string) {
  return request<number>({ url: '/v1/alerts/events/close', method: 'post', data: { ids, remark } })
}

/** 下钻画像匹配规则 */
export interface DrilldownMatchRule {
  matchType: 'exact' | 'prefix'
  pattern: string
}

/** 告警下钻画像（数据库配置，§11.7 事件下钻） */
export interface DrilldownProfileVo {
  id: number
  profileCode: string
  profileLabel: string
  dbType: string
  matchRules: DrilldownMatchRule[]
  /** 关联指标：[{code,label,unit,color,toGB}] */
  relatedMetrics: Record<string, unknown>[]
  /** 可能原因：[{cause,confidence,color,evidence[]}] */
  causes: Record<string, unknown>[]
  /** 排查路径：[{title,description,action,link}]，link 为页面编码 */
  steps: Record<string, unknown>[]
  /** 建议动作：[{action,risk,description,sql,impact}] */
  actions: Record<string, unknown>[]
  builtin: boolean
  enabled: boolean
  sort: number
  remark?: string | null
  createdAt?: string
  updatedAt?: string
}

/** 下钻画像保存入参（id 为空新增） */
export interface DrilldownProfileSaveRequest {
  id?: number | null
  profileCode: string
  profileLabel: string
  dbType?: string
  matchRules: DrilldownMatchRule[]
  relatedMetrics: Record<string, unknown>[]
  causes: Record<string, unknown>[]
  steps: Record<string, unknown>[]
  actions: Record<string, unknown>[]
  enabled?: boolean
  sort?: number
  remark?: string | null
}

/** 查询全部下钻画像 */
export function listDrilldownProfiles() {
  return request<DrilldownProfileVo[]>({ url: '/v1/alerts/drilldown-profiles/list', method: 'post' })
}

/** 保存下钻画像 */
export function saveDrilldownProfile(data: DrilldownProfileSaveRequest) {
  return request<number>({ url: '/v1/alerts/drilldown-profiles/save', method: 'post', data })
}

/** 删除下钻画像（内置不可删） */
export function deleteDrilldownProfile(id: number) {
  return request<void>({ url: '/v1/alerts/drilldown-profiles/delete', method: 'post', data: { id } })
}

/** 启停下钻画像 */
export function toggleDrilldownProfile(id: number, enabled: boolean) {
  return request<void>({ url: '/v1/alerts/drilldown-profiles/toggle', method: 'post', data: { id, enabled } })
}

/** 告警事件下钻分析上下文：事件 + 规则/指标元数据（§11.7 事件下钻） */
export interface AlertEventDrilldownVo {
  event: AlertEventVo
  /** 规则编码（规则已删除时为空） */
  ruleCode?: string | null
  ruleDescription?: string | null
  /** 触发指标编码：画像匹配与趋势查询主键 */
  metricCode?: string | null
  /** 指标中文名（指标定义缺失时回退 metricCode） */
  metricLabel?: string | null
  unit?: string | null
  /** 阈值比较符（布尔型规则为空） */
  operator?: string | null
  /** 恢复时间（未恢复为空），用于确定趋势窗口终点 */
  recoveryTime?: string | null
  /** 命中的告警类型画像（数据库配置）；画像库为空时为 null，前端用本地兜底画像 */
  profile?: DrilldownProfileVo | null
}

/** 查询告警事件下钻分析上下文 */
export function getAlertEventDrilldown(eventId: number) {
  return request<AlertEventDrilldownVo>({
    url: `/v1/alerts/events/${eventId}/drilldown`,
    method: 'post'
  })
}

/** 查询告警事件通知记录 */
export function listAlertNotifyRecords(eventId: number) {
  return request<AlertNotifyRecordVo[]>({
    url: `/v1/alerts/events/${eventId}/notify-records`,
    method: 'post'
  })
}

/** 查询告警事件处置流水（确认/受理/静默/关闭等人工操作历史） */
export function listAlertOperateLogs(eventId: number) {
  return request<AlertEventOperateLogVo[]>({
    url: `/v1/alerts/events/${eventId}/operate-logs`,
    method: 'post'
  })
}

/** 死信通知分页查询请求 */
export interface AlertDeadLetterPageRequest extends PageParam {
  instanceId?: number
  channel?: string
}

/** 分页查询死信通知（重试耗尽仍未送达的记录） */
export function pageAlertDeadLetters(data: AlertDeadLetterPageRequest) {
  return request<PageResult<AlertNotifyRecordVo>>({
    url: '/v1/alerts/notify-records/dead/page',
    method: 'post',
    data
  })
}

/** 手动重发死信通知（重置为待重试，由重试任务异步发送） */
export function resendAlertNotify(recordId: number) {
  return request<boolean>({
    url: `/v1/alerts/notify-records/${recordId}/resend`,
    method: 'post'
  })
}

/** 查询通知通道全局配置（系统管理→通知通道） */
export function listNotifyChannels() {
  return request<NotifyChannelConfig[]>({ url: '/v1/alerts/notify-channels/list', method: 'get' })
}

/** 保存通知通道全局配置（按 channel upsert） */
export function saveNotifyChannels(data: NotifyChannelSaveRequest[]) {
  return request<void>({ url: '/v1/alerts/notify-channels/save', method: 'post', data })
}
