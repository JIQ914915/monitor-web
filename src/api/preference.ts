import request from './request'

/** 主题偏好（与 theme store 可持久化子集对应；后端以 jsonb 原样存取） */
export type ThemePref = Record<string, unknown>

/** 获取当前用户主题偏好；首次为 null，前端回落系统默认 */
export function getThemePref() {
  return request<ThemePref | null>({ url: '/v1/preference/theme', method: 'get' })
}

/** 保存当前用户主题偏好 */
export function saveThemePref(theme: ThemePref) {
  return request<void>({ url: '/v1/preference/theme', method: 'post', data: theme })
}
