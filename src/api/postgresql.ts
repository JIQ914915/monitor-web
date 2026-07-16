import request from './request'
import type { PageResult } from '@/types'

export interface PgDatabase {
  name: string
  sizeBytes: number
  allowConnections: boolean
  connectable: boolean
  inScope: boolean
}

export interface PgSession {
  pid: number
  database?: string
  user?: string
  application?: string
  clientAddress?: string
  backendType?: string
  state?: string
  transactionStart?: string
  queryStart?: string
  stateChange?: string
  durationSeconds: number
  waitEventType?: string
  waitEvent?: string
  queryId?: string
  query?: string
  blockedBy: number[]
  lockedObjects: string[]
  rootBlocker: boolean
}

export interface PgBlockingNode {
  pid: number
  database?: string
  user?: string
  application?: string
  clientAddress?: string
  state?: string
  durationSeconds: number
  waitEventType?: string
  waitEvent?: string
  query?: string
  lockedObjects: string[]
  affectedSessions: number
  children: PgBlockingNode[]
}

export interface PgSessionQuery {
  instanceId: number
  database?: string
  user?: string
  application?: string
  state?: string
  waitEventType?: string
  minDurationSeconds?: number
  pageNum: number
  pageSize: number
}

export function listPgDatabases(instanceId: number) {
  return request<PgDatabase[]>({ url: '/v1/postgresql/databases', method: 'post', data: { id: instanceId } })
}

export function listPgSessions(data: PgSessionQuery) {
  return request<PageResult<PgSession>>({ url: '/v1/postgresql/sessions', method: 'post', data })
}

export function getPgBlockingTree(instanceId: number) {
  return request<PgBlockingNode[]>({ url: '/v1/postgresql/blocking-tree', method: 'post', data: { id: instanceId } })
}

export function cancelPgSession(instanceId: number, pid: number, reason: string) {
  return request<boolean>({ url: '/v1/postgresql/sessions/cancel', method: 'post', data: { instanceId, pid, reason } })
}

export function terminatePgSession(instanceId: number, pid: number, reason: string) {
  return request<boolean>({ url: '/v1/postgresql/sessions/terminate', method: 'post', data: { instanceId, pid, reason } })
}
export interface PgQueryAnalyticsQuery {
  instanceId: number
  database?: string
  user?: string
  queryId?: string
  from?: string
  to?: string
  sortBy?: string
  sortDirection?: 'asc' | 'desc'
  pageNum: number
  pageSize: number
}

export interface PgQueryAnalytics {
  database: string
  user: string
  queryId: string
  queryText: string
  calls: number
  totalExecTimeMs: number
  avgExecTimeMs: number
  minExecTimeMs: number
  maxExecTimeMs: number
  stddevExecTimeMs: number
  totalPlanTimeMs: number
  sharedHit: number
  sharedRead: number
  tempRead: number
  tempWritten: number
  blockReadTimeMs?: number
  blockWriteTimeMs?: number
  walBytes: number
  jitTimeMs: number
  rows: number
  firstSeen?: string
  lastSeen?: string
  statsReset?: string
}

export interface PgSqlRegression {
  id: number
  database: string
  queryId: string
  queryText: string
  type: string
  severity: string
  baselineValue?: number
  currentValue?: number
  changeRatio?: number
  detectedAt: string
}

export interface PgPlanHistory {
  id: number
  database: string
  queryId: string
  sqlHash: string
  planHash: string
  previousPlanHash?: string
  planChanged: boolean
  plan: unknown
  nodeSummary: Array<Record<string, unknown>>
  capturedAt: string
}

export interface PgAdvisor {
  category: string
  database: string
  objectName: string
  severity: string
  observationWindow: string
  evidence: string
  action: string
  risk: string
  details: Record<string, unknown>
}

export interface PgObjectAnalysis {
  database: string
  schema: string
  objectType: string
  objectName: string
  parentName?: string
  tablespace?: string
  sizeBytes: number
  estimatedRows?: number
  sequentialScans?: number
  cacheHitRate?: number
}

