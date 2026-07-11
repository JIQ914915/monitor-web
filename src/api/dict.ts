import request from './request'
import type { SysDictItem, SysDictType } from '@/types'

// ===== 字典类型 =====
export function listDictTypes() {
  return request<SysDictType[]>({ url: '/v1/dicts/types/list', method: 'get' })
}

export function createDictType(data: SysDictType) {
  return request<number>({ url: '/v1/dicts/types', method: 'post', data })
}

export function updateDictType(data: SysDictType) {
  return request<void>({ url: '/v1/dicts/types/update', method: 'post', data })
}

export function deleteDictType(id: number) {
  return request<void>({ url: '/v1/dicts/types/delete', method: 'post', data: { id } })
}

// ===== 字典项 =====
export function listDictItems(dictType: string) {
  return request<SysDictItem[]>({ url: '/v1/dicts/items/list', method: 'post', data: { dictType } })
}

export function createDictItem(data: SysDictItem) {
  return request<number>({ url: '/v1/dicts/items', method: 'post', data })
}

export function updateDictItem(data: SysDictItem) {
  return request<void>({ url: '/v1/dicts/items/update', method: 'post', data })
}

export function deleteDictItem(id: number) {
  return request<void>({ url: '/v1/dicts/items/delete', method: 'post', data: { id } })
}
