import request from './request'

export interface SqlServerDiagnosticItem {
  objectName: string
  objectType: string
  value: number
  collectTimeMs: number
}

export interface SqlServerDiagnosticsVo {
  instanceId: number
  metrics: Record<string, SqlServerDiagnosticItem[]>
}

/** SQL Server 结构化诊断明细：仅读取平台已采集的最新对象指标。 */
export function getSqlServerDiagnostics(instanceId: number) {
  return request<SqlServerDiagnosticsVo>({
    url: '/v1/sqlserver/diagnostics/overview',
    method: 'post',
    data: { instanceId }
  })
}