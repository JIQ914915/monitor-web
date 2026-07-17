import type { MenuNode } from '@/types'
import type { DbInstance } from '@/types'

/**
 * 监控视图（code=monitor）下的数据库类型分组 → 实例 dbType 展示名映射。
 * 新增数据库类型时：后端在 sys_menu 下新增 monitor_<type> 分组，这里登记映射即可。
 */
const MENU_GROUP_DB_TYPE: Record<string, string> = {
  monitor_mysql: 'MySQL',
  monitor_pg: 'PostgreSQL',
  monitor_sqlserver: 'SQL Server'
}

/** 数据库类型 → 实例级页面的路由前缀（与 sys_menu 中 monitor_<type> 分组的 route 一致） */
const TYPE_PATH_PREFIX: Record<string, string> = {
  MySQL: '/monitor/mysql',
  PostgreSQL: '/monitor/pg',
  'SQL Server': '/monitor/sqlserver'
}

/** 数据库类型对应的实例页面前缀；未知类型返回 null，禁止静默落入 MySQL。 */
export function getTypePathPrefix(dbType?: string | null): string | null {
  return dbType ? TYPE_PATH_PREFIX[dbType] ?? null : null
}

/** 各数据库类型的实时概况路由（与 sys_menu route 层级一致）。 */
export function getRealtimePath(dbType?: string | null): string | null {
  const prefix = getTypePathPrefix(dbType)
  return prefix ? prefix + '/realtime' : null
}

/** 当前实例类型下的告警下钻（事件分析）页路径。 */
export function getDrilldownPath(dbType?: string | null): string | null {
  const prefix = getTypePathPrefix(dbType)
  return prefix ? prefix + '/alert/drilldown' : null
}

/** 当前实例类型下的告警管理页路径。 */
export function getAlertPath(dbType?: string | null): string | null {
  const prefix = getTypePathPrefix(dbType)
  return prefix ? prefix + '/alert' : null
}

/** 实例级页面路径判定（/monitor/** 下的任一类型分组页面） */
export function isInstanceScopedPath(path: string): boolean {
  return pathTypePrefix(path) != null
}

function pathTypePrefix(path: string): string | null {
  for (const prefix of Object.values(TYPE_PATH_PREFIX)) {
    if (path === prefix || path.startsWith(prefix + '/')) return prefix
  }
  return null
}

/**
 * 切换实例后的路由归属校正：
 * 当前路由属于其它数据库类型的分组时（如在 MySQL 性能分析页切到 PG 实例），
 * 返回新类型下的目标路径——同名子页存在则平移过去，否则回落到该类型的实时概况；
 * 当前路由与新实例类型匹配（或不属于任何类型分组，如总览/系统设置）时返回 null，不跳转。
 * @param hasPage 判断给定路径是否存在可渲染的页面路由（由调用方基于 router 提供）
 */
export function resolvePathAfterSwitch(
  path: string,
  dbType: string | null | undefined,
  hasPage: (p: string) => boolean
): string | null {
  const target = getTypePathPrefix(dbType)
  if (!target) return null
  const current = pathTypePrefix(path)
  if (!current || current === target) return null
  const mapped = target + path.slice(current.length)
  return hasPage(mapped) ? mapped : getRealtimePath(dbType)
}

/**
 * 按当前选中实例的数据库类型过滤「监控视图」下的类型分组：
 * 选中 MySQL 实例只显示 MySQL 分组、PG 实例只显示 PostgreSQL 分组；
 * 未选实例时保留全部分组（点进页面后由 InstanceEmpty 引导选择实例）。
 * 仅影响菜单展示，路由仍全量注册——直接输入 URL 访问不受限，页面自身按实例类型兜底。
 */
export function filterMenusForInstance(menus: MenuNode[], inst: DbInstance | null | undefined): MenuNode[] {
  if (!inst?.dbType) {
    return menus
  }
  return menus.map(node => {
    if (node.name !== 'monitor' || !node.children?.length) {
      return node
    }
    const children = node.children.filter(child => {
      const requiredType = MENU_GROUP_DB_TYPE[child.name ?? '']
      // 非类型分组（如未来的全局子页）不受实例类型影响
      return requiredType == null || requiredType === inst.dbType
    })
    return { ...node, children }
  })
}
