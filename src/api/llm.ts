import request from './request'

/** LLM 智能分析配置（apiKey 只回显掩码 ******） */
export interface LlmConfigVo {
  enabled: boolean
  baseUrl: string | null
  apiKey: string
  model: string | null
  timeoutSeconds: number | null
  allowExternal: boolean
  desensitize: boolean
}

/** 告警事件智能分析结果（AI 生成，仅供参考） */
export interface LlmAnalysisVo {
  eventId: number
  success: boolean
  summary: string | null
  causes: string[] | null
  suggestions: string[] | null
  errorMessage: string | null
  model: string | null
  durationMs: number | null
  operatorName: string | null
  createdAt: string | null
}

/** 查询智能分析配置 */
export function getLlmConfig() {
  return request<LlmConfigVo>({ url: '/v1/llm/config/get', method: 'post' })
}

/** 保存智能分析配置（apiKey 传掩码表示不修改） */
export function saveLlmConfig(data: Partial<LlmConfigVo>) {
  return request<void>({ url: '/v1/llm/config/save', method: 'post', data })
}

/** 查询事件已生成的智能分析（未生成过返回 null） */
export function getLlmAnalysis(eventId: number) {
  return request<LlmAnalysisVo | null>({ url: '/v1/llm/analysis/get', method: 'post', data: { eventId } })
}

/** 生成（或重新生成）事件智能分析 */
export function generateLlmAnalysis(eventId: number, regenerate = false) {
  return request<LlmAnalysisVo>({ url: '/v1/llm/analyze', method: 'post', data: { eventId, regenerate } })
}

/** 慢SQL指纹智能分析入参 */
export interface SlowSqlLlmAnalyzeParams {
  instanceId: number
  digest: string
  schemaName?: string | null
  sqlText?: string | null
  from?: number
  to?: number
}

/** 慢SQL指纹智能分析（按需生成不缓存） */
export function analyzeSlowSqlLlm(data: SlowSqlLlmAnalyzeParams) {
  return request<LlmAnalysisVo>({ url: '/v1/llm/slowsql/analyze', method: 'post', data })
}
