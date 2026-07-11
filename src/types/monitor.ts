// 实时概况模块 TS 类型定义

// ─────────────────────────────────────────────
// 健康评分
// ─────────────────────────────────────────────
export interface DimensionScore {
  dimension: string  // 编码：availability / performance / stability / capacity / security
  label: string      // 中文名
  score: number      // 0-100；-1 表示无数据
  weight: number     // 权重（%）
}

export interface Deduction {
  dimension: string
  message: string
  points: number          // 扣分分值（正数）
  currentValue?: string   // 当前指标值（含单位的字符串）
}

export interface HealthScoreVo {
  instanceId: number
  score: number
  level: 'excellent' | 'good' | 'warning' | 'critical' | 'no_data'
  dimensions: DimensionScore[]
  deductions: Deduction[]
}

// ─────────────────────────────────────────────
// 时序趋势
// ─────────────────────────────────────────────
export interface TrendPoint {
  ts: number     // 毫秒时间戳
  value: number
}

export interface MetricTrendVo {
  instanceId: number
  metricCode: string
  points: TrendPoint[]
}

/** 性能分析多指标趋势批量响应 */
export interface PerfTrendBatchVo {
  instanceId: number
  frequency: '1m' | '1h'
  series: { metricCode: string; points: TrendPoint[] }[]
}

// ─────────────────────────────────────────────
// 慢SQL分析（Top SQL 指纹）
// ─────────────────────────────────────────────
/** 慢SQL指纹聚合行（时间窗口内按 digest 聚合的增量统计） */
export interface SlowSqlDigestVo {
  schemaName: string | null
  digest: string
  digestText: string
  sqlType: 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE' | 'OTHER'
  execCount: number
  totalTimeMs: number
  avgTimeMs: number
  maxAvgTimeMs: number
  rowsExamined: number
  rowsSent: number
  scanRatio: number | null
  lockTimeMs: number
  sortRows: number
  noIndexUsed: number
  tmpTables: number
  tmpDiskTables: number
  /** 优化状态：字典 slow_sql_optimize_status（unoptimized/optimized） */
  optimizeStatus: string
  firstSeen: number
  lastSeen: number
}

/** 慢SQL真实执行样本行（一行 = 一次真实执行，SQL 含参数原文） */
export interface SlowSqlSampleVo {
  sampleKey: string
  connUser: string | null
  connHost: string | null
  schemaName: string | null
  digest: string | null
  sqlText: string
  sqlType: 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE' | 'OTHER'
  execTimeMs: number
  lockTimeMs: number
  rowsExamined: number
  rowsSent: number
  sortRows: number
  noIndexUsed: boolean
  tmpTables: number
  tmpDiskTables: number
  collectTime: number
}

/** 实时执行计划结果（目标库 EXPLAIN 输出透传） */
export interface SlowSqlExplainVo {
  columns: string[]
  rows: (string | null)[][]
}

/** 慢SQL相关告警事件（依赖慢查询指标的规则触发） */
export interface SlowSqlAlertVo {
  id: number
  eventCode: string
  ruleName: string
  ruleLevel: string
  status: string
  triggerValue: string | null
  thresholdValue: string | null
  alertMessage: string | null
  dimensionKey: string | null
  triggerTime: number
  recoveryTime: number | null
}

/** 慢SQL分析概览统计 */
export interface SlowSqlStatsVo {
  instanceId: number
  digestCount: number
  totalExecCount: number
  totalTimeMs: number
  maxAvgTimeMs: number
  totalRowsExamined: number
  avgTimeMs: number
  noIndexDigestCount: number
  tmpTableDigestCount: number
  slowQueriesToday: number
  longQueryTimeSeconds: number | null
  topSqlSupported: boolean
}

/** 慢SQL时段对比：单窗口汇总 */
export interface SlowSqlWindowSummary {
  from: number
  to: number
  digestCount: number
  totalExecCount: number
  avgTimeMs: number | null
  maxAvgTimeMs: number | null
}

