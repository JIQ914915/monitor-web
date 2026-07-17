import type { AxiosRequestConfig } from 'axios'
import type {
  DbInstance,
  InstanceGroup,
  KnowledgeArticle,
  MenuNode,
  PageResult,
  SysDictItem,
  SysDictType,
  SysMenu,
  SysOperLog,
  SysRole,
  SysUser,
  UserInfo
} from '@/types'

/** 无后端时的本地 mock，便于脚手架直接跑通；联调时设 VITE_USE_MOCK=false 即走真实接口。 */

const MOCK_USER: UserInfo = {
  id: 1,
  username: 'admin',
  nickname: '超级管理员',
  roles: ['super_admin'],
  permissions: ['*:*']
}

// 当前用户菜单树：与后端 /api/v1/auth/menus 一致——层级/路由/组件/显隐/高亮全部来自菜单行
// MOCK_MENU_ROWS（按 parentId 递归装配），菜单管理改动即时生效。
// mock 匹配 axios 相对 path（含版本前缀，如 /v1/auth/menus；baseURL 仅为 /api）
function buildMockMenus(): MenuNode[] {
  const enabled = MOCK_MENU_ROWS.filter((m) => m.status !== 'disabled')
  const byParent = new Map<number | null, SysMenu[]>()
  enabled.forEach((m) => {
    const key = m.parentId ?? null
    if (!byParent.has(key)) byParent.set(key, [])
    byParent.get(key)!.push(m)
  })
  const build = (parentId: number | null): MenuNode[] => {
    const rows = (byParent.get(parentId) || []).slice().sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0))
    return rows.map((m) => {
      const children = build(m.id ?? null)
      const isGroup = m.menuType === 'group'
      const node: MenuNode = {
        path: m.route || '',
        name: m.code,
        component: isGroup ? undefined : m.component,
        redirect: m.redirect || undefined,
        meta: {
          title: m.name,
          icon: m.icon || undefined,
          perm: m.perm || undefined,
          hidden: m.visible === false ? true : undefined,
          activeMenu: m.activeMenu || undefined
        }
      }
      if (children.length) node.children = children
      return node
    })
  }
  return build(null)
}

// 版本编码↔版本ID（对应 database_version 种子）
const VERSION_DEFS = [
  { id: 1, code: '5.6' },
  { id: 2, code: '5.7' },
  { id: 3, code: '8.0' },
  { id: 4, code: '8.4' }
]
const ENVS = ['生产', '测试', '预发']
const LEVELS: DbInstance['healthLevel'][] = ['excellent', 'good', 'warning', 'critical']

function genInstances(n: number): DbInstance[] {
  const list: DbInstance[] = []
  for (let i = 1; i <= n; i++) {
    const health = Math.max(35, Math.min(99, Math.round(60 + 40 * Math.sin(i) + (i % 7) * 3)))
    const level: DbInstance['healthLevel'] =
      health >= 90 ? 'excellent' : health >= 75 ? 'good' : health >= 60 ? 'warning' : 'critical'
    list.push({
      id: i,
      name: `mysql-${ENVS[i % 3] === '生产' ? 'prod' : ENVS[i % 3] === '测试' ? 'test' : 'pre'}-${String(i).padStart(2, '0')}`,
      host: `10.0.${Math.floor(i / 10)}.${i % 256}`,
      port: 3306,
      dbTypeId: 1,
      dbVersionId: VERSION_DEFS[i % VERSION_DEFS.length].id,
      dbType: 'MySQL',
      dbVersion: VERSION_DEFS[i % VERSION_DEFS.length].code,
      remark: `${ENVS[i % 3]}环境示例实例`,
      groupIds: [1 + (i % 3)],
      ownerAId: [1, 2, 3][i % 3],
      ownerBId: [4, 3, 2][i % 3],
      health,
      healthLevel: level,
      status: i % 11 === 0 ? 'paused' : health < 75 ? 'abnormal' : 'normal'
    })
  }
  return list
}

const INSTANCES = genInstances(36)

// ===== 管理模块本地 mock 数据（VITE_USE_MOCK=true 时使用） =====
let seq = 1000
const nextId = () => ++seq

const MOCK_ROLES: SysRole[] = [
  { id: 1, code: 'super_admin', name: '系统管理员', type: 'preset', status: 'enabled', description: '系统内置角色，拥有全部权限', permissions: ['*:*'], createTime: '2024-01-01 00:00:00' },
  { id: 2, code: 'dba', name: 'DBA 用户', type: 'preset', status: 'enabled', description: '数据库管理员', permissions: ['system_instance', 'alert_rule:view', 'alert_rule:add', 'collector:view'], createTime: '2024-01-01 00:00:00' },
  { id: 3, code: 'ops', name: '运维用户', type: 'preset', status: 'enabled', description: '运维人员', permissions: ['system_instance', 'alert_rule:view'], createTime: '2024-01-01 00:00:00' },
  { id: 4, code: 'auditor', name: '只读审计用户', type: 'preset', status: 'enabled', description: '只读审计', permissions: ['system_instance', 'audit_log:view'], createTime: '2024-01-01 00:00:00' }
]

