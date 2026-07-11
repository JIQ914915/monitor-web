import request from './request'
import type {
  HealthScoreVo,
  MetricTrendVo,
  PerfTrendBatchVo,
  MetricLatestVo,
  MetricObjectVo,
  LongConnVo,
  CapacityGrowthVo,
  CapacityForecastVo,
  TableGrowthVo,
  TodayStatsVo,
  ParamCurrentVo,
  ParamMetaVo,
  ParamPageItemVo,
  ParamAdviceVo,
  AlertEventVo,
  TrendPoint
} from '@/types/monitor'
import type { PageResult } from '@/types'

/**
 * 趋势点小数位统一处理：小时级连续聚合平均值会产生超长小数（如 12.2333333…）。
 * decimals 默认保留 2 位；调用处可自定义，传 0 即取整。
 */
function roundPoints(points?: TrendPoint[], decimals = 2): TrendPoint[] {
  const factor = 10 ** decimals
  return (points ?? []).map(p => ({ ts: p.ts, value: Math.round(p.value * factor) / factor }))
}

/** 健康评分 */
export function getHealthScore(instanceId: number) {
  return request<HealthScoreVo>({
    url: '/v1/metrics/health-score',
    method: 'post',
    data: { instanceId }
  })
}

/** 指标趋势图（from/to 毫秒时间戳；传 0 默认最近 1h；decimals 控制小数位，0 为取整） */
export function getMetricTrend(
  instanceId: number,
  metricCode: string,
  from = 0,
  to = 0,
  frequency: '1m' | '1h' = '1m',
  decimals = 2
) {
  return request<MetricTrendVo>({
    url: '/v1/metrics/trend',
    method: 'post',
    data: { instanceId, metricCode, from, to, frequency }
  }).then(res => ({ ...res, points: roundPoints(res.points, decimals) }))
}

/** 性能分析多指标趋势批量查询（1h 频率为小时级降采样视图，from/to 毫秒时间戳；decimals 控制小数位，0 为取整） */
export function getPerfTrendBatch(data: {
  instanceId: number
  metricCodes: string[]
  from: number
  to: number
  frequency: '1m' | '1h'
}, decimals = 2) {
  return request<PerfTrendBatchVo>({
    url: '/v1/metrics/perf/trend-batch',
    method: 'post',
    data
  }).then(res => ({
    ...res,
    series: (res.series ?? []).map(s => ({ ...s, points: roundPoints(s.points, decimals) }))
  }))
}

/** 主机磁盘 IO 按盘趋势响应：每盘一组繁忙度（%）/ 读速率 / 写速率（B/s）序列 */
export interface HostDiskIoTrendVo {
  instanceId: number
  devices: {
    device: string
    util: { ts: number; value: number }[]
    read: { ts: number; value: number }[]
    write: { ts: number; value: number }[]
  }[]
}

/** 主机磁盘 IO 按盘趋势（from/to 不传默认最近 24 小时） */
export function getHostDiskIoTrend(data: { instanceId: number; from?: number; to?: number }) {
  return request<HostDiskIoTrendVo>({
    url: '/v1/metrics/host/diskio-trend',
    method: 'post',
    data
  })
}

/** 批量最新值 */
export function getMetricLatest(instanceId: number, metricCodes: string[]) {
  return request<MetricLatestVo>({
    url: '/v1/metrics/latest',
    method: 'post',
    data: { instanceId, codes: metricCodes }
  })
}

/** 文本指标最新值批量查询（frequency=1m 分钟表 / 1h 小时表 / 1d 天表） */
export function getMetricTextLatest(instanceId: number, metricCodes: string[], frequency: '1m' | '1h' | '1d' = '1m') {
  return request<{ instanceId: number; values: Record<string, string | null> }>({
    url: '/v1/metrics/text/latest',
    method: 'post',
    data: { instanceId, codes: metricCodes, frequency }
  })
}

/** 对象级 Top N（表大小 / 连接来源等） */
export function getMetricObjects(instanceId: number, metricCode: string, limit = 10) {
  return request<MetricObjectVo>({
    url: '/v1/metrics/objects',
    method: 'post',
    data: { instanceId, metricCode, limit }
  })
}

