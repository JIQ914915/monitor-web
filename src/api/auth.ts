import request from './request'
import type { UserInfo } from '@/types'

export function login(username: string, password: string) {
  return request<{ token: string }>({
    url: '/v1/auth/login',
    method: 'post',
    data: { username, password }
  })
}

export function getUserInfo() {
  return request<UserInfo>({ url: '/v1/auth/info', method: 'get' })
}