const MOCK_USERS: SysUser[] = [
  { id: 1, username: 'admin', nickname: '超级管理员', email: 'admin@example.com', phone: '13800000001', roles: ['super_admin'], enabled: true, lastLoginTime: '2024-06-01 08:30:00', createTime: '2024-01-01 00:00:00' },
  { id: 2, username: 'dba01', nickname: '李娜', email: 'lina@example.com', phone: '13800000002', roles: ['dba'], enabled: true, lastLoginTime: '2024-05-28 14:05:00', createTime: '2024-02-10 09:12:00' },
  { id: 3, username: 'ops01', nickname: '王强', email: 'wangqiang@example.com', phone: '13800000003', roles: ['ops'], enabled: true, lastLoginTime: '2024-05-30 10:22:00', createTime: '2024-03-05 14:30:00' },
  { id: 4, username: 'audit01', nickname: '赵敏', email: 'zhaomin@example.com', phone: '13800000004', roles: ['auditor'], enabled: false, createTime: '2024-04-18 11:00:00' }
]

function roleUserCount(code: string) {
  return MOCK_USERS.filter((u) => (u.roles || []).includes(code)).length
}

const MOCK_GROUPS: InstanceGroup[] = [
  { id: 1, name: '核心业务组', parentId: null, ownerId: 1, memberIds: [2, 3], description: '核心业务系统数据库分组', instanceCount: 12, createTime: '2024-01-01 00:00:00' },
  { id: 2, name: '测试环境组', parentId: null, ownerId: 2, memberIds: [3], description: '测试环境实例', instanceCount: 8, createTime: '2024-01-02 00:00:00' },
  { id: 3, name: '华东区域', parentId: 1, ownerId: 3, memberIds: [], description: '华东机房', instanceCount: 5, createTime: '2024-01-03 00:00:00' }
]

// 菜单行：层级/路由/组件/显隐全部入表（与后端 sys_menu 一致），route 为相对父级的 path 段
const MOCK_MENU_ROWS: SysMenu[] = [
  { id: 1, name: '实例管理', code: 'instances', type: '系统级', menuType: 'menu', parentId: 8, icon: 'Coin', route: 'instances', component: 'system/instance/list', perm: 'system_instance', sort: 9, visible: true, status: 'enabled', description: '数据库实例管理' },
  { id: 3, name: '监控视图', code: 'monitor', type: '实例级', menuType: 'group', parentId: null, icon: 'TrendCharts', route: 'monitor', perm: '', sort: 2, visible: true, status: 'enabled', description: '监控视图分组' },
  { id: 30, name: 'MySQL', code: 'monitor_mysql', type: '实例级', menuType: 'group', parentId: 3, icon: 'Coin', route: 'mysql', perm: '', sort: 1, visible: true, status: 'enabled', description: 'MySQL 实例监控分组' },
  { id: 4, name: '实时概况', code: 'realtime', type: '实例级', menuType: 'menu', parentId: 30, icon: 'TrendCharts', route: 'realtime', component: 'monitor/mysql/realtime', perm: '', sort: 2, visible: true, status: 'enabled', description: '实例实时监控概况' },
  { id: 5, name: '告警中心', code: 'alert', type: '实例级', menuType: 'menu', parentId: 30, icon: 'Bell', route: 'alert', component: 'monitor/mysql/alert', perm: '', sort: 3, visible: true, status: 'enabled', description: '告警事件中心' },
  { id: 6, name: '慢查询', code: 'slowsql', type: '实例级', menuType: 'menu', parentId: 30, icon: 'Warning', route: 'slowsql', component: 'monitor/mysql/slowsql', perm: '', sort: 4, visible: true, status: 'enabled', description: '慢SQL分析' },
  { id: 7, name: '报表', code: 'report', type: '实例级', menuType: 'menu', parentId: 30, icon: 'Document', route: 'report', component: 'monitor/mysql/report', perm: '', sort: 5, visible: true, status: 'enabled', description: '巡检/事件报表' },
  { id: 8, name: '系统设置', code: 'system', type: '系统级', menuType: 'group', parentId: null, icon: 'Setting', route: 'system', perm: '', sort: 10, visible: true, status: 'enabled', description: '系统设置分组' },
  { id: 9, name: '用户管理', code: 'system_user', type: '系统级', menuType: 'menu', parentId: 8, icon: 'User', route: 'user', component: 'system/user', perm: 'system_user', sort: 10, visible: true, status: 'enabled', description: '系统用户管理' },
  { id: 10, name: '角色管理', code: 'system_role', type: '系统级', menuType: 'menu', parentId: 8, icon: 'UserFilled', route: 'role', component: 'system/role', perm: 'system_role', sort: 11, visible: true, status: 'enabled', description: '角色与权限管理' },
  { id: 11, name: '实例分组', code: 'system_group', type: '系统级', menuType: 'menu', parentId: 8, icon: 'FolderOpened', route: 'group', component: 'system/group', perm: '', sort: 12, visible: true, status: 'enabled', description: '实例分组管理' },
  { id: 12, name: '菜单管理', code: 'system_menu', type: '系统级', menuType: 'menu', parentId: 8, icon: 'Menu', route: 'menu', component: 'system/menu', perm: 'system_menu', sort: 13, visible: true, status: 'enabled', description: '菜单管理' },
  { id: 13, name: '数据保留', code: 'data_retention', type: '系统级', menuType: 'menu', parentId: 8, icon: 'Clock', route: 'retention', component: 'system/retention', perm: 'data_retention', sort: 14, visible: true, status: 'enabled', description: '数据保留策略' },
  { id: 14, name: '操作日志', code: 'audit_log', type: '系统级', menuType: 'menu', parentId: 8, icon: 'List', route: 'log', component: 'system/log', perm: 'audit_log:view', sort: 15, visible: true, status: 'enabled', description: '操作审计日志' },
  {
    id: 15, name: '知识库', code: 'knowledge', type: '系统级', menuType: 'menu', parentId: 8, icon: 'Collection',
    route: 'knowledge', component: 'system/knowledge', perm: 'knowledge', sort: 16, visible: true, status: 'enabled',
    description: '数据库运维知识库',
    buttons: [
      { name: '新增', code: 'knowledge:create', status: 'enabled' },
      { name: '编辑', code: 'knowledge:update', status: 'enabled' },
      { name: '删除', code: 'knowledge:delete', status: 'enabled' }
    ]
  },
  {
    id: 16, name: '字典管理', code: 'system_dict', type: '系统级', menuType: 'menu', parentId: 8, icon: 'Notebook',
    route: 'dict', component: 'system/dict', perm: 'system_dict', sort: 17, visible: true, status: 'enabled',
    description: '数据字典维护',
    buttons: [
      { name: '新增', code: 'dict:create', status: 'enabled' },
      { name: '编辑', code: 'dict:update', status: 'enabled' },
      { name: '删除', code: 'dict:delete', status: 'enabled' }
    ]
  }
]

