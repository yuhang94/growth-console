<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, Refresh, Search, View } from '@element-plus/icons-vue'
import {
  createCampaign,
  getCampaign,
  getCampaignExecution,
  listCampaigns,
  updateCampaignStatus,
} from '@/api/campaign'
import { pageEventDefinitions } from '@/api/eventDefinition'
import { pageSegments } from '@/api/segment'
import { pageTagDefinitions } from '@/api/tagDefinition'
import {
  ActionExecutionMode,
  ActionExecutionModeLabels,
  ActionExecutionStatusLabels,
  AttributeSource,
  CampaignActionType,
  CampaignActionTypeLabels,
  CampaignCompareOperator,
  CampaignStatus,
  CampaignStatusLabels,
  ExecutionStatusLabels,
  FrequencyFailStrategy,
  FrequencyFailStrategyLabels,
  TriggerType,
  TriggerTypeLabels,
  type ActionExecutionMode as ActionExecutionModeType,
  type ActionExecutionStatus,
  type CampaignActionDTO,
  type CampaignActionType as CampaignActionTypeType,
  type CampaignCreateRequest,
  type CampaignDTO,
  type CampaignExecutionDTO,
  type CampaignStatus as CampaignStatusType,
  type ExecutionStatus,
  type EventDefinitionDTO,
  type PropertyDefinitionDTO,
  type RuleConditionDTO,
  type SegmentDTO,
  type TagDefinitionDTO,
  type TriggerType as TriggerTypeType,
} from '@/types/api'
import RuleConditionBuilder from '@/components/RuleConditionBuilder.vue'

interface CampaignActionFormItem {
  stepNo: number
  actionType: CampaignActionType
  actionProvider: string
  executionMode: ActionExecutionModeType | ''
  timeoutSec: number | null
  maxRetryCount: number | null
  actionConfigText: string
}

const loading = ref(false)
const campaigns = ref<CampaignDTO[]>([])
const eventOptions = ref<EventDefinitionDTO[]>([])
const segmentOptions = ref<SegmentDTO[]>([])
const tagOptions = ref<TagDefinitionDTO[]>([])

const selectedEventProperties = computed<PropertyDefinitionDTO[]>(() => {
  if (!form.triggerRule?.eventName) return []
  const eventDefinition = eventOptions.value.find((e) => e.eventName === form.triggerRule.eventName)
  if (!eventDefinition) return []
  if (eventDefinition.properties?.length) return eventDefinition.properties

  return (eventDefinition.mqSourceConfig?.fieldMappings ?? [])
    .filter((item) => item.targetField)
    .map((item) => ({
      propertyName: item.targetField,
      propertyType: item.sourceType || 'STRING',
      displayName: item.targetField,
      required: false,
    }))
})

const queryParams = reactive({
  keyword: '',
  status: '' as CampaignStatusType | '',
  triggerType: '' as TriggerType | '',
  pageNum: 1,
  pageSize: 10,
})

const filteredCampaigns = computed(() => {
  const keyword = queryParams.keyword.trim().toLowerCase()
  return campaigns.value.filter((item) => {
    const matchKeyword = !keyword || [
      item.campaignCode,
      item.campaignName,
      item.description || '',
      item.triggerRule?.eventName || '',
    ].some((field) => field.toLowerCase().includes(keyword))
    const matchStatus = !queryParams.status || item.status === queryParams.status
    const matchTriggerType = !queryParams.triggerType || item.triggerType === queryParams.triggerType
    return matchKeyword && matchStatus && matchTriggerType
  })
})

const total = computed(() => filteredCampaigns.value.length)
const pagedCampaigns = computed(() => {
  const start = (queryParams.pageNum - 1) * queryParams.pageSize
  return filteredCampaigns.value.slice(start, start + queryParams.pageSize)
})

function createLeaf(): RuleConditionDTO {
  return { source: AttributeSource.EVENT, attributeKey: '', operator: CampaignCompareOperator.EQ, value: '' }
}

function createEmptyAction(stepNo = 1): CampaignActionFormItem {
  return {
    stepNo,
    actionType: CampaignActionType.SEND_MESSAGE,
    actionProvider: '',
    executionMode: '',
    timeoutSec: null,
    maxRetryCount: null,
    actionConfigText: '{\n  \n}',
  }
}

