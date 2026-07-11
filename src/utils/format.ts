/**
 * 公共格式化工具：数量、时长、时间展示的统一口径。
 * 页面与组件不要再本地定义同名函数，统一从这里引入。
 */

/** 去掉多余小数位（默认保留 2 位再去尾零），如 1.20 → "1.2" */
export function trimNum(v: number, digits = 2): string {
  return Number(v.toFixed(digits)).toString()
}

/** 数量缩写：≥1 亿显示 x亿，≥1 万显示 x万 */
export function fmtCount(v?: number | null): string {
  if (v == null) return '-'
  if (Math.abs(v) >= 1e8) return `${trimNum(v / 1e8)}亿`
  if (Math.abs(v) >= 1e4) return `${trimNum(v / 1e4)}万`
  return trimNum(v)
}

/** 毫秒时长：ms / s / min / h 自动进位 */
export function fmtMs(v?: number | null): string {
  if (v == null) return '-'
  if (Math.abs(v) >= 3600_000) return `${trimNum(v / 3600_000)}h`
  if (Math.abs(v) >= 60_000) return `${trimNum(v / 60_000)}min`
  if (Math.abs(v) >= 1000) return `${trimNum(v / 1000)}s`
  return `${trimNum(v)}ms`
}

/** 秒时长（中文）：x秒 / x分x秒 / x小时x分 / x天x小时 */
export function fmtDurationCn(s?: number | null): string {
  if (!s) return '-'
  if (s < 60) return `${s}秒`
  if (s < 3600) return `${Math.floor(s / 60)}分${s % 60}秒`
  if (s < 86400) return `${Math.floor(s / 3600)}小时${Math.floor((s % 3600) / 60)}分`
  return `${Math.floor(s / 86400)}天${Math.floor((s % 86400) / 3600)}小时`
}

/** 秒时长（紧凑）：45s / 3m20s / 2h5m */
export function fmtDurationShort(s: number): string {
  if (s < 60) return `${s}s`
  if (s < 3600) return `${Math.floor(s / 60)}m${s % 60}s`
  return `${Math.floor(s / 3600)}h${Math.floor((s % 3600) / 60)}m`
}

const pad = (n: number) => String(n).padStart(2, '0')

/** 时间戳 → HH:mm（图表 X 轴常用） */
export function fmtHm(ts: number): string {
  const d = new Date(ts)
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** 时间戳 → MM-dd HH:mm */
export function fmtMdHm(ts?: number | null): string {
  if (!ts) return '-'
  const d = new Date(ts)
  return `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${fmtHm(ts)}`
}

/** 时间戳 → yyyy-MM-dd HH:mm */
export function fmtYmdHm(ts?: number | null): string {
  if (!ts) return '-'
  const d = new Date(ts)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${fmtHm(ts)}`
}

/**
 * 完整时间（智能省略年份）：同年显示 MM-dd HH:mm:ss，跨年显示 yyyy-MM-dd HH:mm:ss。
 * 兼容 ISO 字符串、"yyyy-MM-dd HH:mm:ss" 字符串与数字时间戳。
 */
export function formatDateTime(val: string | number | null | undefined): string {
  if (val == null || val === '') return '—'
  const d = new Date(val)
  if (isNaN(d.getTime())) return String(val)
  const y = d.getFullYear()
  const body = `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
  return y === new Date().getFullYear() ? body : `${y}-${body}`
}

/** 占比：part/total → "12.3%"，total 为 0 时返回 "-" */
export function pct(part: number, total: number): string {
  if (!total) return '-'
  return `${trimNum((part / total) * 100, 1)}%`
}