export function listPgQueryAnalytics(data: PgQueryAnalyticsQuery) {
  return request<PageResult<PgQueryAnalytics>>({ url: '/v1/postgresql/query-analytics', method: 'post', data })
}

export function listPgSqlRegressions(instanceId: number, pageNum: number, pageSize: number) {
  return request<PageResult<PgSqlRegression>>({ url: '/v1/postgresql/sql-regressions', method: 'post', data: { instanceId, pageNum, pageSize } })
}

export function capturePgPlan(instanceId: number, database: string, queryId: string, sql: string) {
  return request<PgPlanHistory>({ url: '/v1/postgresql/plans/capture', method: 'post', data: { instanceId, database, queryId, sql } })
}

export function listPgPlanHistory(instanceId: number, database: string, queryId: string) {
  return request<PgPlanHistory[]>({ url: '/v1/postgresql/plans/history', method: 'post', data: { instanceId, database, queryId } })
}

export function listPgVacuumAdvice(instanceId: number) {
  return request<PgAdvisor[]>({ url: '/v1/postgresql/vacuum-advisor', method: 'post', data: { id: instanceId } })
}

export function listPgIndexAdvice(instanceId: number) {
  return request<PgAdvisor[]>({ url: '/v1/postgresql/index-advisor', method: 'post', data: { id: instanceId } })
}

export function listPgObjectAnalysis(instanceId: number, pageNum: number, pageSize: number) {
  return request<PageResult<PgObjectAnalysis>>({ url: '/v1/postgresql/objects', method: 'post', data: { instanceId, pageNum, pageSize } })
}
export type PgOperationKind = 'replication' | 'backups' | 'progress' | 'timeline'
export interface PgOperationalEventQuery {
  instanceId: number
  category?: string
  sqlState?: string
  database?: string
  user?: string
  keyword?: string
  from?: string
  to?: string
  pageNum: number
  pageSize: number
}
export interface PgOperationalEvent {
  id: number
  source: string
  category: string
  eventType: string
  severity: string
  database?: string
  user?: string
  objectName?: string
  queryId?: string
  sqlState?: string
  message?: string
  fingerprint?: string
  payload: Record<string, unknown>
  sensitiveRedacted: boolean
  eventTime: string
}
export interface PgOperationalSummary {
  category: string
  eventType: string
  severity: string
  eventCount: number
  fingerprintCount: number
  lastSeen: string
  conclusion: string
  possibleCause: string
  impact: string
  action: string
}
export interface PgOperationalHealth {
  severity: string
  conclusion: string
  riskCount: number
  affectedObjectCount: number
  lastSeen?: string
  risks: PgOperationalSummary[]
}
export interface PgRestoreDrill {
  id?: number
  instanceId?: number
  backupId?: string
  targetTime?: string
  startedAt: string
  finishedAt?: string
  status: string
  validationResult: string
  durationSeconds?: number
  ownerName: string
  notes?: string
  createdAt?: string
}
export function listPgOperationalEvents(kind: PgOperationKind, data: PgOperationalEventQuery) {
  return request<PageResult<PgOperationalEvent>>({ url: `/v1/postgresql/operations/${kind}`, method: 'post', data })
}
export function getPgOperationalHealth(instanceId: number) {
  return request<PgOperationalHealth>({ url: '/v1/postgresql/operations/health', method: 'post', data: { id: instanceId } })
}
export function listPgOperationalSummary(instanceId: number) {
  return request<PgOperationalSummary[]>({ url: '/v1/postgresql/operations/summary', method: 'post', data: { id: instanceId } })
}
export function listPgRestoreDrills(instanceId: number, pageNum: number, pageSize: number) {
  return request<PageResult<PgRestoreDrill>>({ url: '/v1/postgresql/restore-drills', method: 'post', data: { instanceId, pageNum, pageSize } })
}
export function savePgRestoreDrill(data: PgRestoreDrill) {
  return request<PgRestoreDrill>({ url: '/v1/postgresql/restore-drills/save', method: 'post', data })
}