// 为页面型菜单补齐默认按钮权限点（演示用；目录/隐藏页面不含按钮）
const DEFAULT_MENU_ACTIONS = [
  { name: '查看', action: 'view' },
  { name: '新增', action: 'create' },
  { name: '编辑', action: 'update' },
  { name: '删除', action: 'delete' },
  { name: '导出', action: 'export' }
]
MOCK_MENU_ROWS.forEach((m) => {
  if (!m.buttons && m.menuType === 'menu' && m.visible !== false) {
    m.buttons = DEFAULT_MENU_ACTIONS.map((a) => ({ name: a.name, code: `${m.code}:${a.action}`, status: 'enabled' }))
  }
})

// 数据字典（类型 + 项）
const MOCK_DICT_TYPES: SysDictType[] = [
  { id: 1, dictType: 'instance_status', dictName: '实例状态', type: 'system', status: 'enabled', remark: '数据库实例采集状态', createTime: '2024-01-01 00:00:00' },
  { id: 2, dictType: 'role_type', dictName: '角色类型', type: 'system', status: 'enabled', remark: '系统角色类型（预设不可删除）', createTime: '2024-01-01 00:00:00' },
  { id: 3, dictType: 'enable_status', dictName: '启用状态', type: 'system', status: 'enabled', remark: '通用启用/停用状态（菜单、角色、字典等）', createTime: '2024-01-01 00:00:00' },
  { id: 4, dictType: 'dict_type_scope', dictName: '字典类型范围', type: 'system', status: 'enabled', remark: '字典类型的系统级/自定义分类', createTime: '2024-01-01 00:00:00' }
]
const MOCK_DICT_ITEMS: SysDictItem[] = [
  { id: 1, dictType: 'instance_status', itemValue: 'normal', itemLabel: '正常', tagType: 'success', sort: 1, status: 'enabled' },
  { id: 2, dictType: 'instance_status', itemValue: 'abnormal', itemLabel: '异常', tagType: 'danger', sort: 2, status: 'enabled' },
  { id: 3, dictType: 'instance_status', itemValue: 'paused', itemLabel: '暂停', tagType: 'info', sort: 3, status: 'enabled' },
  { id: 4, dictType: 'role_type', itemValue: 'preset', itemLabel: '预设', tagType: 'success', sort: 1, status: 'enabled' },
  { id: 5, dictType: 'role_type', itemValue: 'custom', itemLabel: '自定义', tagType: 'info', sort: 2, status: 'enabled' },
  { id: 6, dictType: 'enable_status', itemValue: 'enabled',  itemLabel: '启用', tagType: 'success', sort: 1, status: 'enabled' },
  { id: 7, dictType: 'enable_status', itemValue: 'disabled', itemLabel: '停用', tagType: 'info',    sort: 2, status: 'enabled' },
  { id: 8, dictType: 'dict_type_scope', itemValue: 'system', itemLabel: '系统级', tagType: 'success', sort: 1, status: 'enabled' },
  { id: 9, dictType: 'dict_type_scope', itemValue: 'custom', itemLabel: '自定义', tagType: 'info', sort: 2, status: 'enabled' }
]

const RETENTION_FACTORY: Record<string, number> = { minute: 7, hourly: 30, daily: 365, event: 365, log: 180, report: 365 }
const MOCK_RETENTION = Object.entries(RETENTION_FACTORY).map(([category, retentionDays], i) => ({
  id: i + 1,
  category,
  retentionDays,
  enabled: true
}))

const OPER_ACTIONS = ['新增', '修改', '删除', '启停', '保存配置']
const OPER_MODULES = ['用户管理', '角色管理', '分组管理', '菜单管理', '数据保留', '实例管理']
const MOCK_OPER_LOGS: SysOperLog[] = Array.from({ length: 60 }, (_, i) => {
  const d = new Date(Date.now() - i * 3600 * 1000 * 5)
  return {
    id: i + 1,
    operTime: d.toISOString().slice(0, 19).replace('T', ' '),
    username: MOCK_USERS[i % MOCK_USERS.length].username,
    module: OPER_MODULES[i % OPER_MODULES.length],
    action: OPER_ACTIONS[i % OPER_ACTIONS.length],
    target: `对象_${100 + i}`,
    ip: `192.168.${i % 5}.${10 + (i % 200)}`,
    success: i % 13 !== 0,
    detail: i % 13 !== 0 ? '操作成功' : '权限不足'
  }
})

