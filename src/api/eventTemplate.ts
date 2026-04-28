import request from './request'
import type {
  Result,
  EventTemplateDTO,
  EventTemplateCreateRequest,
  EventTemplateUpdateRequest,
} from '@/types/api'

const BASE = '/api/v1/profile/event-templates'

export function getEventTemplates(eventType: string) {
  return request
    .get<Result<EventTemplateDTO[]>>(BASE, { params: { eventType } })
    .then((r) => r.data.data)
}

export function createEventTemplate(data: EventTemplateCreateRequest) {
  return request.post<Result<EventTemplateDTO>>(BASE, data).then((r) => r.data.data)
}

export function updateEventTemplate(id: number, data: EventTemplateUpdateRequest) {
  return request.put<Result<EventTemplateDTO>>(`${BASE}/${id}`, data).then((r) => r.data.data)
}

export function deleteEventTemplate(id: number) {
  return request.delete<Result<void>>(`${BASE}/${id}`)
}