const dialogVisible = ref(false)
const submitting = ref(false)
const form = reactive({
  campaignCode: '',
  campaignName: '',
  description: '',
  triggerType: TriggerType.EVENT,
  priority: 100,
  defaultExecutionMode: '' as ActionExecutionModeType | '',
  timeRange: [] as string[],
  triggerRule: {
    eventName: '',
    segmentId: null as number | null,
    rootCondition: null as RuleConditionDTO | null,
    frequencyEnabled: false,
    dedupWindowSec: 86400 as number | null,
    frequencyWindowSec: null as number | null,
    frequencyLimit: null as number | null,
    frequencyFailStrategy: FrequencyFailStrategy.CLOSE as FrequencyFailStrategy | '',
  },
  actions: [createEmptyAction()],
})

const detailVisible = ref(false)
const detailLoading = ref(false)
const detailData = ref<CampaignDTO | null>(null)

const executionVisible = ref(false)
const executionLoading = ref(false)
const executionData = ref<CampaignExecutionDTO | null>(null)
const executionQueryId = ref('')

async function fetchData() {
  loading.value = true
  try {
    const result = await listCampaigns()
    campaigns.value = [...result].sort((a, b) => {
      const left = new Date(b.updatedTime || b.createdTime || 0).getTime()
      const right = new Date(a.updatedTime || a.createdTime || 0).getTime()
      return left - right
    })
  } finally {
    loading.value = false
  }
}

async function loadOptions() {
  const [events, segments, tags] = await Promise.all([
    pageEventDefinitions({ usageChannel: 'CAMPAIGN', pageNum: 1, pageSize: 1000 }),
    pageSegments({ pageNum: 1, pageSize: 1000 }),
    pageTagDefinitions({ pageNum: 1, pageSize: 1000 }),
  ])
  eventOptions.value = events.list
  segmentOptions.value = segments.list
  tagOptions.value = tags.list
}

function handleSearch() {
  queryParams.pageNum = 1
}

function handleReset() {
  queryParams.keyword = ''
  queryParams.status = ''
  queryParams.triggerType = ''
  queryParams.pageNum = 1
}

function handlePageChange(page: number) {
  queryParams.pageNum = page
}

function handleSizeChange(size: number) {
  queryParams.pageSize = size
  queryParams.pageNum = 1
}

function openCreateDialog() {
  form.campaignCode = ''
  form.campaignName = ''
  form.description = ''
  form.triggerType = TriggerType.EVENT
  form.priority = 100
  form.defaultExecutionMode = ''
  form.timeRange = []
  form.triggerRule.eventName = ''
  form.triggerRule.segmentId = null
  form.triggerRule.frequencyEnabled = false
  form.triggerRule.dedupWindowSec = 86400
  form.triggerRule.frequencyWindowSec = null
  form.triggerRule.frequencyLimit = null
  form.triggerRule.frequencyFailStrategy = FrequencyFailStrategy.CLOSE
  form.triggerRule.rootCondition = null
  form.actions = [createEmptyAction()]
  dialogVisible.value = true
}

function addAction() {
  form.actions.push(createEmptyAction(form.actions.length + 1))
}

function removeAction(index: number) {
  form.actions.splice(index, 1)
  form.actions.forEach((item, idx) => {
    item.stepNo = idx + 1
  })
}

function normalizeNumber(value: number | null | undefined) {
  return value == null || Number.isNaN(value) ? undefined : value
}

function parseActionConfig(text: string, index: number) {
  try {
    const parsed = JSON.parse(text)
    if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') {
      ElMessage.warning(`动作 ${index + 1} 的动作配置必须是 JSON 对象`)
      return null
    }
    return parsed as Record<string, any>
  } catch {
    ElMessage.warning(`动作 ${index + 1} 的动作配置不是合法 JSON`)
    return null
  }
}