/** 慢SQL时段对比：Top SQL 条目（当前排名 + 对比窗口排名/耗时） */
export interface SlowSqlCompareTopItem {
  schemaName: string | null
  digest: string
  digestText: string
  sqlType: string
  rank: number
  execCount: number
  avgTimeMs: number
  yesterdayRank: number | null
  yesterdayAvgTimeMs: number | null
  lastWeekRank: number | null
  lastWeekAvgTimeMs: number | null
}

/** 慢SQL时段对比（当前窗口 vs 昨日同时段 vs 上周同时段） */
export interface SlowSqlWindowCompareVo {
  instanceId: number
  current: SlowSqlWindowSummary
  yesterday: SlowSqlWindowSummary
  lastWeek: SlowSqlWindowSummary
  topItems: SlowSqlCompareTopItem[]
}

/** 慢SQL指纹聚类簇（语句类型 + 涉及表集合相同的指纹归为一簇） */
export interface SlowSqlClusterVo {
  clusterKey: string
  statementType: 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE' | 'OTHER'
  tables: string[]
  digestCount: number
  sampleCount: number
  totalTimeMs: number
  avgTimeMs: number | null
  maxTimeMs: number
  sampleSql: string
  schemaName: string | null
  digests: {
    digest: string
    sampleCount: number
    totalTimeMs: number
    avgTimeMs: number
  }[]
}

/** 慢SQL采集周期明细行（某指纹在某个采集周期内的增量） */
export interface SlowSqlRecordVo {
  collectTime: number
  schemaName: string | null
  digest: string
  digestText: string
  sqlType: 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE' | 'OTHER'
  execCount: number
  avgTimeMs: number
  totalTimeMs: number
  rowsExamined: number
  rowsSent: number
  lockTimeMs: number
  sortRows: number
  noIndexUsed: number
  tmpTables: number
  tmpDiskTables: number
}

/** 单指纹小时级趋势 */
export interface SlowSqlDigestTrendVo {
  instanceId: number
  digest: string
  points: { ts: number; execCount: number; avgTimeMs: number; rowsExamined: number }[]
}

// ─────────────────────────────────────────────
// 最新值批量
// ─────────────────────────────────────────────
export interface MetricLatestVo {
  instanceId: number
  values: Record<string, number | null>
}

// ─────────────────────────────────────────────
// 对象指标 Top N
// ─────────────────────────────────────────────
export interface ObjectItem {
  objectName: string
  objectType: string
  value: number
  collectTimeMs: number
}

export interface MetricObjectVo {
  instanceId: number
  metricCode: string
  items: ObjectItem[]
}

// ─────────────────────────────────────────────
// 长连接
// ─────────────────────────────────────────────
export interface LongConnRow {
  connId: number
  connUser: string
  connHost: string
  connDb: string
  command: string
  timeSeconds: number
  state: string
  info: string
  collectTimeMs: number
}

export interface LongConnVo {
  instanceId: number
  connections: LongConnRow[]
}

// ─────────────────────────────────────────────
// 容量增长趋势
// ─────────────────────────────────────────────
export interface CapacityDailyPoint {
  day: string
  currentBytes: number
  prevWeekBytes: number | null
  growthBytes: number | null
  growthRatePct: number | null
}

export interface CapacityGrowthVo {
  instanceId: number
  trend: CapacityDailyPoint[]
}

/** 容量预测（预计剩余可用天数） */
export interface CapacityForecastVo {
  instanceId: number
  currentBytes: number | null
  dailyGrowthBytes: number | null
  sampleDays: number | null
  diskMount: string | null
  diskTotalBytes: number | null
  diskAvailBytes: number | null
  diskUsagePercent: number | null
  estimatedDaysRemaining: number | null
  note: string | null
}

