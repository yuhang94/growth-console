import request from './request'
import type {
  Result,
  CampaignDTO,
  CampaignCreateRequest,
  CampaignExecutionDTO,
  CampaignStatus,
} from '@/types/api'

const BASE = '/api/v1/campaigns'

export function createCampaign(data: CampaignCreateRequest) {
  return request.post<Result<CampaignDTO>>(BASE, data).then((r) => r.data.data)
}

export function getCampaign(id: number) {
  return request.get<Result<CampaignDTO>>(`${BASE}/${id}`).then((r) => r.data.data)
}

export function listCampaigns() {
  return request.get<Result<CampaignDTO[]>>(BASE).then((r) => r.data.data)
}

export function updateCampaignStatus(id: number, status: CampaignStatus) {
  return request.put<Result<CampaignDTO>>(`${BASE}/${id}/status`, { status }).then((r) => r.data.data)
}

export function getCampaignExecution(id: number) {
  return request.get<Result<CampaignExecutionDTO>>(`${BASE}/executions/${id}`).then((r) => r.data.data)
}