function buildCreatePayload(): CampaignCreateRequest | null {
  if (!form.campaignCode.trim()) {
    ElMessage.warning('请输入活动编码')
    return null
  }
  if (!form.campaignName.trim()) {
    ElMessage.warning('请输入活动名称')
    return null
  }
  if (!form.triggerRule.eventName.trim()) {
    ElMessage.warning('请输入触发事件名称')
    return null
  }
  if (!form.triggerRule.segmentId) {
    ElMessage.warning('请选择目标人群')
    return null
  }
  if (form.actions.length === 0) {
    ElMessage.warning('请至少配置一个动作')
    return null
  }
  if (form.triggerRule.frequencyEnabled) {
    if (!form.triggerRule.frequencyWindowSec) {
      ElMessage.warning('请填写频控窗口秒数')
      return null
    }
    if (!form.triggerRule.frequencyLimit) {
      ElMessage.warning('请填写频控次数上限')
      return null
    }
  }

  const actions: CampaignActionDTO[] = []
  for (let index = 0; index < form.actions.length; index += 1) {
    const item = form.actions[index]
    if (!item.actionProvider.trim()) {
      ElMessage.warning(`请填写动作 ${index + 1} 的执行方`)
      return null
    }
    const actionConfig = parseActionConfig(item.actionConfigText, index)
    if (!actionConfig) return null
    actions.push({
      stepNo: item.stepNo,
      actionType: item.actionType,
      actionProvider: item.actionProvider.trim(),
      executionMode: item.executionMode || undefined,
      timeoutSec: normalizeNumber(item.timeoutSec) ?? null,
      maxRetryCount: normalizeNumber(item.maxRetryCount) ?? null,
      actionConfig,
    })
  }

  const [startTime, endTime] = form.timeRange
  return {
    campaignCode: form.campaignCode.trim(),
    campaignName: form.campaignName.trim(),
    description: form.description.trim() || undefined,
    triggerType: form.triggerType,
    priority: normalizeNumber(form.priority) ?? null,
    defaultExecutionMode: form.defaultExecutionMode || undefined,
    startTime: startTime || undefined,
    endTime: endTime || undefined,
    triggerRule: {
      eventName: form.triggerRule.eventName.trim(),
      segmentId: form.triggerRule.segmentId,
      rootCondition: form.triggerRule.rootCondition || undefined,
      frequencyEnabled: form.triggerRule.frequencyEnabled,
      dedupWindowSec: normalizeNumber(form.triggerRule.dedupWindowSec) ?? null,
      frequencyWindowSec: form.triggerRule.frequencyEnabled
        ? normalizeNumber(form.triggerRule.frequencyWindowSec) ?? null
        : null,
      frequencyLimit: form.triggerRule.frequencyEnabled
        ? normalizeNumber(form.triggerRule.frequencyLimit) ?? null
        : null,
      frequencyFailStrategy: form.triggerRule.frequencyEnabled
        ? form.triggerRule.frequencyFailStrategy || undefined
        : undefined,
    },
    actions: [...actions].sort((a, b) => a.stepNo - b.stepNo),
  }
}

async function handleSubmit() {
  const payload = buildCreatePayload()
  if (!payload) return

  submitting.value = true
  try {
    await createCampaign(payload)
    ElMessage.success('活动创建成功')
    dialogVisible.value = false
    await fetchData()
  } finally {
    submitting.value = false
  }
}

async function handleOpenDetail(id: number) {
  detailVisible.value = true
  detailLoading.value = true
  detailData.value = null
  try {
    detailData.value = await getCampaign(id)
  } finally {
    detailLoading.value = false
  }
}

async function handleChangeStatus(row: CampaignDTO, status: CampaignStatusType) {
  const actionText = CampaignStatusLabels[status]
  try {
    await ElMessageBox.confirm(`确定将活动「${row.campaignName}」设置为${actionText}吗？`, '提示', {
      type: 'warning',
    })
    await updateCampaignStatus(row.id, status)
    ElMessage.success('状态更新成功')
    if (detailData.value?.id === row.id) {
      detailData.value = await getCampaign(row.id)
    }
    await fetchData()
  } catch (error) {
    if (error !== 'cancel') {
      // ignored: request.ts already reports API errors
    }
  }
}

async function handleQueryExecution() {
  const id = Number(executionQueryId.value)
  if (!id || Number.isNaN(id)) {
    ElMessage.warning('请输入合法的执行记录 ID')
    return
  }
  executionVisible.value = true
  executionLoading.value = true
  executionData.value = null
  try {
    executionData.value = await getCampaignExecution(id)
  } finally {
    executionLoading.value = false
  }
}

function getStatusTagType(status: CampaignStatusType) {
  if (status === CampaignStatus.ONLINE) return 'success'
  if (status === CampaignStatus.OFFLINE) return 'warning'
  return 'info'
}

function getTriggerTypeLabel(type?: TriggerTypeType | null) {
  if (!type) return '-'
  return TriggerTypeLabels[type]
}

function getCampaignStatusLabel(status?: CampaignStatusType | null) {
  if (!status) return '-'
  return CampaignStatusLabels[status]
}

function getCampaignActionTypeLabel(type?: CampaignActionTypeType | null) {
  if (!type) return '-'
  return CampaignActionTypeLabels[type]
}

function getActionModeLabel(mode?: ActionExecutionModeType | null) {
  if (!mode) return '默认'
  return ActionExecutionModeLabels[mode]
}

