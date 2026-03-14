import request from './request'
import type {
  Result,
  TagValueDTO,
  TagValueWriteRequest,
  TagValueBatchWriteRequest,
  UserTagsDTO,
} from '@/types/api'

const BASE = '/api/v1/profile/tag-values'

export function writeTagValue(data: TagValueWriteRequest) {
  return request.post<Result<void>>(BASE, data)
}

export function batchWriteTagValues(data: TagValueBatchWriteRequest) {
  return request.post<Result<void>>(`${BASE}/batch`, data)
}

export function getTagValue(userId: string, tagKey: string) {
  return request
    .get<Result<TagValueDTO>>(BASE, { params: { userId, tagKey } })
    .then((r) => r.data.data)
}

export function getUserTags(userId: string) {
  return request
    .get<Result<UserTagsDTO>>(`${BASE}/user/${userId}`)
    .then((r) => r.data.data)
}

export function deleteTagValue(userId: string, tagKey: string) {
  return request.delete<Result<void>>(BASE, { params: { userId, tagKey } })
}