const MOCK_ARTICLES: KnowledgeArticle[] = [
  {
    id: 1, title: 'MySQL 慢查询优化指南', category: 'performance', tags: ['MySQL', '性能优化', '慢查询'],
    content: '<h2>概述</h2><p>慢查询是数据库性能问题的常见来源。本文介绍定位与优化的通用方法。</p><h3>定位手段</h3><ul><li>开启慢查询日志（<code>slow_query_log</code>），设置合理的 <code>long_query_time</code>。</li><li>使用 <code>EXPLAIN</code> 分析执行计划，关注全表扫描与临时表。</li></ul><h3>优化建议</h3><ol><li>为高频过滤字段建立合适索引，避免索引失效。</li><li>避免 <code>SELECT *</code>，只取所需列。</li></ol>',
    author: '张三', views: 1280, likes: 96, createTime: '2024-05-01 10:00:00', updateTime: '2024-06-10 09:00:00'
  },
  {
    id: 2, title: 'PostgreSQL 索引最佳实践', category: 'postgresql', tags: ['PostgreSQL', '索引'],
    content: '<h2>索引类型选择</h2><p>按查询模式选择 B-Tree、GIN、BRIN 等索引类型。</p><ul><li><strong>B-Tree</strong>：等值与范围查询默认选择。</li><li><strong>GIN</strong>：数组、JSONB、全文检索。</li><li><strong>BRIN</strong>：物理有序的大表（时间序列）。</li></ul>',
    author: '李四', views: 860, likes: 54, createTime: '2024-05-03 14:00:00', updateTime: '2024-06-02 11:20:00'
  },
  {
    id: 3, title: '主从复制延迟排查方法', category: 'fault', tags: ['复制', '故障诊断'],
    content: '<h2>常见原因</h2><ol><li>从库单线程回放，可开启并行复制缓解。</li><li>大事务或长事务导致回放阻塞。</li><li>从库硬件/IO 能力不足。</li></ol><h2>排查步骤</h2><p>查看 <code>SHOW REPLICA STATUS</code> 中的 <code>Seconds_Behind_Master</code>。</p>',
    author: '王五', views: 642, likes: 38, createTime: '2024-04-20 09:00:00', updateTime: '2024-05-28 16:00:00'
  },
  {
    id: 4, title: '数据库备份策略详解', category: 'backup', tags: ['备份恢复', '运维'],
    content: '<h2>备份分层</h2><p>建议采用「全量 + 增量 + binlog」组合，兼顾 RPO 与 RTO。</p><ul><li>物理备份：xtrabackup / pg_basebackup。</li><li>逻辑备份：mysqldump / pg_dump。</li></ul><p>务必定期做<strong>恢复演练</strong>。</p>',
    author: '张三', views: 991, likes: 71, createTime: '2024-04-10 08:00:00', updateTime: '2024-05-15 10:30:00'
  },
  {
    id: 5, title: '高可用架构设计方案', category: 'practice', tags: ['高可用', '架构', '最佳实践'],
    content: '<h2>目标</h2><p>消除单点故障，保证故障时快速切换且数据不丢失。</p><h2>常见方案</h2><ul><li>MySQL：MHA / MGR / Orchestrator。</li><li>PostgreSQL：Patroni + etcd + HAProxy。</li></ul>',
    author: '李四', views: 1530, likes: 120, createTime: '2024-03-28 09:00:00', updateTime: '2024-06-12 15:00:00'
  }
]

function pageSlice<T>(rows: T[], pageNum: number, pageSize: number): PageResult<T> {
  const start = (pageNum - 1) * pageSize
  return { list: rows.slice(start, start + pageSize), total: rows.length }
}

function delay<T>(data: T, ms = 250): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(data), ms))
}

function parseBody(data: unknown): Record<string, unknown> {
  if (!data) return {}
  if (typeof data === 'string') {
    try {
      return JSON.parse(data) as Record<string, unknown>
    } catch {
      return {}
    }
  }
  return data as Record<string, unknown>
}

