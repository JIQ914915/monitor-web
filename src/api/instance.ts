import request from './request'
import type { DbInstance, HealthLevel, PageParam, PageResult } from '@/types'

export interface InstanceQuery extends PageParam {
  keyword?: string
  dbTypeId?: number
  status?: string
  groupId?: number
}

export interface FleetSummary {
  total: number
  normal: number
  abnormal: number
  paused: number
  avgHealth: number
  dist: { level: HealthLevel; count: number }[]
}

/** 分页查询实例：入参走 POST body（§13.3.3 写/查询统一 POST 约定）。 */
export function pageInstances(data: InstanceQuery) {
  return request<PageResult<DbInstance>>({ url: '/v1/instances/page', method: 'post', data })
}

/** 全部实例（实例选择面板用）。 */
export function listAllInstances() {
  return request<DbInstance[]>({ url: '/v1/instances/all', method: 'get' })
}

export function getInstance(id: number) {
  return request<DbInstance>({ url: '/v1/instances/get', method: 'post', data: { id } })
}

export function createInstance(data: DbInstance) {
  return request<number>({ url: '/v1/instances', method: 'post', data })
}

export function updateInstance(data: DbInstance) {
  return request<void>({ url: '/v1/instances/update', method: 'post', data })
}

export function deleteInstance(id: number) {
  return request<void>({ url: '/v1/instances/delete', method: 'post', data: { id } })
}

/** 恢复采样(normal)/暂停采样(paused)。 */
export function toggleInstance(id: number, status: 'normal' | 'paused') {
  return request<void>({ url: '/v1/instances/toggle', method: 'post', data: { id, status } })
}

export interface ConnectionTest {
  dbType: string
  host: string
  port: number
  /** 监控库名（PostgreSQL 建连必须指定库，缺省 postgres） */
  databaseName?: string
  connUser?: string
  connPassword?: string
}

/** 单项权限检测结果（granted：true=具备 / false=缺失 / null=无法确认） */
export interface PermissionCheck {
  name: string
  granted: boolean | null
  affected?: string
  grantHint?: string
}

/** 连接测试结果：版本 + 采集账号权限逐项检测 */
export interface ConnectionTestResult {
  version: string
  checks?: PermissionCheck[]
}

/** 测试实例连接，成功返回数据库版本号与权限检测项列表。 */
export function testInstanceConnection(data: ConnectionTest) {
  return request<ConnectionTestResult>({ url: '/v1/instances/test-connection', method: 'post', data })
}

/** 实例监控能力状态（status 见字典 capability_status） */
export interface InstanceCapability {
  capability: string
  name: string
  status: 'available' | 'limited' | 'version_not_support' | 'not_applicable' | 'collect_error' | 'no_data' | string
  message?: string | null
}

/** 检测实例运行时能力状态（能力矩阵 + 页面降级横幅用）。 */
export function getInstanceCapabilities(id: number) {
  return request<InstanceCapability[]>({ url: '/v1/instances/capabilities', method: 'post', data: { id } })
}

export function getFleetSummary() {
  return request<FleetSummary>({ url: '/v1/instances/summary', method: 'get' })
}

// ===== 首页全局总览（§11.1.2）=====

export interface FleetDimRate {
  key: string
  label: string
  /** 达标率（0-100，全实例该维度平均得分）；-1 表示暂无数据 */
  rate: number
}

export interface FleetTypeDist {
  name: string
  total: number
  normal: number
  alert: number
}

export interface FleetRiskInstance {
  id: number
  name: string
  dbType?: string
  dbVersion?: string
  host?: string
  port?: number
  groupNames?: string[]
  ownerAName?: string
  ownerBName?: string
  status: string
  health?: number
  healthLevel: string
  activeAlerts: number
}

export interface FleetTrends {
  total: number[]
  normal: number[]
  alert: number[]
  abnormal: number[]
  paused: number[]
}

export interface FleetOverview {
  total: number
  normal: number
  alert: number
  abnormal: number
  paused: number
  /** 近 7 天状态趋势（迷你趋势线，按天一个点、最早在前） */
  trends?: FleetTrends
  /** 聚合健康分；-1 表示暂无数据 */
  avgHealth: number
  healthLevel: string
  scoredCount: number
  dims: FleetDimRate[]
  dbTypes: FleetTypeDist[]
  topRisk: FleetRiskInstance[]
}

/** 首页全局总览：健康门面 + 状态统计卡 + 类型分布 + 高风险 Top10。 */
export function getFleetOverview() {
  return request<FleetOverview>({ url: '/v1/instances/fleet-overview', method: 'post', data: {} })
}