// ─────────────────────────────────────────────
// 表级周环比
// ─────────────────────────────────────────────
export interface TableGrowthRow {
  objectName: string
  objectType: string
  currentBytes: number
  prevWeekBytes: number | null
  growthBytes: number | null
  growthRatePct: number | null
}

export interface TableGrowthVo {
  instanceId: number
  metricCode: string
  tables: TableGrowthRow[]
}

// ─────────────────────────────────────────────
// 今日累计
// ─────────────────────────────────────────────
export interface TodayStatsVo {
  instanceId: number
  tmpTablesToday: number
  tmpDiskTablesToday: number
  slowQueriesToday: number
  diskRatioPct: number
}

// ─────────────────────────────────────────────
// 配置参数当前值
// ─────────────────────────────────────────────
export interface ParamItem {
  paramName: string
  metricCode: string
  valueType: 'numeric' | 'text'
  value: string | null
  hasValue: boolean
}

export interface ParamCurrentVo {
  instanceId: number
  params: ParamItem[]
}

// ─────────────────────────────────────────────
// 配置参数元数据
// ─────────────────────────────────────────────
export interface ParamMetaVo {
  paramName: string
  displayName: string
  category: string
  isDynamic: boolean
  unit: string
  description: string
  minVersion: string
  maxVersion: string | null
}

// ─────────────────────────────────────────────
// 配置参数分页条目（合并当前值+元数据）
// ─────────────────────────────────────────────
export interface ParamPageItemVo {
  paramName: string
  metricCode: string
  valueType: 'numeric' | 'text'
  value: string | null
  hasValue: boolean
  displayName: string | null
  category: string | null
  isDynamic: boolean | null
  unit: string | null
  description: string | null
}

// ─────────────────────────────────────────────
// 参数调优建议（规则化体检，只出建议不出手）
// ─────────────────────────────────────────────
export interface ParamAdviceVo {
  paramName: string
  displayName: string
  currentValue: string
  observation: string
  advice: string
  level: 'warning' | 'info'
}

// ─────────────────────────────────────────────
// 文本指标
// ─────────────────────────────────────────────
export interface MetricTextVo {
  instanceId: number
  values: Record<string, string | null>
}

// ─────────────────────────────────────────────
// 告警事件
// ─────────────────────────────────────────────
export interface AlertEventVo {
  id: number
  eventCode: string
  ruleId: number
  ruleName: string
  /** 告警级别字典值（dict_type=alert_level，由字典驱动） */
  ruleLevel: string
  instanceId: number
  instanceName: string
  triggerValue: string | null
  thresholdValue: string | null
  /** 布尔型规则事件（复制线程停止等）：触发值/阈值为 0/1 无业务含义，应展示状态化文案 */
  booleanCondition?: boolean | null
  alertMessage?: string | null
  dimensionKey: string | null
  triggerCount: number
  triggerTime: string
  lastTriggerTime: string
  durationSeconds: number
  status: 'pending' | 'confirmed' | 'handling' | 'recovered' | 'closed' | 'ignored'
  assignee: string | null
  confirmUserId?: number | null
  confirmUserName?: string | null
  silenceUserId?: number | null
  silenceUserName?: string | null
  closeUserId?: number | null
  closeUserName?: string | null
  silenceUntilTime?: string | null
  evalState?: 'normal' | 'metric_missing' | string | null
  evalMessage?: string | null
  lastEvalTime?: string | null
  /** 最近一次处置备注（confirm/handling/silence/close 时填写） */
  lastRemark?: string | null
  /** 事件来源（字典 event_source）：rule=告警规则 / scenario=场景综合诊断 / system=系统事件 */
  eventSource?: string | null
  /** 场景编码（仅场景综合事件） */
  scenarioCode?: string | null
  /** 场景事件触发时信号快照 */
  signalsSnapshot?: ScenarioSignal[] | null
  /** 场景关联知识库文章（仅场景综合事件） */
  knowledgeArticles?: { id: number; title: string }[] | null
  /** 阻塞链现场快照（锁相关事件建单时即席抓取） */
  blockingChainSnapshot?: BlockingChainSnapshot | null
}

