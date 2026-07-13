/**
 * 告警事件下钻分析——画像类型与适配（§11.7 事件下钻与报告）。
 *
 * 画像内容（关联指标 / 可能原因 / 排查路径 / 建议动作）已迁移到数据库
 * （alert_drilldown_profile 表，「系统设置 → 下钻画像」维护），后端在下钻接口中
 * 按触发指标编码完成匹配并随 AlertEventDrilldownVo.profile 下发。
 *
 * 本文件仅保留：
 *   1. 前端展示所需的画像类型定义；
 *   2. 排查路径 link 页面编码 → 路由映射；
 *   3. 服务端画像 → 展示结构的适配器（含字段兜底）。
 *
 * 兜底语义由数据库内置的「通用类」画像（match_rules 为空）承担，
 * 前端不再维护本地兜底内容；接口未返回画像时适配器返回 null，页面按空态降级。
 */
import type { DrilldownProfileVo } from '@/api/alert'

export interface DrilldownMetric {
  code: string
  label: string
  unit: string
  color: string
  /** 字节类指标换算为 GB 展示 */
  toGB?: boolean
  /** 指标实际存储频率；画像未声明时由页面按兼容规则推断 */
  frequency?: '1m' | '1h'
}

export interface DrilldownCause {
  cause: string
  /** 可信度 0-1，页面按此排序展示 */
  confidence: number
  color: 'danger' | 'warning' | 'info'
  evidence: string[]
}

export interface DrilldownStep {
  title: string
  description: string
  action: string
  /** 产品内跳转路由（携带当前实例上下文），为空则只展示说明 */
  link?: string
}

export interface DrilldownAction {
  action: string
  risk: 'low' | 'medium' | 'high'
  description: string
  sql: string
  impact: string
}

export interface DrilldownProfile {
  type: string
  typeLabel: string
  metrics: DrilldownMetric[]
  causes: DrilldownCause[]
  steps: DrilldownStep[]
  actions: DrilldownAction[]
}

/** 不依赖数据库类型的页面编码，以及兼容既有 PG 专属编码。 */
export const STEP_LINKS: Record<string, string> = {
  pg_realtime: '/monitor/pg/realtime',
  pg_replication: '/monitor/pg/replication',
  pg_performance: '/monitor/pg/performance',
  pg_scenario: '/monitor/pg/scenario',
  knowledge: '/system/knowledge',
  collector: '/system/collector'
}

const TYPE_STEP_LINKS: Record<string, Record<string, string>> = {
  mysql: {
    slowsql: '/monitor/mysql/slowsql',
    realtime: '/monitor/mysql/realtime',
    performance: '/monitor/mysql/performance',
    scenario: '/monitor/mysql/scenario'
  },
  postgresql: {
    slowsql: '/monitor/pg/slowsql',
    realtime: '/monitor/pg/realtime',
    performance: '/monitor/pg/performance',
    scenario: '/monitor/pg/scenario',
    replication: '/monitor/pg/replication'
  }
}

/** link 兼容页面编码与绝对路由两种写法；通用编码必须结合画像数据库类型解析。 */
function resolveStepLink(link: unknown, dbType?: string | null): string | undefined {
  if (typeof link !== 'string' || !link) return undefined
  if (link.startsWith('/')) {
    const routeType = link === '/monitor/mysql' || link.startsWith('/monitor/mysql/')
      ? 'mysql'
      : link === '/monitor/pg' || link.startsWith('/monitor/pg/')
        ? 'postgresql'
        : null
    return routeType == null || dbType?.toLowerCase() === routeType ? link : undefined
  }
  return STEP_LINKS[link] ?? (dbType ? TYPE_STEP_LINKS[dbType.toLowerCase()]?.[link] : undefined)
}

const CAUSE_COLORS = new Set(['danger', 'warning', 'info'])
const RISK_LEVELS = new Set(['low', 'medium', 'high'])

function str(v: unknown, fallback = ''): string {
  return typeof v === 'string' ? v : fallback
}

/** 服务端画像（JSON 宽松结构）→ 前端展示结构，逐字段兜底避免脏配置破坏页面；未返回画像时为 null */
export function toDrilldownProfile(vo?: DrilldownProfileVo | null): DrilldownProfile | null {
  if (!vo) return null
  return {
    type: vo.profileCode,
    typeLabel: vo.profileLabel || vo.profileCode,
    metrics: (vo.relatedMetrics ?? [])
      .filter(m => typeof m.code === 'string' && m.code)
      .map(m => ({
        code: m.code as string,
        label: str(m.label, m.code as string),
        unit: str(m.unit),
        color: str(m.color, '#0C7C97'),
        toGB: m.toGB === true,
        frequency: m.frequency === '1m' || m.frequency === '1h' ? m.frequency : undefined
      })),
    causes: (vo.causes ?? [])
      .filter(c => typeof c.cause === 'string' && c.cause)
      .map(c => ({
        cause: c.cause as string,
        confidence: typeof c.confidence === 'number' ? c.confidence : 0.5,
        color: (CAUSE_COLORS.has(str(c.color)) ? c.color : 'info') as DrilldownCause['color'],
        evidence: Array.isArray(c.evidence) ? (c.evidence as unknown[]).map(x => String(x)) : []
      })),
    steps: (vo.steps ?? [])
      .filter(s => typeof s.title === 'string' && s.title)
      .map(s => ({
        title: s.title as string,
        description: str(s.description),
        action: str(s.action, '查看'),
        link: resolveStepLink(s.link, vo.dbType)
      })),
    actions: (vo.actions ?? [])
      .filter(a => typeof a.action === 'string' && a.action)
      .map(a => ({
        action: a.action as string,
        risk: (RISK_LEVELS.has(str(a.risk)) ? a.risk : 'medium') as DrilldownAction['risk'],
        description: str(a.description),
        sql: str(a.sql),
        impact: str(a.impact)
      }))
  }
}