/** 表 I/O 热点分页条目 */
export interface TableIoPageItem {
  schemaName: string
  tableName: string
  waitMs: number
  readCount: number
  writeCount: number
}

/** 表 I/O 热点分页（近 1 小时，按等待耗时降序） */
export function pageTableIo(instanceId: number, pageNum = 1, pageSize = 10) {
  return request<PageResult<TableIoPageItem>>({
    url: '/v1/metrics/table-io/page',
    method: 'post',
    data: { instanceId, pageNum, pageSize }
  })
}

/** 疑似未使用索引分页响应 */
export interface UnusedIndexPageVo {
  uptimeDays: number
  list: { schemaName: string; tableName: string; indexName: string }[]
  total: number
}

/** 疑似未使用索引分页（天级扫描结果） */
export function pageUnusedIndex(instanceId: number, pageNum = 1, pageSize = 10) {
  return request<UnusedIndexPageVo>({
    url: '/v1/metrics/unused-index/page',
    method: 'post',
    data: { instanceId, pageNum, pageSize }
  })
}

/** 长连接 Top 10 */
export function getLongConnections(instanceId: number) {
  return request<LongConnVo>({
    url: '/v1/metrics/long-connections',
    method: 'post',
    data: { instanceId }
  })
}

/** 容量增长趋势（天级） */
export function getCapacityGrowthTrend(instanceId: number, days = 30) {
  return request<CapacityGrowthVo>({
    url: '/v1/metrics/capacity/growth-trend',
    method: 'post',
    data: { instanceId, days }
  })
}

/** 容量预测：库表容量日均增长 + 主机数据盘剩余空间 → 预计剩余可用天数 */
export function getCapacityForecast(instanceId: number) {
  return request<CapacityForecastVo>({
    url: '/v1/metrics/capacity/forecast',
    method: 'post',
    data: { instanceId }
  })
}

/** 表级周环比 Top N */
export function getTableGrowth(instanceId: number, metricCode: string, limit = 10) {
  return request<TableGrowthVo>({
    url: '/v1/metrics/objects/growth',
    method: 'post',
    data: { instanceId, metricCode, limit }
  })
}

/** 今日累计统计 */
export function getTodayStats(instanceId: number) {
  return request<TodayStatsVo>({
    url: '/v1/metrics/today-stats',
    method: 'post',
    data: { instanceId }
  })
}

/** 配置参数当前值（保留，供内部使用） */
export function getParamsCurrent(instanceId: number) {
  return request<ParamCurrentVo>({
    url: '/v1/metrics/params/current',
    method: 'post',
    data: { instanceId }
  })
}

/** 配置参数元数据（支持 category 过滤） */
export function getParamsMeta(category?: string) {
  return request<ParamMetaVo[]>({
    url: '/v1/metrics/params/meta',
    method: 'post',
    data: { category: category || '' }
  })
}

/** 参数调优建议（规则化体检：配置参数 + 运行指标联合判断，只出建议不出手） */
export function getParamAdvice(instanceId: number) {
  return request<ParamAdviceVo[]>({
    url: '/v1/metrics/params/advice',
    method: 'post',
    data: { instanceId }
  })
}

/** 配置参数分页查询（合并当前值+元数据，服务端过滤+分页） */
export function pageParams(data: {
  instanceId: number
  keyword?: string
  category?: string
  pageNum: number
  pageSize: number
}) {
  return request<{ list: ParamPageItemVo[]; total: number }>({
    url: '/v1/metrics/params/page',
    method: 'post',
    data
  })
}

/** 活跃告警事件分页（事件 Tab 用） */
export function pageAlertEvents(data: {
  instanceId?: number
  ruleLevel?: string
  statuses?: string[]
  /** 事件来源过滤（字典 event_source：rule/scenario/system） */
  eventSource?: string
  /** 场景编码过滤（仅场景综合事件） */
  scenarioCode?: string
  pageNum: number
  pageSize: number
}) {
  return request<PageResult<AlertEventVo>>({
    url: '/v1/alerts/events/page',
    method: 'post',
    data
  })
}

/** 告警事件数量统计（轻量接口，仅返回 count） */
export function countAlertEvents(data: {
  instanceId?: number
  ruleLevel?: string
  statuses?: string[]
}) {
  return request<number>({
    url: '/v1/alerts/events/count',
    method: 'post',
    data
  })
}
