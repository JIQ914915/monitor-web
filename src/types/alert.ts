import type { PageParam } from '@/types'

export type RuleType = 'builtin' | 'custom'
export type RuleLevel = 'level_1' | 'level_2' | 'level_3' | 'level_4'
export type ResultMode = 'single' | 'multi'
/** 规则数据来源（alert_rule_data_source 字典）：metric 产品库指标 / target_sql 目标库 SQL */
export type RuleDataSource = 'metric' | 'target_sql'

/** 告警规则视图对象 */
export interface AlertRuleVo {
  id: number
  ruleName: string
  ruleCode: string
  ruleType: RuleType
  /** 适用数据库类型 ID（FK → database_type.id） */
  dbTypeId?: number | null
  /** 适用数据库类型（内置规则有值，如 MySQL） */
  dbType: string | null
  /** 适用版本 ID 列表，null/空表示该类型所有版本 */
  dbVersionIds?: number[] | null
  /**
   * 适用版本（逗号分隔 version_code，如 "5.7,8.0"），null 表示该类型所有版本
   */
  dbVersion: string | null
  ruleLevel: RuleLevel
  /** 数据来源（alert_rule_data_source 字典值） */
  dataSource?: RuleDataSource | null
  /** 已启用该规则的实例数（内置规则管理全局视角） */
  enabledInstanceCount?: number | null
  metricName: string | null
  metricCodes?: string[] | null
  description: string | null
  scanIntervalMin?: number | null
  scanIntervalSource?: 'SYSTEM_DEFAULT' | 'USER_OVERRIDE' | null
  minAllowedIntervalMin?: number | null
  metricSamplingMaxIntervalMin?: number | null

  /** 触发条件 */
  operator: string | null
  threshold: number | null
  unit: string | null
  duration: number | null

  /**
   * 条件锁定（布尔型内置规则，如复制线程停止）：
   * 触发/恢复条件由系统固化，仅可修改告警级别、扫描间隔、通知设置与启停
   */
  conditionLocked?: boolean | null
  /** 触发条件友好描述（锁定规则用它替代 "< 1" 类机器语义展示） */
  conditionDisplay?: string | null
  /** 恢复条件友好描述 */
  recoveryDisplay?: string | null

  /** 恢复条件 */
  recoveryOperator: string | null
  recoveryThreshold: number | null
  recoveryDuration: number | null

  /** 通知设置 */
  notifyOnTrigger: boolean | null
  notifyOnRecovery: boolean | null
  channelEmail: boolean | null
  channelSms: boolean | null
  /** URL 类通道仅勾选，地址/密钥在「系统管理→通知通道」全局配置 */
  channelWebhook: boolean | null
  channelDingtalk?: boolean | null
  channelWecom?: boolean | null
  channelFeishu?: boolean | null
  silencePeriod: number | null

  /** 自定义 SQL（custom 类型） */
  customSql: string | null
  resultMode: ResultMode | null
  sqlReturnField: string | null
  entityColumn: string | null
  valueColumn: string | null
  displayTemplate: string | null

  /** 统计 */
  triggerCount: number
  lastTriggerAt: string | null

  /**
   * 当前实例维度的启用状态（内置/自定义规则均由实例级配置决定，
   * 后端 alert_rule 模板表已不再持有 enabled 字段）
   */
  instanceEnabled: boolean
  /** 系统推荐的常用规则（「一键开启常用」圈选范围） */
  recommended?: boolean
  createdBy: string | null
  createdAt: string | null
  updatedAt: string | null
}

/** 分页查询请求 */
export interface AlertRulePageRequest extends PageParam {
  /** 当前实例 ID（推荐必传：过滤该实例适用的内置规则 + 该实例自定义规则） */
  instanceId?: number
  keyword?: string
  ruleLevel?: string
  enabled?: boolean | null
}

/** 保存请求（新建/更新） */
export interface AlertRuleSaveRequest {
  id?: number
  ruleCode?: string
  /** 当前实例 ID（新建自定义规则时必传） */
  instanceId?: number
  ruleName: string
  ruleType?: RuleType
  ruleLevel: RuleLevel
  metricName?: string
  metricCodes?: string[]
  description?: string
  scanIntervalMin?: number

  operator?: string
  threshold?: number | null
  unit?: string
  duration?: number

  recoveryOperator?: string
  recoveryThreshold?: number | null
  recoveryDuration?: number

  notifyOnTrigger?: boolean
  notifyOnRecovery?: boolean
  channelEmail?: boolean
  channelSms?: boolean
  channelWebhook?: boolean
  channelDingtalk?: boolean
  channelWecom?: boolean
  channelFeishu?: boolean
  silencePeriod?: number

  customSql?: string
  resultMode?: ResultMode
  sqlReturnField?: string
  entityColumn?: string
  valueColumn?: string
  displayTemplate?: string

  enabled?: boolean
}

/** 内置规则模板分页查询请求（系统设置 → 内置规则管理） */
export interface BuiltinRulePageRequest extends PageParam {
  keyword?: string
  ruleLevel?: string
  dbTypeId?: number
  dataSource?: RuleDataSource
}

/** 内置规则模板保存请求（新建/更新） */
export interface BuiltinRuleSaveRequest {
  id?: number
  /** 新建必传且全局唯一，更新不可修改 */
  ruleCode?: string
  ruleName: string
  ruleLevel: string
  dbTypeId: number
  /** 空表示该类型所有版本 */
  dbVersionIds?: number[]
  description?: string
  dataSource: RuleDataSource
  metricName?: string
  metricCodes?: string[]
  scanIntervalMin?: number

  operator: string
  threshold: number
  unit?: string
  duration?: number

  customSql?: string
  resultMode?: ResultMode
  sqlReturnField?: string
  entityColumn?: string
  valueColumn?: string
  displayTemplate?: string

  recoveryOperator?: string
  recoveryThreshold?: number
  recoveryDuration?: number

  /** 布尔型（状态类）规则：实例侧锁定条件编辑，页面按状态化文案展示 */
  booleanCondition?: boolean
  /** 触发条件友好描述（布尔型规则） */
  conditionDisplay?: string
  /** 恢复条件友好描述（布尔型规则） */
  recoveryDisplay?: string

  notifyOnTrigger?: boolean
  notifyOnRecovery?: boolean
  channelEmail?: boolean
  channelSms?: boolean
  channelWebhook?: boolean
  channelDingtalk?: boolean
  channelWecom?: boolean
  channelFeishu?: boolean
  silencePeriod?: number
}

/** 通知通道全局配置（系统管理→通知通道） */
export interface NotifyChannelConfig {
  /** 通道：webhook/dingtalk/wecom/feishu */
  channel: string
  /** 全局开关：关闭后勾选了该通道的规则不再发送 */
  enabled: boolean
  /** 通知地址列表 */
  urls: string[]
  /** 签名密钥（钉钉/飞书；已配置时回显掩码 "******"，从不回显真实密钥） */
  secret?: string | null
  updatedAt?: string | null
}

/** 通知通道全局配置保存请求 */
export interface NotifyChannelSaveRequest {
  channel: string
  enabled: boolean
  urls: string[]
  /** 不传或传掩码 "******" 表示不变，空字符串表示清除 */
  secret?: string | null
}