/** 阻塞链现场快照（锁相关告警建单时抓取的一次性现场） */
export interface BlockingChainSnapshot {
  capturedAt?: string
  dbVersion?: string | null
  total?: number
  error?: string | null
  rows?: BlockingChainRow[]
}

/** 阻塞链单行：谁阻塞谁 */
export interface BlockingChainRow {
  waitAgeSecs?: number | null
  lockedTable?: string | null
  lockedType?: string | null
  waitingPid?: number | null
  waitingQuery?: string | null
  blockingPid?: number | null
  blockingQuery?: string | null
}

/** 场景信号状态（列表实时状态与事件触发快照共用结构） */
export interface ScenarioSignal {
  code: string
  name: string
  expr: string
  metricCode?: string
  currentVal: string
  met: boolean
  /** met=满足 / normal=未满足 / unknown=数据缺失 */
  state: 'met' | 'normal' | 'unknown'
  /** 条件类型：threshold=阈值 / rate_change=环比 */
  condType?: 'threshold' | 'rate_change'
  operator?: string
  /** 生效阈值（实例级覆盖后） */
  threshold?: number
  /** 场景模板默认阈值 */
  defaultThreshold?: number
  unit?: string
}

/** 监控场景（场景管理页） */
export interface ScenarioVo {
  id: number
  scenarioCode: string
  scenarioName: string
  description?: string | null
  /** 级别字典值（alert_level） */
  severity: string
  /** AND=全部满足才触发 / OR=任一满足即触发 */
  logic: 'AND' | 'OR' | string
  /** 触发持续时长（秒），0=立即触发 */
  duration?: number
  enabled: boolean
  /** triggered=触发中 / normal=正常 / disabled=已停用 / unknown=数据缺失 */
  currentStatus: 'triggered' | 'normal' | 'disabled' | 'unknown'
  triggerCount: number
  signals: ScenarioSignal[]
  /** 诊断结论（详情返回；仅触发中有值，为按命中信号渲染后的结论） */
  diagnosis?: string | null
  /** 诊断结论模板（详情返回；未触发时供预览触发后的诊断输出） */
  diagnosisTemplate?: string | null
  /** 关联知识库文章（详情返回） */
  knowledgeArticles?: { id: number; title: string; category?: string }[] | null
  builtin?: boolean
  /** 系统推荐的常用场景（「一键开启常用」圈选范围） */
  recommended?: boolean
}

/** 场景列表响应（含统计卡片数据） */
export interface ScenarioPageVo {
  /** 适配当前实例的场景总数（不含页签过滤） */
  total: number
  /** 当前页签过滤后的总数（分页组件用） */
  filteredTotal: number
  enabledCount: number
  disabledCount: number
  /** 当前页场景列表 */
  scenarios: ScenarioVo[]
}

export interface AlertEventOperateLogVo {
  id: number
  eventId: number
  operateType: 'confirm' | 'handling' | 'silence' | 'close' | string
  fromStatus: string
  toStatus: string
  operatorId: number | null
  operatorName: string | null
  remark: string | null
  createdAt: string
}

export interface AlertNotifyRecordVo {
  id: number
  eventId: number
  eventCode: string | null
  ruleCode: string | null
  notifyKind: 'trigger' | 'recovery' | string
  channel: 'webhook' | 'email' | 'sms' | string
  provider: string | null
  target: string | null
  status: 'pending' | 'sending' | 'success' | 'failed' | 'dead' | string
  responseCode: string | null
  responseBody: string | null
  errorMessage: string | null
  retryCount: number
  maxRetry: number
  nextRetryTime: string | null
  sentAt: string | null
  createdAt: string | null
  updatedAt: string | null
}
