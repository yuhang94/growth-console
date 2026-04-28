import request from './request'
import type {
  Result,
  PageResult,
  SegmentDTO,
  SegmentCreateRequest,
  SegmentUpdateRequest,
  SegmentPreviewRequest,
  SegmentPreviewResult,
} from '@/types/api'

const BASE = '/api/v1/profile/segments'

export function createSegment(data: SegmentCreateRequest) {
  return request.post<Result<SegmentDTO>>(BASE, data).then((r) => r.data.data)
}

export function updateSegment(id: number, data: SegmentUpdateRequest) {
  return request.put<Result<SegmentDTO>>(`${BASE}/${id}`, data).then((r) => r.data.data)
}

export function getSegment(id: number) {
  return request.get<Result<SegmentDTO>>(`${BASE}/${id}`).then((r) => r.data.data)
}

export function pageSegments(params: { pageNum?: number; pageSize?: number }) {
  return request
    .get<Result<PageResult<SegmentDTO>>>(BASE, { params })
    .then((r) => r.data.data)
}

export function deleteSegment(id: number) {
  return request.delete<Result<void>>(`${BASE}/${id}`)
}

export function previewSegment(data: SegmentPreviewRequest) {
  return request
    .post<Result<SegmentPreviewResult>>(`${BASE}/preview`, data)
    .then((r) => r.data.data)
}

export function computeSegment(id: number) {
  return request.post<Result<SegmentDTO>>(`${BASE}/${id}/compute`).then((r) => r.data.data)
}

export function getSegmentUsers(id: number, params: { pageNum?: number; pageSize?: number }) {
  return request
    .get<Result<PageResult<string>>>(`${BASE}/${id}/users`, { params })
    .then((r) => r.data.data)
}
