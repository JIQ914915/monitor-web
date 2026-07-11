import request from './request'
import type { GroupOption, InstanceGroup, PageParam, PageResult } from '@/types'

export interface GroupQuery extends PageParam {
  keyword?: string
}

export function pageGroups(data: GroupQuery) {
  return request<PageResult<InstanceGroup>>({ url: '/v1/groups/page', method: 'post', data })
}

export function listGroups() {
  return request<InstanceGroup[]>({ url: '/v1/groups/list', method: 'get' })
}

/** 分组选项（仅 id + name），供角色数据范围、下拉选择使用。 */
export function listGroupOptions() {
  return request<GroupOption[]>({ url: '/v1/groups/options', method: 'get' })
}

export function createGroup(data: InstanceGroup) {
  return request<number>({ url: '/v1/groups', method: 'post', data })
}

export function updateGroup(data: InstanceGroup) {
  return request<void>({ url: '/v1/groups/update', method: 'post', data })
}

export function deleteGroup(id: number) {
  return request<void>({ url: '/v1/groups/delete', method: 'post', data: { id } })
}
