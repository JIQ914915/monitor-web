import axios, {
  type AxiosInstance,
  type AxiosRequestConfig,
  type AxiosResponse,
  type InternalAxiosRequestConfig
} from 'axios'
import { ElMessage } from 'element-plus'
import type { ApiResult } from '@/types'
import { mockAdapter } from './mock'

const USE_MOCK = import.meta.env.VITE_USE_MOCK === 'true'

const service: AxiosInstance = axios.create({
  // 网关前缀；版本号写在各接口 url（如 /v1/metrics/...），便于部分接口升到 /v2
  baseURL: import.meta.env.VITE_API_BASE || '/api',
  timeout: 15000
})

// 请求拦截：注入 JWT（Authorization: Bearer <token>）
service.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = readToken()
    if (token) config.headers.set('Authorization', `Bearer ${token}`)
    return config
  },
  (error) => Promise.reject(error)
)

// 响应拦截：解包统一返回体 + 业务码/401 统一处理
service.interceptors.response.use(
  (response) => {
    const res = response.data as ApiResult
    if (res.code === 0 || res.code === 200) {
      // 解包统一返回体，最终 resolve 出业务 data
      return res.data as unknown as AxiosResponse
    }
    // 业务响应体中 code=401：token 过期（经 @RequiresPerm 切面检测到）→ 跳登录
    if (res.code === 401) {
      redirectToLogin(res.msg || '登录已过期，请重新登录')
      return Promise.reject(new Error(res.msg))
    }
    ElMessage.error(res.msg || '请求失败')
    return Promise.reject(new Error(res.msg || 'Error'))
  },
  (error) => {
    const status = error?.response?.status
    if (status === 401) {
      // HTTP 401：token 过期或无 token（JwtAuthFilter / AuthenticationEntryPoint 返回）
      const msg = error?.response?.data?.msg || '登录已过期，请重新登录'
      redirectToLogin(msg)
    } else {
      ElMessage.error(error?.message || '网络异常')
    }
    return Promise.reject(error)
  }
)

/** 清除本地登录态并跳转登录页（防止重复触发）。 */
let redirecting = false
function redirectToLogin(msg: string) {
  if (redirecting) return
  redirecting = true
  ElMessage.error(msg)
  localStorage.removeItem('user')
  setTimeout(() => {
    window.location.href = '/login'
    redirecting = false
  }, 1000)
}

function readToken(): string {
  try {
    const raw = localStorage.getItem('user')
    return raw ? (JSON.parse(raw).token as string) || '' : ''
  } catch {
    return ''
  }
}

/** 统一请求入口：开发态走 mock，联调态走真实 axios（写操作走 POST，§13.3.3） */
export function request<T = unknown>(config: AxiosRequestConfig): Promise<T> {
  if (USE_MOCK) return mockAdapter<T>(config)
  return service.request<unknown, T>(config)
}

export default request