function getExecutionStatusLabel(status?: ExecutionStatus | null) {
  if (!status) return '-'
  return ExecutionStatusLabels[status]
}

function getActionExecutionStatusLabel(status?: ActionExecutionStatus | null) {
  if (!status) return '-'
  return ActionExecutionStatusLabels[status]
}

function getExecutionStatusTagType(status?: string | null) {
  if (!status) return 'info'
  if (status === 'SUCCESS') return 'success'
  if (status === 'PARTIAL_FAIL' || status === 'RETRYING') return 'warning'
  if (status === 'FAIL' || status === 'TIMEOUT' || status === 'DEAD_LETTER') return 'danger'
  return 'info'
}

function formatDateTime(value?: string | null) {
  if (!value) return '未设置'
  return value.replace('T', ' ')
}

function formatJson(value: Record<string, any> | undefined) {
  return JSON.stringify(value || {}, null, 2)
}

function getSegmentName(segmentId?: number | null) {
  if (!segmentId) return '未匹配'
  return segmentOptions.value.find((item) => item.id === segmentId)?.segmentName || `ID: ${segmentId}`
}

onMounted(async () => {
  await Promise.all([loadOptions(), fetchData()])
})
</script>

<template>
  <div class="page-card">
    <el-alert
      title="当前活动管理页严格基于 CampaignController 能力实现：列表、新建、详情、状态变更，以及按执行记录 ID 查询执行明细。"
      type="info"
      :closable="false"
      class="page-alert"
    />

    <div class="table-toolbar">
      <div class="table-toolbar__left">
        <el-input
          v-model="queryParams.keyword"
          placeholder="搜索活动编码 / 名称 / 描述 / 事件名"
          :prefix-icon="Search"
          clearable
          style="width: 280px"
          @keyup.enter="handleSearch"
        />
        <el-select
          v-model="queryParams.status"
          clearable
          placeholder="状态"
          style="width: 140px"
          @change="handleSearch"
        >
          <el-option
            v-for="item in Object.values(CampaignStatus)"
            :key="item"
            :label="CampaignStatusLabels[item]"
            :value="item"
          />
        </el-select>
        <el-select
          v-model="queryParams.triggerType"
          clearable
          placeholder="触发方式"
          style="width: 140px"
          @change="handleSearch"
        >
          <el-option
            v-for="item in Object.values(TriggerType)"
            :key="item"
            :label="TriggerTypeLabels[item]"
            :value="item"
          />
        </el-select>
        <el-button :icon="Refresh" @click="handleReset">重置</el-button>
      </div>

      <div class="table-toolbar__right">
        <el-input
          v-model="executionQueryId"
          placeholder="输入执行记录 ID"
          clearable
          style="width: 180px"
          @keyup.enter="handleQueryExecution"
        />
        <el-button :icon="Search" @click="handleQueryExecution">查执行</el-button>
        <el-button type="primary" :icon="Plus" @click="openCreateDialog">新建活动</el-button>
      </div>
    </div>

    <el-table v-loading="loading" :data="pagedCampaigns" stripe highlight-current-row style="width: 100%">
      <el-table-column prop="campaignName" label="活动名称" min-width="180" show-overflow-tooltip />
      <el-table-column prop="campaignCode" label="活动编码" width="180" show-overflow-tooltip />
      <el-table-column label="触发方式" width="110" align="center">
        <template #default="{ row }">
          <el-tag size="small">{{ getTriggerTypeLabel(row.triggerType) }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="触发事件" min-width="140" show-overflow-tooltip>
        <template #default="{ row }">{{ row.triggerRule?.eventName || '未配置' }}</template>
      </el-table-column>
      <el-table-column label="目标人群" min-width="160" show-overflow-tooltip>
        <template #default="{ row }">{{ getSegmentName(row.triggerRule?.segmentId) }}</template>
      </el-table-column>
      <el-table-column label="动作数" width="80" align="center">
        <template #default="{ row }">{{ row.actions?.length || 0 }}</template>
      </el-table-column>
      <el-table-column label="状态" width="100" align="center">
        <template #default="{ row }">
          <el-tag :type="getStatusTagType(row.status)" size="small">
            {{ getCampaignStatusLabel(row.status) }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="优先级" width="90" align="center">
        <template #default="{ row }">{{ row.priority ?? '-' }}</template>
      </el-table-column>
      <el-table-column label="生效时间" min-width="240">
        <template #default="{ row }">
          <div class="time-range-cell">
            <span>{{ formatDateTime(row.startTime) }}</span>
            <span class="time-separator">~</span>
            <span>{{ formatDateTime(row.endTime) }}</span>
          </div>
        </template>
      </el-table-column>
      <el-table-column label="更新时间" width="180">
        <template #default="{ row }">{{ formatDateTime(row.updatedTime || row.createdTime) }}</template>
      </el-table-column>
      <el-table-column label="操作" width="260" fixed="right">
        <template #default="{ row }">
          <el-button link type="primary" :icon="View" @click="handleOpenDetail(row.id)">详情</el-button>
          <el-button
            v-if="row.status !== CampaignStatus.ONLINE"
            link
            type="success"
            @click="handleChangeStatus(row, CampaignStatus.ONLINE)"
          >
            上线
          </el-button>
          <el-button
            v-if="row.status === CampaignStatus.ONLINE"
            link
            type="warning"
            @click="handleChangeStatus(row, CampaignStatus.OFFLINE)"
          >
            下线
          </el-button>
          <el-button
            v-if="row.status !== CampaignStatus.DRAFT"
            link
            @click="handleChangeStatus(row, CampaignStatus.DRAFT)"
          >
            草稿
          </el-button>
        </template>
      </el-table-column>
    </el-table>

    <div class="pagination-wrapper">
      <el-pagination
        background
        layout="total, sizes, prev, pager, next"
        :current-page="queryParams.pageNum"
        :page-size="queryParams.pageSize"
        :page-sizes="[10, 20, 50]"
        :total="total"
        @current-change="handlePageChange"
        @size-change="handleSizeChange"
      />
    </div>

    <el-dialog v-model="dialogVisible" title="新建营销活动" width="980px" destroy-on-close>
      <div class="dialog-section">
        <div class="section-title">基础信息</div>
        <el-form label-width="110px">
          <el-row :gutter="16">
            <el-col :span="12">
              <el-form-item label="活动编码" required>
                <el-input v-model="form.campaignCode" maxlength="64" placeholder="如 pay_success_coupon_001" />
              </el-form-item>
            </el-col>
            <el-col :span="12">
              <el-form-item label="活动名称" required>
                <el-input v-model="form.campaignName" maxlength="128" placeholder="如 支付成功发券" />
              </el-form-item>
            </el-col>
          </el-row>
          <el-row :gutter="16">
            <el-col :span="8">
              <el-form-item label="触发方式" required>
                <el-select v-model="form.triggerType" style="width: 100%">
                  <el-option
                    v-for="item in Object.values(TriggerType)"
                    :key="item"
                    :label="TriggerTypeLabels[item]"
                    :value="item"
                  />
                </el-select>
              </el-form-item>
            </el-col>
            <el-col :span="8">
              <el-form-item label="优先级">
                <el-input-number v-model="form.priority" :min="0" :max="9999" style="width: 100%" />
              </el-form-item>
            </el-col>
            <el-col :span="8">
              <el-form-item label="默认执行模式">
                <el-select v-model="form.defaultExecutionMode" clearable style="width: 100%">
                  <el-option
                    v-for="item in Object.values(ActionExecutionMode)"
                    :key="item"
                    :label="ActionExecutionModeLabels[item]"
                    :value="item"
                  />
                </el-select>
              </el-form-item>
            </el-col>
          </el-row>
          <el-form-item label="生效时间">
            <el-date-picker
              v-model="form.timeRange"
              type="datetimerange"
              start-placeholder="开始时间"
              end-placeholder="结束时间"
              value-format="YYYY-MM-DDTHH:mm:ss"
              format="YYYY-MM-DD HH:mm:ss"
              style="width: 100%"
            />
          </el-form-item>
          <el-form-item label="活动描述">
            <el-input v-model="form.description" type="textarea" :rows="3" maxlength="500" />
          </el-form-item>
        </el-form>
      </div>

      <div class="dialog-section">
        <div class="section-title">触发规则</div>
        <el-form label-width="110px">
          <el-row :gutter="16">
            <el-col :span="12">
              <el-form-item label="触发事件" required>
                <el-select
                  v-model="form.triggerRule.eventName"
                  filterable
                  allow-create
                  clearable
                  default-first-option
                  style="width: 100%"
                  placeholder="选择或输入事件名"
                >
                  <el-option
                    v-for="item in eventOptions"
                    :key="item.eventName"
                    :label="`${item.displayName} (${item.eventName})`"
                    :value="item.eventName"
                  />
                </el-select>
              </el-form-item>
            </el-col>
            <el-col :span="12">
              <el-form-item label="目标人群" required>
                <el-select
                  v-model="form.triggerRule.segmentId"
                  filterable
                  clearable
                  style="width: 100%"
                  placeholder="选择人群分层"
                >
                  <el-option
                    v-for="item in segmentOptions"
                    :key="item.id"
                    :label="`${item.segmentName} (#${item.id})`"
                    :value="item.id"
                  />
                </el-select>
              </el-form-item>
            </el-col>
          </el-row>

          <el-form-item label="匹配条件">
            <div style="width: 100%">
              <template v-if="form.triggerRule.rootCondition">
                <RuleConditionBuilder
                  :condition="form.triggerRule.rootCondition"
                  :is-root="true"
                  :event-properties="selectedEventProperties"
                  :user-profile-attributes="tagOptions"
                  @remove="form.triggerRule.rootCondition = null"
                />
                <el-button link size="small" @click="form.triggerRule.rootCondition = null">
                  清空条件
                </el-button>
              </template>
              <div v-else style="display: flex; gap: 8px">
                <el-button link type="primary" size="small" @click="form.triggerRule.rootCondition = createLeaf()">
                  + 添加条件
                </el-button>
                <el-button link size="small" @click="form.triggerRule.rootCondition = { relation: 'AND', children: [createLeaf()] }">
                  + 添加条件组
                </el-button>
              </div>
            </div>
          </el-form-item>

          <el-row :gutter="16">
            <el-col :span="8">
              <el-form-item label="去重窗口(秒)">
                <el-input-number
                  v-model="form.triggerRule.dedupWindowSec"
                  :min="0"
                  controls-position="right"
                  style="width: 100%"
                />
              </el-form-item>
            </el-col>
            <el-col :span="16">
              <el-form-item label="频控开关">
                <el-switch v-model="form.triggerRule.frequencyEnabled" />
              </el-form-item>
            </el-col>
          </el-row>

          <template v-if="form.triggerRule.frequencyEnabled">
            <el-row :gutter="16">
              <el-col :span="8">
                <el-form-item label="频控窗口(秒)" required>
                  <el-input-number
                    v-model="form.triggerRule.frequencyWindowSec"
                    :min="0"
                    controls-position="right"
                    style="width: 100%"
                  />
                </el-form-item>
              </el-col>
              <el-col :span="8">
                <el-form-item label="频控上限" required>
                  <el-input-number
                    v-model="form.triggerRule.frequencyLimit"
                    :min="1"
                    controls-position="right"
                    style="width: 100%"
                  />
                </el-form-item>
              </el-col>
              <el-col :span="8">
                <el-form-item label="频控失败策略">
                  <el-select v-model="form.triggerRule.frequencyFailStrategy" style="width: 100%">
                    <el-option
                      v-for="item in Object.values(FrequencyFailStrategy)"
                      :key="item"
                      :label="FrequencyFailStrategyLabels[item]"
                      :value="item"
                    />
                  </el-select>
                </el-form-item>
              </el-col>
            </el-row>
          </template>
        </el-form>
      </div>

      <div class="dialog-section">
        <div class="section-title section-title--between">
          <span>动作编排</span>
          <el-button type="primary" link @click="addAction">+ 添加动作</el-button>
        </div>

        <div v-for="(action, index) in form.actions" :key="index" class="action-card">
          <div class="action-card__header">
            <span>动作 {{ index + 1 }}</span>
            <el-button
              v-if="form.actions.length > 1"
              type="danger"
              link
              @click="removeAction(index)"
            >
              删除
            </el-button>
          </div>

          <el-row :gutter="16">
            <el-col :span="6">
              <el-form-item label="步骤号">
                <el-input-number v-model="action.stepNo" :min="1" style="width: 100%" />
              </el-form-item>
            </el-col>
            <el-col :span="6">
              <el-form-item label="动作类型">
                <el-select v-model="action.actionType" style="width: 100%">
                  <el-option
                    v-for="item in Object.values(CampaignActionType)"
                    :key="item"
                    :label="CampaignActionTypeLabels[item]"
                    :value="item"
                  />
                </el-select>
              </el-form-item>
            </el-col>
            <el-col :span="6">
              <el-form-item label="执行模式">
                <el-select v-model="action.executionMode" clearable style="width: 100%">
                  <el-option
                    v-for="item in Object.values(ActionExecutionMode)"
                    :key="item"
                    :label="ActionExecutionModeLabels[item]"
                    :value="item"
                  />
                </el-select>
              </el-form-item>
            </el-col>
            <el-col :span="6">
              <el-form-item label="执行方" required>
                <el-input v-model="action.actionProvider" placeholder="如 growth-coupon" />
              </el-form-item>
            </el-col>
          </el-row>

          <el-row :gutter="16">
            <el-col :span="12">
              <el-form-item label="超时秒数">
                <el-input-number v-model="action.timeoutSec" :min="0" style="width: 100%" />
              </el-form-item>
            </el-col>
            <el-col :span="12">
              <el-form-item label="最大重试数">
                <el-input-number v-model="action.maxRetryCount" :min="0" style="width: 100%" />
              </el-form-item>
            </el-col>
          </el-row>

          <el-form-item label="动作配置(JSON)">
            <el-input
              v-model="action.actionConfigText"
              type="textarea"
              :rows="6"
              placeholder='例如 { "couponTemplateId": 20001 }'
            />
          </el-form-item>
        </div>
      </div>

      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="handleSubmit">创建活动</el-button>
      </template>
    </el-dialog>

    <el-drawer v-model="detailVisible" title="活动详情" size="760px">
      <div v-loading="detailLoading">
        <template v-if="detailData">
          <el-descriptions :column="2" border>
            <el-descriptions-item label="活动名称">{{ detailData.campaignName }}</el-descriptions-item>
            <el-descriptions-item label="活动编码">{{ detailData.campaignCode }}</el-descriptions-item>
            <el-descriptions-item label="状态">
              <el-tag :type="getStatusTagType(detailData.status)" size="small">
                {{ getCampaignStatusLabel(detailData.status) }}
              </el-tag>
            </el-descriptions-item>
            <el-descriptions-item label="触发方式">
              {{ getTriggerTypeLabel(detailData.triggerType) }}
            </el-descriptions-item>
            <el-descriptions-item label="默认执行模式">
              {{ detailData.defaultExecutionMode ? getActionModeLabel(detailData.defaultExecutionMode) : '未设置' }}
            </el-descriptions-item>
            <el-descriptions-item label="优先级">{{ detailData.priority ?? '-' }}</el-descriptions-item>
            <el-descriptions-item label="开始时间">{{ formatDateTime(detailData.startTime) }}</el-descriptions-item>
            <el-descriptions-item label="结束时间">{{ formatDateTime(detailData.endTime) }}</el-descriptions-item>
            <el-descriptions-item label="活动描述" :span="2">
              {{ detailData.description || '暂无描述' }}
            </el-descriptions-item>
          </el-descriptions>

          <div class="detail-block">
            <div class="section-title">触发规则</div>
            <el-descriptions :column="2" border>
              <el-descriptions-item label="触发事件">{{ detailData.triggerRule.eventName }}</el-descriptions-item>
              <el-descriptions-item label="目标人群">
                {{ getSegmentName(detailData.triggerRule.segmentId) }}
              </el-descriptions-item>
              <el-descriptions-item label="去重窗口">
                {{ detailData.triggerRule.dedupWindowSec ?? 0 }} 秒
              </el-descriptions-item>
              <el-descriptions-item label="频控开关">
                {{ detailData.triggerRule.frequencyEnabled ? '开启' : '关闭' }}
              </el-descriptions-item>
              <el-descriptions-item label="频控窗口">
                {{ detailData.triggerRule.frequencyWindowSec ?? '-' }}
              </el-descriptions-item>
              <el-descriptions-item label="频控上限">
                {{ detailData.triggerRule.frequencyLimit ?? '-' }}
              </el-descriptions-item>
              <el-descriptions-item label="失败策略" :span="2">
                {{
                  detailData.triggerRule.frequencyFailStrategy
                    ? FrequencyFailStrategyLabels[detailData.triggerRule.frequencyFailStrategy]
                    : '-'
                }}
              </el-descriptions-item>
            </el-descriptions>
          </div>

          <div class="detail-block">
            <div class="section-title">动作列表</div>
            <el-table :data="detailData.actions" border>
              <el-table-column prop="stepNo" label="步骤号" width="80" />
              <el-table-column label="动作类型" width="120">
                <template #default="{ row }">{{ getCampaignActionTypeLabel(row.actionType) }}</template>
              </el-table-column>
              <el-table-column prop="actionProvider" label="执行方" min-width="140" />
              <el-table-column label="执行模式" width="100">
                <template #default="{ row }">
                  {{ getActionModeLabel(row.executionMode) }}
                </template>
              </el-table-column>
              <el-table-column prop="timeoutSec" label="超时(秒)" width="100" />
              <el-table-column prop="maxRetryCount" label="重试数" width="90" />
              <el-table-column label="动作配置" min-width="240">
                <template #default="{ row }">
                  <pre class="json-block">{{ formatJson(row.actionConfig) }}</pre>
                </template>
              </el-table-column>
            </el-table>
          </div>
        </template>
      </div>
    </el-drawer>

    <el-drawer v-model="executionVisible" title="执行记录详情" size="760px">
      <div v-loading="executionLoading">
        <template v-if="executionData">
          <el-descriptions :column="2" border>
            <el-descriptions-item label="执行记录 ID">{{ executionData.id }}</el-descriptions-item>
            <el-descriptions-item label="活动 ID">{{ executionData.campaignId }}</el-descriptions-item>
            <el-descriptions-item label="状态">
              <el-tag :type="getExecutionStatusTagType(executionData.status)" size="small">
                {{ getExecutionStatusLabel(executionData.status) }}
              </el-tag>
            </el-descriptions-item>
            <el-descriptions-item label="当前步骤">{{ executionData.currentStepNo ?? '-' }}</el-descriptions-item>
            <el-descriptions-item label="用户 ID">{{ executionData.userId || '-' }}</el-descriptions-item>
            <el-descriptions-item label="人群 ID">{{ executionData.segmentId ?? '-' }}</el-descriptions-item>
            <el-descriptions-item label="Trace ID">{{ executionData.traceId || '-' }}</el-descriptions-item>
            <el-descriptions-item label="触发事件 ID">{{ executionData.triggerEventId || '-' }}</el-descriptions-item>
            <el-descriptions-item label="触发时间">{{ formatDateTime(executionData.triggerTime) }}</el-descriptions-item>
            <el-descriptions-item label="完成时间">{{ formatDateTime(executionData.finishedTime) }}</el-descriptions-item>
            <el-descriptions-item label="执行消息" :span="2">
              {{ executionData.message || '暂无消息' }}
            </el-descriptions-item>
          </el-descriptions>

          <div class="detail-block">
            <div class="section-title">动作执行明细</div>
            <el-table :data="executionData.actionExecutions || []" border>
              <el-table-column prop="id" label="ID" width="80" />
              <el-table-column label="动作类型" width="120">
                <template #default="{ row }">{{ getCampaignActionTypeLabel(row.actionType) }}</template>
              </el-table-column>
              <el-table-column prop="actionProvider" label="执行方" min-width="120" />
              <el-table-column label="执行模式" width="100">
                <template #default="{ row }">
                  {{ row.executionMode ? getActionModeLabel(row.executionMode) : '-' }}
                </template>
              </el-table-column>
              <el-table-column label="状态" width="120">
                <template #default="{ row }">
                  <el-tag :type="getExecutionStatusTagType(row.status)" size="small">
                    {{ getActionExecutionStatusLabel(row.status) }}
                  </el-tag>
                </template>
              </el-table-column>
              <el-table-column prop="dispatchId" label="分发ID" min-width="140" show-overflow-tooltip />
              <el-table-column prop="message" label="消息" min-width="200" show-overflow-tooltip />
              <el-table-column label="执行时间" width="180">
                <template #default="{ row }">{{ formatDateTime(row.executedTime) }}</template>
              </el-table-column>
            </el-table>
          </div>
        </template>
      </div>
    </el-drawer>
  </div>
</template>

<style lang="scss" scoped>
.page-alert {
  margin-bottom: 16px;
}

.dialog-section + .dialog-section {
  margin-top: 20px;
}

.section-title {
  font-size: 15px;
  font-weight: 600;
  color: #303133;
  margin-bottom: 12px;
}

.section-title--between {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.action-card {
  border: 1px solid #e4e7ed;
  border-radius: 8px;
  padding: 16px;
  background: #fafafa;

  & + & {
    margin-top: 12px;
  }

  &__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 12px;
    font-weight: 600;
  }
}

.detail-block {
  margin-top: 20px;
}

.json-block {
  margin: 0;
  white-space: pre-wrap;
  word-break: break-word;
  font-size: 12px;
  line-height: 1.5;
  color: #334155;
  background: #f8fafc;
  border-radius: 6px;
  padding: 10px 12px;
}

.time-range-cell {
  display: flex;
  align-items: center;
  gap: 6px;
}

.time-separator {
  color: #909399;
}
</style>
