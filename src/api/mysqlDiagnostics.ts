import request from './request'

export interface MySqlDiagnosticResult {
  status: 'normal' | 'attention' | 'alert' | 'no_data' | 'unavailable'
  conclusion: string
  [key: string]: any
}

const post = <T>(url: string, data: Record<string, unknown>) => request<T>({ url, method: 'post', data })

export const getMySqlCapacityRisks = (instanceId: number) =>
  post<MySqlDiagnosticResult>('/v1/mysql-diagnostics/capacity-risks', { instanceId })
export const getMySqlConfigDrift = (instanceId: number, compareInstanceId?: number, baselineTemplate = 'stability') =>
  post<MySqlDiagnosticResult>('/v1/mysql-diagnostics/config-drift', { instanceId, compareInstanceId, baselineTemplate })
export const getMySqlReplicationDiagnosis = (instanceId: number) =>
  post<MySqlDiagnosticResult>('/v1/mysql-diagnostics/replication', { instanceId })
export const getMySqlMetadataLocks = (instanceId: number) =>
  post<MySqlDiagnosticResult>('/v1/mysql-diagnostics/metadata-locks', { instanceId })
export const getMySqlCorrelation = (instanceId: number, from?: number, to?: number) =>
  post<MySqlDiagnosticResult>('/v1/mysql-diagnostics/correlation', { instanceId, from, to })
export const getMySqlSecurityBaseline = (instanceId: number, enhanced = false) =>
  post<MySqlDiagnosticResult>('/v1/mysql-diagnostics/security-baseline', { instanceId, enhanced })

export interface MySqlPlanHistory {
  id: number
  schemaName: string
  sqlHash: string
  planHash: string
  previousPlanHash?: string
  planChanged: boolean
  planFormat: string
  plan: unknown
  nodeSummary: Record<string, unknown>[]
  riskLevel: string
  conclusion: string
  capturedAt: string
}

export const getMySqlPlanHistory = (instanceId: number, schemaName: string, sqlHash: string) =>
  post<MySqlPlanHistory[]>('/v1/slow-sql/plan/history', { instanceId, schemaName, sqlHash })
