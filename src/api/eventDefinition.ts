import request from './request'
import type {
  Result,
  PageResult,
  EventDefinitionDTO,
  EventDefinitionCreateRequest,
  EventDefinitionUpdateRequest,
  MqMappingTestRequest,
  MqMappingTestResult,
} from '@/types/api'

const BASE = '/api/v1/profile/event-definitions'

export function createEventDefinition(data: EventDefinitionCreateRequest) {
  return request.post<Result<EventDefinitionDTO>>(BASE, data).then((r) => r.data.data)
}

export function updateEventDefinition(eventName: string, data: EventDefinitionUpdateRequest) {
  return request.put<Result<EventDefinitionDTO>>(`${BASE}/${eventName}`, data).then((r) => r.data.data)
}

export function getEventDefinition(eventName: string) {
  return request.get<Result<EventDefinitionDTO>>(`${BASE}/${eventName}`).then((r) => r.data.data)
}

export function pageEventDefinitions(params: {
  eventType?: string
  usageChannel?: string
  pageNum?: number
  pageSize?: number
}) {
  return request
    .get<Result<PageResult<EventDefinitionDTO>>>(BASE, { params })
    .then((r) => r.data.data)
}

export function updateEventDefinitionStatus(eventName: string, status: number) {
  return request.put<Result<void>>(`${BASE}/${eventName}/status`, { status })
}

export function testMqMapping(data: MqMappingTestRequest) {
  return request.post<Result<MqMappingTestResult>>(`${BASE}/mq-mapping/test`, data).then((r) => r.data.data)
}

export function getMqConsumerStatus() {
  return request.get<Result<Record<string, any>>>(`${BASE}/mq-consumers/status`).then((r) => r.data.data)
}
