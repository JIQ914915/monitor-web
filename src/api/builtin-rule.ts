import request from './request'
import type { PageResult } from '@/types'
import type { AlertRuleVo, BuiltinRulePageRequest, BuiltinRuleSaveRequest } from '@/types/alert'

/** 分页查询内置规则模板（全局视角） */
export function pageBuiltinRules(data: BuiltinRulePageRequest) {
  return request<PageResult<AlertRuleVo>>({ url: '/v1/alerts/builtin-rules/page', method: 'post', data })
}

/** 新建内置规则模板 */
export function createBuiltinRule(data: BuiltinRuleSaveRequest) {
  return request<AlertRuleVo>({ url: '/v1/alerts/builtin-rules/create', method: 'post', data })
}

/** 更新内置规则模板（须携带 id，ruleCode 不可修改） */
export function updateBuiltinRule(data: BuiltinRuleSaveRequest) {
  return request<AlertRuleVo>({ url: '/v1/alerts/builtin-rules/update', method: 'post', data })
}

/** 删除内置规则模板（级联关闭各实例活跃事件并清理实例配置） */
export function deleteBuiltinRule(ruleCode: string) {
  return request<void>({ url: '/v1/alerts/builtin-rules/delete', method: 'post', data: { ruleCode } })
}

/** 指标定义（内置规则表单选择监控指标用） */
export interface MetricDefinitionOption {
  metricCode: string
  metricName: string | null
  dbType: string | null
  valueType: string | null
  unit: string | null
  frequency: string | null
  description: string | null
  enabled: boolean | null
}

/** 查询指标定义列表（可按数据库类型ID过滤） */
export function listMetricDefinitions(dbTypeId?: number) {
  return request<MetricDefinitionOption[]>({
    url: '/v1/metric-definitions/list',
    method: 'post',
    data: dbTypeId ? { dbTypeId } : {}
  })
}
