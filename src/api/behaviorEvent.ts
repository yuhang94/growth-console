import request from './request'
import type { Result, BehaviorEventDTO } from '@/types/api'

const BASE = '/api/v1/profile/behavior-events'

export function queryBehaviorEvents(params: {
  userId?: string
  eventName?: string
  startTime?: string
  endTime?: string
  pageNum?: number
  pageSize?: number
}) {
  return request
    .get<Result<BehaviorEventDTO[]>>(BASE, { params })
    .then((r) => r.data.data)
}

export function getUserRecentEvents(userId: string, limit?: number) {
  return request
    .get<Result<BehaviorEventDTO[]>>(`${BASE}/user/${userId}`, {
      params: { limit },
    })
    .then((r) => r.data.data)
}
