import request from './request'
import type { SlowSqlDigestVo, SlowSqlRecordVo, SlowSqlSampleVo, SlowSqlStatsVo, SlowSqlDigestTrendVo, SlowSqlAlertVo, SlowSqlExplainVo, SlowSqlWindowCompareVo, SlowSqlClusterVo } from '@/types/monitor'
import type { PageResult } from '@/types'

/** 慢SQL指纹聚合分页（from/to 毫秒时间戳，不传默认最近 24h） */
export function pageSlowSqlDigest(data: {
  instanceId: number
  from?: number
  to?: number
  keyword?: string
  schemaName?: string
  sqlType?: string
  minAvgMs?: number
  maxAvgMs?: number
  sortField?: string
  asc?: boolean
  pageNum: number
  pageSize: number
}) {
  return request<PageResult<SlowSqlDigestVo>>({
    url: '/v1/slow-sql/digest/page',
    method: 'post',
    data
  })
}

/** 慢SQL采集周期明细分页（每行 = 某指纹某采集周期的增量，按采集时间倒序） */
export function pageSlowSqlRecords(data: {
  instanceId: number
  from?: number
  to?: number
  sqlType?: string
  minAvgMs?: number
  maxAvgMs?: number
  /** 传入时按指纹过滤（指纹详情的 SQL 明细列表），schemaName 同时参与精确匹配 */
  digest?: string
  schemaName?: string | null
  pageNum: number
  pageSize: number
}) {
  return request<PageResult<SlowSqlRecordVo>>({
    url: '/v1/slow-sql/records/page',
    method: 'post',
    data
  })
}

/** 单指纹窗口聚合详情（详情弹窗数据源，窗口内无数据返回 null） */
export function getSlowSqlDigestDetail(data: {
  instanceId: number
  schemaName?: string | null
  digest: string
  from?: number
  to?: number
}) {
  return request<SlowSqlDigestVo | null>({
    url: '/v1/slow-sql/digest/detail',
    method: 'post',
    data
  })
}

/** 慢SQL真实执行样本分页（一行 = 一次真实执行，SQL 含参数原文，保留 7 天） */
export function pageSlowSqlSamples(data: {
  instanceId: number
  from?: number
  to?: number
  sqlType?: string
  minExecMs?: number
  maxExecMs?: number
  digest?: string
  sortField?: string
  asc?: boolean
  pageNum: number
  pageSize: number
}) {
  return request<PageResult<SlowSqlSampleVo>>({
    url: '/v1/slow-sql/samples/page',
    method: 'post',
    data
  })
}

/** 标记 SQL 指纹优化状态（字典 slow_sql_optimize_status：unoptimized/optimized） */
export function setSlowSqlOptimizeStatus(data: {
  instanceId: number
  schemaName?: string | null
  digest: string
  status: string
}) {
  return request<void>({
    url: '/v1/slow-sql/optimize-status/set',
    method: 'post',
    data
  })
}

/** 窗口内慢SQL相关告警事件列表（活跃期与窗口交叠，按触发时间倒序） */
export function listSlowSqlAlerts(data: { instanceId: number; from?: number; to?: number }) {
  return request<SlowSqlAlertVo[]>({
    url: '/v1/slow-sql/alerts',
    method: 'post',
    data
  })
}

/** 慢SQL概览统计（窗口汇总 + 今日慢查询数 + long_query_time 阈值） */
export function getSlowSqlStats(data: { instanceId: number; from?: number; to?: number }) {
  return request<SlowSqlStatsVo>({
    url: '/v1/slow-sql/stats',
    method: 'post',
    data
  })
}

/** 单指纹小时级趋势（详情弹窗，from/to 不传默认最近 7 天） */
export function getSlowSqlDigestTrend(data: {
  instanceId: number
  schemaName?: string | null
  digest: string
  from?: number
  to?: number
}) {
  return request<SlowSqlDigestTrendVo>({
    url: '/v1/slow-sql/digest/trend',
    method: 'post',
    data
  })
}

/** 实时执行计划：使用采集账号连目标库执行 EXPLAIN（只做优化器分析，不执行语句本身） */
export function explainSlowSql(data: {
  instanceId: number
  schemaName?: string | null
  sql: string
  planFormat?: 'json' | 'tree' | 'tabular'
  saveHistory?: boolean
}) {
  return request<SlowSqlExplainVo>({
    url: '/v1/slow-sql/explain',
    method: 'post',
    data
  })
}

/** 慢SQL时段对比（当前窗口 vs 昨日同时段 vs 上周同时段，含 Top10 排名变化） */
export function getSlowSqlWindowCompare(data: { instanceId: number; from?: number; to?: number }) {
  return request<SlowSqlWindowCompareVo>({
    url: '/v1/slow-sql/window-compare',
    method: 'post',
    data
  })
}

/** 慢SQL指纹聚类（按语句类型+涉及表集合聚簇，按簇总耗时降序，后端分页） */
export function getSlowSqlClusters(data: {
  instanceId: number
  from?: number
  to?: number
  pageNum: number
  pageSize: number
}) {
  return request<{ list: SlowSqlClusterVo[]; total: number }>({
    url: '/v1/slow-sql/clusters',
    method: 'post',
    data
  })
}

/** 窗口内出现过 Top SQL 的库名列表（筛选下拉） */
export function getSlowSqlSchemas(data: { instanceId: number; from?: number; to?: number }) {
  return request<string[]>({
    url: '/v1/slow-sql/schemas',
    method: 'post',
    data
  })
}
