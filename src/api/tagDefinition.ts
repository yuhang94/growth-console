import request from './request'
import type {
  Result,
  PageResult,
  TagDefinitionDTO,
  TagDefinitionCreateRequest,
  TagDefinitionUpdateRequest,
} from '@/types/api'

const BASE = '/api/v1/profile/tag-definitions'

export function createTagDefinition(data: TagDefinitionCreateRequest) {
  return request.post<Result<TagDefinitionDTO>>(BASE, data).then((r) => r.data.data)
}

export function updateTagDefinition(tagKey: string, data: TagDefinitionUpdateRequest) {
  return request.put<Result<TagDefinitionDTO>>(`${BASE}/${tagKey}`, data).then((r) => r.data.data)
}

export function getTagDefinition(tagKey: string) {
  return request.get<Result<TagDefinitionDTO>>(`${BASE}/${tagKey}`).then((r) => r.data.data)
}

export function pageTagDefinitions(params: {
  category?: string
  pageNum?: number
  pageSize?: number
}) {
  return request
    .get<Result<PageResult<TagDefinitionDTO>>>(BASE, { params })
    .then((r) => r.data.data)
}

export function updateTagDefinitionStatus(tagKey: string, status: number) {
  return request.put<Result<void>>(`${BASE}/${tagKey}/status`, { status })
}
