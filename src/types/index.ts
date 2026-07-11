// 公共类型定义（对接需求文档 §12 核心业务对象）

/** 后端统一响应体（对应 common.result.Result<T>） */
export interface ApiResult<T = unknown> {
  code: number
  msg: string
  data: T
}

/** 分页结果（对应 common.result.PageResult<T>） */
export interface PageResult<T = unknown> {
  list: T[]
  total: number
}

export interface PageParam {
  pageNum: number
  pageSize: number
  [key: string]: unknown
}

/** 健康等级（§10.1 优秀/良好/警告/严重） */
export type HealthLevel = 'excellent' | 'good' | 'warning' | 'critical' | 'offline'

/** 数据库类型 */
export type DbType = 'MySQL' | 'Oracle' | 'PostgreSQL' | 'SQLServer'

/** 用户选项（下拉/负责人选择用轻量视图） */
export interface UserOption {
  id: number
  /** 展示名（昵称优先，无则用户名） */
  name: string
}

/** 数据库版本选项 */
export interface DbVersionOption {
  /** 版本ID（database_version.id，实例 dbVersionId 存储值） */
  id: number
  /** 版本编码（如 8.0，仅展示/参考） */
  value: string
  /** 版本展示名 */
  label: string
  recommended?: boolean
  deprecated?: boolean
}

/** 数据库类型选项（含默认端口与版本列表） */
export interface DbTypeOption {
  /** 类型ID（database_type.id，实例 dbTypeId 存储值） */
  id: number
  /** 类型编码（如 MYSQL，测试连接用） */
  code: string
  /** 展示名（如 MySQL） */
  label: string
  defaultPort?: number
  versions: DbVersionOption[]
}

/** 登录用户（多角色并集，§5.5） */
export interface UserInfo {
  id: number
  username: string
  nickname: string
  roles: string[]
  /** 按钮权限码集合 menu:action（§11.11.6） */
  permissions: string[]
}

/** 后端菜单节点（动态菜单路由，§11.11.7/8） */
export interface MenuNode {
  /** 路由 path（相对 layout） */
  path: string
  /** 路由 name */
  name?: string
  /** 组件相对 views 的路径（不含 .vue）；目录型节点可空 */
  component?: string
  /** 重定向 */
  redirect?: string
  meta: {
    title: string
    icon?: string
    /** 访问所需按钮/菜单权限码 menu:action（§11.11.6） */
    perm?: string
    /** 是否在侧边菜单隐藏（详情/编辑等非菜单页置 true） */
    hidden?: boolean
    /** 高亮归属：详情类路由指向其所属菜单 path（如 /instances），用于侧栏/顶栏/面包屑高亮 */
    activeMenu?: string
  }
  children?: MenuNode[]
}

/** 系统用户（多角色 roles，§5.5） */
export interface SysUser {
  id?: number
  username: string
  nickname?: string
  /** 邮箱 */
  email?: string
  /** 联系电话 */
  phone?: string
  /** 仅新增/改密时传；列表查询返回为空 */
  password?: string
  roles: string[]
  enabled?: boolean
  /** 最后登录时间 */
  lastLoginTime?: string
  createTime?: string
  updateTime?: string
}

/** 分组选项（下拉/数据范围选择用轻量视图） */
export interface GroupOption {
  id: number
  name: string
}

/** 数据范围类型：全部 / 指定分组 / 仅本人负责 */
export type DataScopeType = 'all' | 'group' | 'self'

/** 角色（权限码 menu:action 集合，§11.11.6） */
export interface SysRole {
  id?: number
  code: string
  name: string
  /** 角色类型：字典 role_type 值（preset 预设 / custom 自定义；预设不可删除） */
  type?: string
  /** 状态：enabled/disabled */
  status?: string
  /** 角色描述 */
  description?: string
  permissions: string[]
  /** 数据范围 */
  dataScope?: DataScopeType
  /** 数据范围为 group 时的分组ID集合 */
  dataScopeGroups?: number[]
  /** 关联用户数（后端派生） */
  userCount?: number
  createTime?: string
  updateTime?: string
}

/** 实例分组（父子层级 + 负责人/成员） */
export interface InstanceGroup {
  id?: number
  name: string
  parentId?: number | null
  /** 负责人用户ID（关联 SysUser.id） */
  ownerId?: number | null
  memberIds?: number[]
  description?: string
  instanceCount?: number
  createTime?: string
}

/** 菜单（菜单管理维护） */
/** 菜单内的按钮权限点 */
export interface MenuButton {
  /** 按钮名称，如 新增/编辑/导出 */
  name: string
  /** 权限标识，建议 菜单编码:操作，如 user:create */
  code: string
  /** 状态：enabled/disabled */
  status: string
}

export interface SysMenu {
  id?: number
  name: string
  code: string
  /** 业务分类：系统级/实例级 */
  type: string
  /** 节点类型：group 目录/分组、menu 页面 */
  menuType?: 'group' | 'menu'
  /** 上级菜单ID（空=顶级），层级由此表达 */
  parentId?: number | null
  icon?: string
  /** 前端路由 path 段（相对父节点） */
  route?: string
  /** 组件路径（相对 src/views，不含 .vue），目录为空 */
  component?: string
  /** 重定向目标 path（可空） */
  redirect?: string
  perm?: string
  sort?: number
  /** 是否在侧边菜单显示（隐藏页面置 false） */
  visible?: boolean
  /** 隐藏页面的高亮归属菜单 path */
  activeMenu?: string
  status?: string
  description?: string
  /** 按钮权限点集合（仅页面节点） */
  buttons?: MenuButton[]
  /** 子节点（树表渲染用，前端按 parentId 组装） */
  children?: SysMenu[]
  createTime?: string
}

