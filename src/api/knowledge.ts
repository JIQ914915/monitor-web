import request from './request'
import type { KnowledgeArticle, PageParam, PageResult } from '@/types'

export interface KnowledgeQuery extends PageParam {
  keyword?: string
  category?: string
}

export function pageArticles(data: KnowledgeQuery) {
  return request<PageResult<KnowledgeArticle>>({ url: '/v1/knowledge/page', method: 'post', data })
}

export function listArticles() {
  return request<KnowledgeArticle[]>({ url: '/v1/knowledge/list', method: 'post', data: {} })
}

export function getArticle(id: number) {
  return request<KnowledgeArticle>({ url: '/v1/knowledge/get', method: 'post', data: { id } })
}

export function createArticle(data: KnowledgeArticle) {
  return request<number>({ url: '/v1/knowledge', method: 'post', data })
}

export function updateArticle(data: KnowledgeArticle) {
  return request<void>({ url: '/v1/knowledge/update', method: 'post', data })
}

export function deleteArticle(id: number) {
  return request<void>({ url: '/v1/knowledge/delete', method: 'post', data: { id } })
}

export function likeArticle(id: number) {
  return request<void>({ url: '/v1/knowledge/like', method: 'post', data: { id } })
}
