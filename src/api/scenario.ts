import request from './request'
import type { ScenarioPageVo, ScenarioVo } from '@/types/monitor'

/** 查询实例适配的场景列表（按启停页签 + 级别排序后端分页，含各信号实时状态与统计卡片数据） */
export function pageScenarios(data: {
  instanceId: number
  enabled?: boolean
  pageNum?: number
  pageSize?: number
}) {
  return request<ScenarioPageVo>({ url: '/v1/scenarios/page', method: 'post', data })
}

/** 查询场景详情（列表字段 + 诊断结论 + 关联知识库文章） */
export function getScenarioDetail(data: { instanceId: number; scenarioCode: string }) {
  return request<ScenarioVo>({ url: '/v1/scenarios/detail', method: 'post', data })
}

/** 一键开启常用场景（系统推荐且适配当前实例；未关联主机的实例跳过主机类场景，返回本次新开启数量） */
export function enableRecommendedScenarios(instanceId: number) {
  return request<number>({ url: '/v1/scenarios/enable-recommended', method: 'post', data: { instanceId } })
}

/** 启停场景（停用时联动关闭该场景在此实例的活跃综合事件） */
export function toggleScenario(data: { instanceId: number; scenarioCode: string; enabled: boolean }) {
  return request<boolean>({ url: '/v1/scenarios/toggle', method: 'post', data })
}

/** 调整场景阈值（实例级覆盖，仅阈值数值；空 overrides 恢复模板默认） */
export function updateScenarioThresholds(data: {
  instanceId: number
  scenarioCode: string
  overrides: Record<string, number>
}) {
  return request<boolean>({ url: '/v1/scenarios/thresholds', method: 'post', data })
}