export function mockAdapter<T>(config: AxiosRequestConfig): Promise<T> {
  const url = config.url || ''
  // POST 入参统一在 body：request() 直接透传对象，axios 联调态可能是 JSON 字符串
  const body = parseBody(config.data)

  if (url === '/v1/auth/login') {
    return delay({ token: 'mock-jwt-token' } as unknown as T)
  }
  if (url === '/v1/auth/info') {
    return delay(MOCK_USER as unknown as T)
  }
  if (url === '/v1/auth/menus') {
    return delay(buildMockMenus() as unknown as T)
  }
  // 账号级主题偏好：mock 模式用 localStorage 持久化（单机演示）
  if (url === '/v1/preference/theme') {
    if ((config.method || 'get').toLowerCase() === 'post') {
      localStorage.setItem('theme-pref', JSON.stringify(body))
      return delay(undefined as unknown as T)
    }
    const raw = localStorage.getItem('theme-pref')
    return delay((raw ? JSON.parse(raw) : null) as unknown as T)
  }
  if (url === '/v1/instances/page') {
    const kw = String(body.keyword ?? '').trim().toLowerCase()
    const filtered = INSTANCES.filter((i) => {
      if (kw && !i.name.toLowerCase().includes(kw) && !i.host.toLowerCase().includes(kw)) return false
      if (body.dbTypeId && i.dbTypeId !== Number(body.dbTypeId)) return false
      if (body.status && i.status !== body.status) return false
      if (body.groupId && !(i.groupIds || []).includes(Number(body.groupId))) return false
      return true
    })
    return delay(pageSlice(filtered, Number(body.pageNum ?? 1), Number(body.pageSize ?? 10)) as unknown as T)
  }
  if (url === '/v1/instances/all') {
    return delay(INSTANCES as unknown as T)
  }
  if (url === '/v1/instances' && isPost(config)) {
    const ins: DbInstance = { ...(body as unknown as DbInstance), id: nextId(), health: 80, healthLevel: 'good', status: 'normal' }
    INSTANCES.unshift(ins)
    return delay(ins.id as unknown as T)
  }
  if (url === '/v1/instances/update') {
    upsert(INSTANCES, body as unknown as DbInstance)
    return delay(undefined as unknown as T)
  }
  if (url === '/v1/instances/delete') {
    removeById(INSTANCES, Number(body.id))
    return delay(undefined as unknown as T)
  }
  if (url === '/v1/instances/toggle') {
    const ins = INSTANCES.find((i) => i.id === Number(body.id))
    if (ins) ins.status = String(body.status) as DbInstance['status']
    return delay(undefined as unknown as T)
  }
  if (url === '/v1/instances/get') {
    return delay((INSTANCES.find((i) => i.id === Number(body.id)) ?? null) as unknown as T)
  }
  if (url === '/v1/llm/config/get') {
    return delay(({
      enabled: false, baseUrl: '', apiKey: '', model: '',
      timeoutSeconds: 60, allowExternal: false, desensitize: true
    }) as unknown as T)
  }
  if (url === '/v1/llm/config/save') {
    return delay(undefined as unknown as T)
  }
  if (url === '/v1/llm/analysis/get') {
    return delay(null as unknown as T)
  }
  if (url === '/v1/llm/analyze') {
    return delay(({
      eventId: Number(body.eventId), success: true,
      summary: '实例 mysql-prod-01 在 14:32 出现连接数接近上限的告警：当前连接数 950，已达最大连接数（1000）的 95%。若持续增长，新连接将被拒绝，可能造成业务请求失败。',
      causes: ['应用连接池配置过大或泄漏，连接未及时归还', '存在大量慢查询导致连接长时间占用', '业务高峰期访问量突增'],
      suggestions: ['检查应用连接池配置（maxActive/maxIdle）与连接泄漏情况', '结合慢SQL分析页排查是否有长耗时查询占用连接', '如确属业务增长，评估后由 DBA 调整 max_connections（需人工确认）'],
      errorMessage: null, model: 'mock-llm', durationMs: 1200,
      operatorName: 'admin', createdAt: new Date().toISOString().slice(0, 19).replace('T', ' ')
    }) as unknown as T)
  }
  if (url === '/v1/llm/slowsql/analyze') {
    return delay(({
      eventId: null, success: true,
      summary: '该 SQL 平均耗时 2.3 秒且窗口内 128 次执行均未使用索引，扫描/返回比达 4500，属于典型的全表扫描慢查询，对实例整体吞吐有明显影响。',
      causes: ['WHERE 条件列 order_status + created_at 上缺少复合索引，优化器只能全表扫描', 'SELECT * 返回全部列，无法利用覆盖索引', 'ORDER BY created_at 未走索引有序性，产生 filesort'],
      suggestions: ['为 (order_status, created_at) 创建复合索引，创建前用 EXPLAIN 验证（DDL 需评估锁表影响并在低峰窗口人工执行）', '只查询业务需要的列，替换 SELECT *', '列表查询增加 LIMIT 分页，减少单次返回行数'],
      errorMessage: null, model: 'mock-llm', durationMs: 1500,
      operatorName: 'admin', createdAt: new Date().toISOString().slice(0, 19).replace('T', ' ')
    }) as unknown as T)
  }
  if (url === '/v1/metrics/params/advice') {
    return delay(([
      {
        paramName: 'innodb_buffer_pool_size', displayName: 'InnoDB 缓冲池大小', currentValue: '128 MB',
        observation: 'Buffer Pool 命中率当前 91.2%（健康线 95%），存在明显物理读',
        advice: '在主机内存允许的前提下评估增大缓冲池（一般建议为专用数据库服务器内存的 50%~70%）；同时结合慢SQL分析确认是否存在大范围全表扫描把热数据挤出缓冲池',
        level: 'warning'
      },
      {
        paramName: 'slow_query_log', displayName: '慢查询日志', currentValue: 'OFF',
        observation: '慢查询日志未开启，无法留存慢 SQL 现场',
        advice: '建议开启：SET GLOBAL slow_query_log=ON（开销很小）；并将 long_query_time 设为 1~2 秒',
        level: 'warning'
      },
      {
        paramName: 'query_cache_size', displayName: '查询缓存大小', currentValue: '64 MB',
        observation: '查询缓存已启用（MySQL 5.7.36）。高并发下查询缓存互斥锁常成为瓶颈，官方已在 8.0 移除该特性',
        advice: '除非是极端读多写少且命中率经实测很高的场景，建议设置 query_cache_type=0、query_cache_size=0 关闭',
        level: 'info'
      }
    ]) as unknown as T)
  }
  if (url === '/v1/instances/capabilities') {
    return delay(([
      { capability: 'collect', name: '指标采集', status: 'available' },
      { capability: 'top_sql', name: 'Top SQL 指纹分析', status: 'available' },
      { capability: 'slow_sql_sample', name: '慢SQL样本', status: 'available' },
      { capability: 'lock_analysis', name: '锁等待与阻塞链', status: 'available' },
      { capability: 'error_log', name: '错误日志监控', status: 'version_not_support', message: '需 MySQL 8.0.22+（performance_schema.error_log 表）' },
      { capability: 'host_metrics', name: '主机资源监控', status: 'not_applicable', message: '未关联主机：请在「实例管理」编辑实例并选择所在主机' }
    ]) as unknown as T)
  }
  if (url === '/v1/instances/test-connection') {
    const verMap: Record<string, string> = {
      MYSQL: '8.0.32', MySQL: '8.0.32', POSTGRESQL: '15.4', ORACLE: '19c', SQLSERVER: '2019'
    }
    return delay(({
      version: verMap[Number(body.dbTypeId)] || 'unknown',
      checks: [
        { name: 'PROCESS 权限', granted: true },
        { name: 'REPLICATION CLIENT 权限', granted: false, affected: '复制状态监控、binlog 容量统计', grantHint: "GRANT REPLICATION CLIENT ON *.* TO 'monitor'@'%';" },
        { name: 'performance_schema 查询', granted: true },
        { name: 'sys schema 访问', granted: true },
        { name: 'information_schema 查询', granted: true }
      ]
    }) as unknown as T)
  }
  if (url === '/v1/instances/summary') {
    const total = INSTANCES.length
    // online 口径=采集中(非暂停)，offline=暂停采样
    const paused = INSTANCES.filter((i) => i.status === 'paused').length
    const online = total - paused
    const avgHealth = Math.round(INSTANCES.reduce((s, i) => s + i.health, 0) / total)
    const dist = LEVELS.map((lv) => ({
      level: lv,
      count: INSTANCES.filter((i) => i.healthLevel === lv).length
    }))
    return delay({ total, online, offline: paused, avgHealth, dist } as unknown as T)
  }
  if (url === '/v1/instances/fleet-overview') {
    const total = INSTANCES.length
    const paused = INSTANCES.filter((i) => i.status === 'paused').length
    const abnormal = INSTANCES.filter((i) => i.status === 'abnormal').length
    const alert = INSTANCES.filter((i) => i.status === 'normal' && (i.health ?? 100) < 75).length
    const normal = total - paused - abnormal - alert
    const avgHealth = total ? Math.round(INSTANCES.reduce((s, i) => s + (i.health ?? 0), 0) / total) : -1
    const byType = new Map<string, { name: string; total: number; normal: number; alert: number }>()
    INSTANCES.forEach((i) => {
      const t = byType.get(i.dbType || '未知类型') ?? { name: i.dbType || '未知类型', total: 0, normal: 0, alert: 0 }
      t.total++
      if (i.status === 'normal') t.normal++
      if ((i.health ?? 100) < 75) t.alert++
      byType.set(t.name, t)
    })
    const topRisk = [...INSTANCES]
      .filter((i) => i.status !== 'paused' && (i.health ?? 100) < 80)
      .sort((a, b) => (a.health ?? -1) - (b.health ?? -1))
      .slice(0, 10)
      .map((i, idx) => ({
        id: i.id, name: i.name, dbType: i.dbType, dbVersion: i.dbVersion,
        host: i.host, port: i.port, groupNames: ['核心业务组'],
        ownerAName: '张伟', ownerBName: idx % 2 ? '李娜' : undefined,
        status: i.status, health: i.health, healthLevel: i.healthLevel, activeAlerts: idx % 3
      }))
    return delay({
      total, normal, alert, abnormal, paused,
      avgHealth, healthLevel: avgHealth >= 90 ? 'excellent' : avgHealth >= 75 ? 'good' : avgHealth >= 60 ? 'warning' : 'critical',
      scoredCount: total - paused,
      trends: {
        total: [total - 3, total - 3, total - 2, total - 2, total - 1, total - 1, total],
        normal: [normal - 2, normal - 1, normal - 2, normal, normal - 1, normal, normal],
        alert: [alert + 1, alert, alert + 2, alert + 1, alert, alert + 1, alert],
        abnormal: Array(7).fill(abnormal),
        paused: Array(7).fill(paused)
      },
      dims: [
        { key: 'availability', label: '可用性', rate: 96 },
        { key: 'performance', label: '性能', rate: 84 },
        { key: 'stability', label: '稳定性', rate: 90 },
        { key: 'capacity', label: '容量', rate: 78 },
        { key: 'security', label: '安全配置', rate: 88 }
      ],
      dbTypes: [...byType.values()],
      topRisk
    } as unknown as T)
  }

  // ===== 用户管理 =====
  if (url === '/v1/users/page') {
    const kw = String(body.keyword ?? '').trim()
    const roleCode = body.roleCode ? String(body.roleCode) : ''
    const enabled = body.enabled
    const rows = MOCK_USERS.filter((u) => {
      if (kw && !(u.username.includes(kw) || (u.nickname || '').includes(kw) || (u.email || '').includes(kw))) return false
      if (roleCode && !(u.roles || []).includes(roleCode)) return false
      if (enabled !== undefined && enabled !== null && u.enabled !== enabled) return false
      return true
    })
    return delay(pageSlice(rows, Number(body.pageNum ?? 1), Number(body.pageSize ?? 10)) as unknown as T)
  }
  if (url === '/v1/users' && isPost(config)) {
    const u = { ...(body as unknown as SysUser), id: nextId(), createTime: nowStr(), enabled: body.enabled !== false }
    MOCK_USERS.unshift(u)
    return delay(u.id as unknown as T)
  }
  if (url === '/v1/users/update') {
    upsert(MOCK_USERS, body as unknown as SysUser)
    return delay(undefined as unknown as T)
  }
  if (url === '/v1/users/delete') {
    removeById(MOCK_USERS, Number(body.id))
    return delay(undefined as unknown as T)
  }
  if (url === '/v1/users/toggle') {
    const u = MOCK_USERS.find((x) => x.id === Number(body.id))
    if (u) u.enabled = body.enabled === true || String(body.enabled) === 'true'
    return delay(undefined as unknown as T)
  }
  if (url === '/v1/users/reset-password') {
    return delay(undefined as unknown as T)
  }
  if (url === '/v1/users/options') {
    return delay(MOCK_USERS.map((u) => ({ id: u.id, name: u.nickname || u.username })) as unknown as T)
  }

  // ===== 元数据：数据库类型 / 版本 =====
  if (url === '/v1/database-types/options') {
    return delay([
      {
        id: 1,
        code: 'MYSQL',
        label: 'MySQL',
        defaultPort: 3306,
        versions: [
          { id: 1, value: '5.6', label: 'MySQL 5.6', recommended: false, deprecated: true },
          { id: 2, value: '5.7', label: 'MySQL 5.7', recommended: true, deprecated: false },
          { id: 3, value: '8.0', label: 'MySQL 8.0', recommended: true, deprecated: false },
          { id: 4, value: '8.4', label: 'MySQL 8.4 LTS', recommended: true, deprecated: false }
        ]
      }
    ] as unknown as T)
  }

  // ===== 角色管理 =====
  if (url === '/v1/roles/page') {
    const kw = String(body.keyword ?? '').trim()
    const type = body.type ? String(body.type) : ''
    const status = body.status ? String(body.status) : ''
    const rows = MOCK_ROLES.filter((r) => {
      if (kw && !(r.name.includes(kw) || r.code.includes(kw))) return false
      if (type && r.type !== type) return false
      if (status && (r.status || 'enabled') !== status) return false
      return true
    }).map((r) => ({ ...r, userCount: roleUserCount(r.code) }))
    return delay(pageSlice(rows, Number(body.pageNum ?? 1), Number(body.pageSize ?? 10)) as unknown as T)
  }
  if (url === '/v1/roles/list') return delay(MOCK_ROLES as unknown as T)
  if (url === '/v1/roles/toggle') {
    const r = MOCK_ROLES.find((x) => x.id === Number(body.id))
    if (r) r.status = String(body.status)
    return delay(undefined as unknown as T)
  }
  if (url === '/v1/roles' && isPost(config)) {
    const b = body as unknown as SysRole
    const r: SysRole = { ...b, id: nextId(), type: b.type || 'custom', status: b.status || 'enabled', createTime: nowStr() }
    MOCK_ROLES.unshift(r)
    return delay(r.id as unknown as T)
  }
  if (url === '/v1/roles/update') {
    upsert(MOCK_ROLES, body as unknown as SysRole)
    return delay(undefined as unknown as T)
  }
  if (url === '/v1/roles/delete') {
    removeById(MOCK_ROLES, Number(body.id))
    return delay(undefined as unknown as T)
  }

  // ===== 分组管理 =====
  if (url === '/v1/groups/page') {
    const kw = String(body.keyword ?? '').trim()
    const rows = kw ? MOCK_GROUPS.filter((g) => g.name.includes(kw)) : MOCK_GROUPS
    return delay(pageSlice(rows, Number(body.pageNum ?? 1), Number(body.pageSize ?? 10)) as unknown as T)
  }
  if (url === '/v1/groups/list') return delay(MOCK_GROUPS as unknown as T)
  if (url === '/v1/groups/options') {
    return delay(MOCK_GROUPS.map((g) => ({ id: g.id, name: g.name })) as unknown as T)
  }
  if (url === '/v1/groups' && isPost(config)) {
    const g = { ...(body as unknown as InstanceGroup), id: nextId(), createTime: nowStr(), instanceCount: 0 }
    MOCK_GROUPS.unshift(g)
    return delay(g.id as unknown as T)
  }
  if (url === '/v1/groups/update') {
    upsert(MOCK_GROUPS, body as unknown as InstanceGroup)
    return delay(undefined as unknown as T)
  }
  if (url === '/v1/groups/delete') {
    removeById(MOCK_GROUPS, Number(body.id))
    return delay(undefined as unknown as T)
  }

  // ===== 菜单管理 =====
  if (url === '/v1/menus/page') {
    const kw = String(body.keyword ?? '').trim()
    const rows = kw ? MOCK_MENU_ROWS.filter((m) => m.name.includes(kw) || m.code.includes(kw)) : MOCK_MENU_ROWS
    return delay(pageSlice(rows, Number(body.pageNum ?? 1), Number(body.pageSize ?? 10)) as unknown as T)
  }
  if (url === '/v1/menus/list') return delay(MOCK_MENU_ROWS as unknown as T)
  if (url === '/v1/menus' && isPost(config)) {
    const m = { ...(body as unknown as SysMenu), id: nextId() }
    MOCK_MENU_ROWS.unshift(m)
    return delay(m.id as unknown as T)
  }
  if (url === '/v1/menus/update') {
    upsert(MOCK_MENU_ROWS, body as unknown as SysMenu)
    return delay(undefined as unknown as T)
  }
  if (url === '/v1/menus/delete') {
    removeById(MOCK_MENU_ROWS, Number(body.id))
    return delay(undefined as unknown as T)
  }
  if (url === '/v1/menus/toggle') {
    const m = MOCK_MENU_ROWS.find((x) => x.id === Number(body.id))
    if (m) m.status = String(body.status)
    return delay(undefined as unknown as T)
  }

  // ===== 知识库 =====
  if (url === '/v1/knowledge/list') return delay(MOCK_ARTICLES as unknown as T)
  if (url === '/v1/knowledge/page') {
    const kw = String(body.keyword ?? '').trim().toLowerCase()
    const cat = String(body.category ?? 'all')
    const rows = MOCK_ARTICLES.filter((a) => {
      if (cat && cat !== 'all' && a.category !== cat) return false
      if (!kw) return true
      const hay = `${a.title} ${(a.tags || []).join(' ')} ${(a.content || '').replace(/<[^>]+>/g, ' ')}`.toLowerCase()
      return hay.includes(kw)
    })
    return delay(pageSlice(rows, Number(body.pageNum ?? 1), Number(body.pageSize ?? 10)) as unknown as T)
  }
  if (url === '/v1/knowledge/like') {
    const a = MOCK_ARTICLES.find((x) => x.id === Number(body.id))
    if (a) a.likes = (a.likes ?? 0) + 1
    return delay(undefined as unknown as T)
  }
  if (url === '/v1/knowledge/delete') {
    removeById(MOCK_ARTICLES, Number(body.id))
    return delay(undefined as unknown as T)
  }
  if (url === '/v1/knowledge/get') {
    const a = MOCK_ARTICLES.find((x) => x.id === Number(body.id)) ?? null
    if (a) a.views = (a.views ?? 0) + 1
    return delay(a as unknown as T)
  }
  if (url === '/v1/knowledge/update') {
    upsert(MOCK_ARTICLES, body as unknown as KnowledgeArticle)
    return delay(undefined as unknown as T)
  }
  if (url === '/v1/knowledge' && isPost(config)) {
    const now = new Date().toISOString().slice(0, 19).replace('T', ' ')
    const a = { ...(body as unknown as KnowledgeArticle), id: nextId(), views: 0, likes: 0, createTime: now, updateTime: now }
    MOCK_ARTICLES.unshift(a)
    return delay(a.id as unknown as T)
  }

  // ===== 数据保留 =====
  if (url === '/v1/retention/list') {
    return delay({ factory: RETENTION_FACTORY, configs: MOCK_RETENTION } as unknown as T)
  }
  if (url === '/v1/retention/save') {
    const arr = (Array.isArray(config.data) ? config.data : JSON.parse(String(config.data || '[]'))) as {
      category: string
      retentionDays: number
    }[]
    arr.forEach((c) => {
      const row = MOCK_RETENTION.find((r) => r.category === c.category)
      if (row) row.retentionDays = c.retentionDays
    })
    return delay(undefined as unknown as T)
  }

  // ===== 数据字典 =====
  if (url === '/v1/dicts/types/list') {
    return delay(MOCK_DICT_TYPES as unknown as T)
  }
  if (url === '/v1/dicts/types' && isPost(config)) {
    const t = { ...(body as unknown as SysDictType), id: nextId(), type: ((body as unknown as SysDictType).type) || 'custom', createTime: nowStr() }
    MOCK_DICT_TYPES.push(t)
    return delay(t.id as unknown as T)
  }
  if (url === '/v1/dicts/types/update') {
    const prev = MOCK_DICT_TYPES.find((x) => x.id === Number(body.id))
    upsert(MOCK_DICT_TYPES, body as unknown as SysDictType)
    // 类型编码变更时同步字典项
    if (prev && prev.dictType !== String(body.dictType)) {
      MOCK_DICT_ITEMS.forEach((it) => {
        if (it.dictType === prev.dictType) it.dictType = String(body.dictType)
      })
    }
    return delay(undefined as unknown as T)
  }
  if (url === '/v1/dicts/types/delete') {
    const t = MOCK_DICT_TYPES.find((x) => x.id === Number(body.id))
    if (t) {
      for (let i = MOCK_DICT_ITEMS.length - 1; i >= 0; i--) {
        if (MOCK_DICT_ITEMS[i].dictType === t.dictType) MOCK_DICT_ITEMS.splice(i, 1)
      }
    }
    removeById(MOCK_DICT_TYPES, Number(body.id))
    return delay(undefined as unknown as T)
  }
  if (url === '/v1/dicts/items/list') {
    const rows = MOCK_DICT_ITEMS.filter((i) => i.dictType === String(body.dictType)).sort(
      (a, b) => (a.sort ?? 0) - (b.sort ?? 0)
    )
    return delay(rows as unknown as T)
  }
  if (url === '/v1/dicts/items' && isPost(config)) {
    const it = { ...(body as unknown as SysDictItem), id: nextId(), createTime: nowStr() }
    MOCK_DICT_ITEMS.push(it)
    return delay(it.id as unknown as T)
  }
  if (url === '/v1/dicts/items/update') {
    upsert(MOCK_DICT_ITEMS, body as unknown as SysDictItem)
    return delay(undefined as unknown as T)
  }
  if (url === '/v1/dicts/items/delete') {
    removeById(MOCK_DICT_ITEMS, Number(body.id))
    return delay(undefined as unknown as T)
  }

  // ===== 操作日志 =====
  if (url === '/v1/oper-logs/page') {
    let rows = MOCK_OPER_LOGS
    if (body.module) rows = rows.filter((r) => r.module === body.module)
    if (body.action) rows = rows.filter((r) => r.action === body.action)
    if (body.username) rows = rows.filter((r) => r.username === body.username)
    return delay(pageSlice(rows, Number(body.pageNum ?? 1), Number(body.pageSize ?? 20)) as unknown as T)
  }
  if (url === '/v1/oper-logs/export') {
    return delay(MOCK_OPER_LOGS as unknown as T)
  }

  return delay(null as unknown as T)
}

function isPost(config: AxiosRequestConfig): boolean {
  return (config.method || 'get').toLowerCase() === 'post'
}

function nowStr(): string {
  return new Date().toISOString().slice(0, 19).replace('T', ' ')
}

function upsert<T extends { id?: number }>(arr: T[], item: T): void {
  const idx = arr.findIndex((x) => x.id === item.id)
  if (idx >= 0) arr[idx] = { ...arr[idx], ...item }
}

function removeById<T extends { id?: number }>(arr: T[], id: number): void {
  const idx = arr.findIndex((x) => x.id === id)
  if (idx >= 0) arr.splice(idx, 1)
}