/** 知识库文章（正文为富文本 HTML） */
export interface KnowledgeArticle {
  id?: number
  title: string
  /** 分类编码，见 KNOWLEDGE_CATEGORIES */
  category: string
  tags?: string[]
  /** 富文本正文（HTML） */
  content?: string
  author?: string
  views?: number
  likes?: number
  createTime?: string
  updateTime?: string
}

/** 数据保留策略（系统级，6 类） */
export interface RetentionConfig {
  id?: number
  category: string
  retentionDays: number
  enabled?: boolean
}

/** 操作日志 */
export interface SysOperLog {
  id: number
  operTime: string
  username: string
  module: string
  action: string
  target?: string
  ip?: string
  success: boolean
  detail?: string
}

/** 实例（多分组 groupIds + 负责人A/B，§6.1） */
export interface DbInstance {
  id: number
  name: string
  host: string
  port: number
  /** 数据库类型ID（database_type.id） */
  dbTypeId: number | null
  /** 数据库版本ID（database_version.id） */
  dbVersionId: number | null
  /** 数据库类型展示名（后端解析，只读） */
  dbType?: string
  /** 数据库版本编码（后端解析，只读） */
  dbVersion?: string
  /** 备注 */
  remark?: string
  groupIds: number[]
  /** 连接来源白名单（IP 精确或 "10.0.1.*" 前缀通配；空 = 不启用来源检测） */
  connSourceWhitelist?: string[]
  /** 负责人A用户ID（关联 SysUser.id，必填） */
  ownerAId?: number | null
  /** 负责人B用户ID（关联 SysUser.id，可选） */
  ownerBId?: number | null
  /** 采集账号 */
  connUser?: string
  /** 采集密码（编辑留空=不修改；查询返回脱敏） */
  connPassword?: string
  /** 连接目标数据库名（采集建连时替换 URL 模板中的 {database} 占位符） */
  databaseName?: string
  /** 所在主机 ID（host.id，可空） */
  hostId?: number | null
  /** 所在主机名称（后端解析，只读） */
  hostName?: string
  /** 所在主机操作系统类型（后端解析，只读）：linux / windows */
  hostOsType?: string
  health: number
  healthLevel?: HealthLevel
  /** 采集状态（字典 instance_status）：normal 正常 / abnormal 异常 / paused 暂停采样 */
  status: InstanceStatus
}

/** 实例采集状态（字典 instance_status） */
export type InstanceStatus = 'normal' | 'abnormal' | 'paused'

/** 数据库类型（管理视图，完整字段） */
export interface DatabaseTypeMgmt {
  id?: number
  code: string
  label: string
  driverClass?: string
  urlTemplate?: string
  collectorClass?: string
  defaultPort?: number
  dbIcon?: string
  sortOrder?: number
  description?: string
  enabled?: boolean
  createdAt?: string
  updatedAt?: string
}

/** 数据库版本（管理视图） */
export interface DatabaseVersionMgmt {
  id?: number
  /** 数据库类型，如 mysql */
  dbType: string
  /** 版本编码，如 8.0 */
  versionCode: string
  versionName?: string
  sortOrder?: number
  description?: string
  createdAt?: string
  updatedAt?: string
}

/** 数据字典类型 */
export interface SysDictType {
  id?: number
  /** 字典类型编码，如 instance_status */
  dictType: string
  /** 字典类型名称，如 实例状态 */
  dictName: string
  /** 字典范围：system 系统级 / custom 自定义 */
  type?: string
  status?: string
  remark?: string
  createTime?: string
  updateTime?: string
}

/** 采集任务摘要（每个实例 × 频率组合一条，/collect-logs/tasks 接口返回） */
export interface CollectTaskSummary {
  instanceId: number
  instanceName: string
  dbType: string
  dbVersion?: string
  host: string
  port: number
  /** 频率编码：1m / 1h / 1d */
  frequency: string
  /** 频率展示名 */
  frequencyLabel: string
  /** 任务状态：running 正常运行 / stopped 已暂停 / error 最近失败 */
  status: 'running' | 'stopped' | 'error'
  lastCollectTime?: string
  lastDurationMs?: number
  lastMetricCount?: number
  lastSuccess?: boolean
  lastErrorMessage?: string
  /** 近 24h 成功率（0~100） */
  successRate: number
  total24h: number
  success24h: number
}

/** 采集历史日志记录（/collect-logs 接口返回，对应 collect_log 表） */
export interface CollectLogRecord {
  id: number
  instanceId: number
  frequency: string
  collectTime: string
  durationMs: number
  metricCount: number
  textCount: number
  objectCount: number
  success: boolean
  errorMessage?: string
}

/** 数据字典项（值/标签/标签颜色/排序） */
export interface SysDictItem {
  id?: number
  dictType: string
  /** 字典值，如 normal */
  itemValue: string
  /** 展示标签，如 正常 */
  itemLabel: string
  /** 标签颜色：success/warning/danger/info/primary */
  tagType?: string
  sort?: number
  status?: string
  remark?: string
  createTime?: string
  updateTime?: string
}
