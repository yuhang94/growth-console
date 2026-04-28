import request from './request'
import type { Result, SegmentTemplateDTO, SegmentTemplateCreateRequest } from '@/types/api'

const BASE = '/api/v1/profile/segment-templates'

export function listSegmentTemplates(): Promise<SegmentTemplateDTO[]> {
  return request.get<Result<SegmentTemplateDTO[]>>(BASE).then((r) => r.data.data)
}

export function createSegmentTemplate(data: SegmentTemplateCreateRequest): Promise<SegmentTemplateDTO> {
  return request.post<Result<SegmentTemplateDTO>>(BASE, data).then((r) => r.data.data)
}

export function deleteSegmentTemplate(id: number): Promise<void> {
  return request.delete<Result<void>>(`${BASE}/${id}`).then(() => undefined)
}