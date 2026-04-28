export interface Result<T> {
  code: number
  message: string
  data: T
}

export interface PageResult<T> {
  total: number
  pageNum: number
  pageSize: number
  list: T[]
}

export const TagType = {
  STRING: 'STRING',
  LONG: 'LONG',
  DOUBLE: 'DOUBLE',
  BOOLEAN: 'BOOLEAN',
  ENUM: 'ENUM',
  DATE: 'DATE',
} as const
export type TagType = (typeof TagType)[keyof typeof TagType]

export const TagTypeLabels: Record<TagType, string> = {
  [TagType.STRING]: '字符串',
  [TagType.LONG]: '长整型',
  [TagType.DOUBLE]: '浮点型',
  [TagType.BOOLEAN]: '布尔型',
  [TagType.ENUM]: '枚举',
  [TagType.DATE]: '日期',
}

export interface TagDefinitionDTO {
  id: number
  tagKey: string
  tagName: string
  tagType: TagType
  category: string
  description: string
  enumValues: string[] | null
  status: number
  createdBy: string
  createdTime: string
  updatedTime: string
}

export interface TagDefinitionCreateRequest {
  tagKey: string
  tagName: string
  tagType: TagType
  category?: string
  description?: string
  enumValues?: string[]
}

export interface TagDefinitionUpdateRequest {
  tagName: string
  tagType: TagType
  category?: string
  description?: string
  enumValues?: string[]
}

export interface TagValueDTO {
  userId: string
  tagKey: string
  tagValue: string
}

export interface TagValueWriteRequest {
  userId: string
  tagKey: string
  tagValue: string
}

export interface TagValueBatchWriteRequest {
  items: TagValueWriteRequest[]
}

export interface UserTagsDTO {
  userId: string
  tags: Record<string, string>
}

// ==================== Behavior Operator ====================

export const BehaviorOperator = { DID: 'DID', DID_NOT: 'DID_NOT' } as const
export type BehaviorOperator = (typeof BehaviorOperator)[keyof typeof BehaviorOperator]

export const BehaviorOperatorLabels: Record<BehaviorOperator, string> = {
  [BehaviorOperator.DID]: '做过',
  [BehaviorOperator.DID_NOT]: '没做过',
}

// ==================== Source Type ====================

export const SourceType = { SDK: 'SDK', MQ: 'MQ' } as const
export type SourceType = (typeof SourceType)[keyof typeof SourceType]

export const SourceTypeLabels: Record<SourceType, string> = {
  [SourceType.SDK]: 'SDK 上报',
  [SourceType.MQ]: 'MQ 消息',
}

// ==================== Extract Strategy ====================

export const ExtractStrategy = { JSON_PATH: 'JSON_PATH', GROOVY: 'GROOVY', LOCAL_FUNC: 'LOCAL_FUNC' } as const
export type ExtractStrategy = (typeof ExtractStrategy)[keyof typeof ExtractStrategy]

export const ExtractStrategyLabels: Record<ExtractStrategy, string> = {
  [ExtractStrategy.JSON_PATH]: 'JSONPath',
  [ExtractStrategy.GROOVY]: 'Groovy 脚本',
  [ExtractStrategy.LOCAL_FUNC]: '内置函数',
}

// ==================== Event Property Filter ====================

export interface EventPropertyFilterDTO {
  propertyKey: string
  compareOp: CompareOperator
  values: string[]
}

// ==================== MQ Source Config ====================

export interface FieldMapping {
  targetField: string
  strategy: ExtractStrategy
  expression: string
  sourceType?: string
  defaultValue?: string
}

export interface MqSourceConfigDTO {
  topic: string
  tag?: string
  consumerGroup: string
  fieldMappings: FieldMapping[]
}

export interface MqMappingTestRequest {
  sampleMessage: string
  fieldMappings: FieldMapping[]
}

export interface MqMappingTestResult {
  success: boolean
  extractedFields: Record<string, { value: any; sourceType: string }>
  errors: { targetField: string; error: string }[]
}

// ==================== Usage Channel ====================

export const UsageChannel = { PROFILE: 'PROFILE', CAMPAIGN: 'CAMPAIGN' } as const
export type UsageChannel = (typeof UsageChannel)[keyof typeof UsageChannel]

export const UsageChannelLabels: Record<UsageChannel, string> = {
  [UsageChannel.PROFILE]: '画像',
  [UsageChannel.CAMPAIGN]: '营销策略',
}

// ==================== Event Definition ====================

export const EventType = {
  PAGE_VIEW: 'PAGE_VIEW',
  CLICK: 'CLICK',
  ORDER: 'ORDER',
  LOGIN: 'LOGIN',
  SEARCH: 'SEARCH',
  SHARE: 'SHARE',
  CUSTOM: 'CUSTOM',
} as const
export type EventType = (typeof EventType)[keyof typeof EventType]

export const EventTypeLabels: Record<EventType, string> = {
  [EventType.PAGE_VIEW]: '页面浏览',
  [EventType.CLICK]: '点击',
  [EventType.ORDER]: '下单',
  [EventType.LOGIN]: '登录',
  [EventType.SEARCH]: '搜索',
  [EventType.SHARE]: '分享',
  [EventType.CUSTOM]: '自定义',
}

export interface PropertyDefinitionDTO {
  propertyName: string
  propertyType: string
  displayName: string
  required: boolean
}

export interface EventDefinitionDTO {
  id: number
  eventName: string
  eventType: EventType
  displayName: string
  description: string
  properties: PropertyDefinitionDTO[]
  sourceType?: SourceType
  mqSourceConfig?: MqSourceConfigDTO
  usageChannels?: UsageChannel[]
  status: number
  createdBy: string
  createdTime: string
  updatedTime: string
}

export interface EventDefinitionCreateRequest {
  eventName: string
  eventType: EventType
  displayName: string
  description?: string
  properties?: PropertyDefinitionDTO[]
  sourceType?: SourceType
  mqSourceConfig?: MqSourceConfigDTO
  usageChannels: UsageChannel[]
}

export interface EventDefinitionUpdateRequest {
  eventType: EventType
  displayName: string
  description?: string
  properties?: PropertyDefinitionDTO[]
  sourceType?: SourceType
  mqSourceConfig?: MqSourceConfigDTO
  usageChannels?: UsageChannel[]
}

// ==================== Segment ====================

export const CompareOperator = {
  EQ: 'EQ',
  NE: 'NE',
  GT: 'GT',
  LT: 'LT',
  GE: 'GE',
  LE: 'LE',
  IN: 'IN',
  NOT_IN: 'NOT_IN',
  BETWEEN: 'BETWEEN',
  IS_NULL: 'IS_NULL',
  IS_NOT_NULL: 'IS_NOT_NULL',
} as const
export type CompareOperator = (typeof CompareOperator)[keyof typeof CompareOperator]

export const CompareOperatorLabels: Record<CompareOperator, string> = {
  [CompareOperator.EQ]: '等于',
  [CompareOperator.NE]: '不等于',
  [CompareOperator.GT]: '大于',
  [CompareOperator.LT]: '小于',
  [CompareOperator.GE]: '大于等于',
  [CompareOperator.LE]: '小于等于',
  [CompareOperator.IN]: '包含',
  [CompareOperator.NOT_IN]: '不包含',
  [CompareOperator.BETWEEN]: '介于',
  [CompareOperator.IS_NULL]: '为空',
  [CompareOperator.IS_NOT_NULL]: '不为空',
}

export const CompareOperatorsByTagType: Record<TagType, CompareOperator[]> = {
  [TagType.BOOLEAN]: [CompareOperator.EQ, CompareOperator.NE, CompareOperator.IS_NULL, CompareOperator.IS_NOT_NULL],
  [TagType.STRING]: [CompareOperator.EQ, CompareOperator.NE, CompareOperator.IN, CompareOperator.NOT_IN, CompareOperator.IS_NULL, CompareOperator.IS_NOT_NULL],
  [TagType.LONG]: [CompareOperator.EQ, CompareOperator.NE, CompareOperator.GT, CompareOperator.LT, CompareOperator.GE, CompareOperator.LE, CompareOperator.BETWEEN, CompareOperator.IS_NULL, CompareOperator.IS_NOT_NULL],
  [TagType.DOUBLE]: [CompareOperator.EQ, CompareOperator.NE, CompareOperator.GT, CompareOperator.LT, CompareOperator.GE, CompareOperator.LE, CompareOperator.BETWEEN, CompareOperator.IS_NULL, CompareOperator.IS_NOT_NULL],
  [TagType.DATE]: [CompareOperator.EQ, CompareOperator.NE, CompareOperator.GT, CompareOperator.LT, CompareOperator.GE, CompareOperator.LE, CompareOperator.BETWEEN, CompareOperator.IS_NULL, CompareOperator.IS_NOT_NULL],
  [TagType.ENUM]: [CompareOperator.EQ, CompareOperator.NE, CompareOperator.IN, CompareOperator.NOT_IN, CompareOperator.IS_NULL, CompareOperator.IS_NOT_NULL],
}

export const ConditionOperator = {
  AND: 'AND',
  OR: 'OR',
  NOT: 'NOT',
} as const
export type ConditionOperator = (typeof ConditionOperator)[keyof typeof ConditionOperator]

export interface SegmentConditionDTO {
  operator?: ConditionOperator
  children?: SegmentConditionDTO[]
  // 标签条件
  tagKey?: string
  compareOp?: CompareOperator
  values?: string[]
  // 行为条件
  behaviorOp?: BehaviorOperator
  eventName?: string
  propertyFilters?: EventPropertyFilterDTO[]
  timeRangeStart?: string
  timeRangeEnd?: string
  countOp?: CompareOperator
  countValue?: number
}

export interface SegmentDTO {
  id: number
  segmentName: string
  description: string
  rootCondition: SegmentConditionDTO
  status: number
  lastUserCount: number
  lastComputedTime: string
  createdBy: string
  createdTime: string
  updatedTime: string
}

export interface SegmentCreateRequest {
  segmentName: string
  description?: string
  rootCondition: SegmentConditionDTO
}

export interface SegmentUpdateRequest {
  segmentName: string
  description?: string
  rootCondition: SegmentConditionDTO
}

export interface SegmentPreviewRequest {
  rootCondition: SegmentConditionDTO
}

export interface SegmentPreviewResult {
  userCount: number
}

// ==================== Event Template ====================

export interface EventTemplateDTO {
  id: number | null
  eventType: EventType
  templateName: string
  description: string
  sampleJson: string
}

export interface EventTemplateCreateRequest {
  eventType: EventType
  templateName: string
  description?: string
  sampleJson: string
}

export interface EventTemplateUpdateRequest {
  templateName?: string
  description?: string
  sampleJson: string
}

// ==================== Behavior Event ====================

export interface BehaviorEventDTO {
  eventId: string
  userId: string
  eventName: string
  eventType: string
  properties: Record<string, string>
  eventTime: string
  createdTime: string
}

export interface BehaviorEventRequest {
  userId: string
  eventName: string
  properties?: Record<string, string>
  eventTime: string
}

export interface BehaviorEventBatchRequest {
  events: BehaviorEventRequest[]
}

// ==================== Segment Template ====================

export interface ConditionSlotDTO {
  label: string
  eventTypes: string[]
  defaultDays: number
  defaultCount: number
}

export interface SegmentTemplateDTO {
  id: number
  templateKey: string
  title: string
  description: string
  slots: ConditionSlotDTO[]
  sortOrder: number
  builtIn: boolean
}

export interface SegmentTemplateCreateRequest {
  templateKey: string
  title: string
  description?: string
  slots: ConditionSlotDTO[]
}

// ==================== Campaign ====================

export const CampaignStatus = {
  DRAFT: 'DRAFT',
  ONLINE: 'ONLINE',
  OFFLINE: 'OFFLINE',
} as const
export type CampaignStatus = (typeof CampaignStatus)[keyof typeof CampaignStatus]

export const CampaignStatusLabels: Record<CampaignStatus, string> = {
  [CampaignStatus.DRAFT]: '草稿',
  [CampaignStatus.ONLINE]: '上线',
  [CampaignStatus.OFFLINE]: '下线',
}

export const TriggerType = {
  EVENT: 'EVENT',
  SCHEDULE: 'SCHEDULE',
} as const
export type TriggerType = (typeof TriggerType)[keyof typeof TriggerType]

export const TriggerTypeLabels: Record<TriggerType, string> = {
  [TriggerType.EVENT]: '事件触发',
  [TriggerType.SCHEDULE]: '定时触发',
}

export const ActionExecutionMode = {
  SYNC: 'SYNC',
  ASYNC: 'ASYNC',
} as const
export type ActionExecutionMode = (typeof ActionExecutionMode)[keyof typeof ActionExecutionMode]

export const ActionExecutionModeLabels: Record<ActionExecutionMode, string> = {
  [ActionExecutionMode.SYNC]: '同步',
  [ActionExecutionMode.ASYNC]: '异步',
}

export const CampaignActionType = {
  SEND_MESSAGE: 'SEND_MESSAGE',
  ISSUE_COUPON: 'ISSUE_COUPON',
  GRANT_INCENTIVE: 'GRANT_INCENTIVE',
} as const
export type CampaignActionType = (typeof CampaignActionType)[keyof typeof CampaignActionType]

export const CampaignActionTypeLabels: Record<CampaignActionType, string> = {
  [CampaignActionType.SEND_MESSAGE]: '发送消息',
  [CampaignActionType.ISSUE_COUPON]: '发放优惠券',
  [CampaignActionType.GRANT_INCENTIVE]: '发放激励',
}

export const FrequencyFailStrategy = {
  OPEN: 'OPEN',
  CLOSE: 'CLOSE',
} as const
export type FrequencyFailStrategy = (typeof FrequencyFailStrategy)[keyof typeof FrequencyFailStrategy]

export const FrequencyFailStrategyLabels: Record<FrequencyFailStrategy, string> = {
  [FrequencyFailStrategy.OPEN]: '放行',
  [FrequencyFailStrategy.CLOSE]: '拦截',
}

export const ExecutionStatus = {
  INIT: 'INIT',
  RUNNING: 'RUNNING',
  WAITING_ACTION: 'WAITING_ACTION',
  SUCCESS: 'SUCCESS',
  PARTIAL_FAIL: 'PARTIAL_FAIL',
  FAIL: 'FAIL',
  SKIPPED: 'SKIPPED',
  TIMEOUT: 'TIMEOUT',
} as const
export type ExecutionStatus = (typeof ExecutionStatus)[keyof typeof ExecutionStatus]

export const ExecutionStatusLabels: Record<ExecutionStatus, string> = {
  [ExecutionStatus.INIT]: '初始化',
  [ExecutionStatus.RUNNING]: '执行中',
  [ExecutionStatus.WAITING_ACTION]: '等待动作',
  [ExecutionStatus.SUCCESS]: '成功',
  [ExecutionStatus.PARTIAL_FAIL]: '部分失败',
  [ExecutionStatus.FAIL]: '失败',
  [ExecutionStatus.SKIPPED]: '跳过',
  [ExecutionStatus.TIMEOUT]: '超时',
}

export const ActionExecutionStatus = {
  INIT: 'INIT',
  PENDING_DISPATCH: 'PENDING_DISPATCH',
  DISPATCHED: 'DISPATCHED',
  RUNNING: 'RUNNING',
  SUCCESS: 'SUCCESS',
  FAIL: 'FAIL',
  RETRYING: 'RETRYING',
  DEAD_LETTER: 'DEAD_LETTER',
  SKIPPED: 'SKIPPED',
  TIMEOUT: 'TIMEOUT',
} as const
export type ActionExecutionStatus = (typeof ActionExecutionStatus)[keyof typeof ActionExecutionStatus]

export const ActionExecutionStatusLabels: Record<ActionExecutionStatus, string> = {
  [ActionExecutionStatus.INIT]: '初始化',
  [ActionExecutionStatus.PENDING_DISPATCH]: '待分发',
  [ActionExecutionStatus.DISPATCHED]: '已分发',
  [ActionExecutionStatus.RUNNING]: '执行中',
  [ActionExecutionStatus.SUCCESS]: '成功',
  [ActionExecutionStatus.FAIL]: '失败',
  [ActionExecutionStatus.RETRYING]: '重试中',
  [ActionExecutionStatus.DEAD_LETTER]: '死信',
  [ActionExecutionStatus.SKIPPED]: '跳过',
  [ActionExecutionStatus.TIMEOUT]: '超时',
}

// ==================== Campaign Rule Condition ====================

export const AttributeSource = {
  EVENT: 'EVENT',
  USER_PROFILE: 'USER_PROFILE',
  USER_BEHAVIOR: 'USER_BEHAVIOR',
} as const
export type AttributeSource = (typeof AttributeSource)[keyof typeof AttributeSource]

export const AttributeSourceLabels: Record<AttributeSource, string> = {
  [AttributeSource.EVENT]: '事件属性',
  [AttributeSource.USER_PROFILE]: '用户属性',
  [AttributeSource.USER_BEHAVIOR]: '行为属性',
}

export const CampaignCompareOperator = {
  EQ: 'EQ',
  NEQ: 'NEQ',
  GT: 'GT',
  GTE: 'GTE',
  LT: 'LT',
  LTE: 'LTE',
  CONTAINS: 'CONTAINS',
  IN: 'IN',
  NOT_IN: 'NOT_IN',
} as const
export type CampaignCompareOperator = (typeof CampaignCompareOperator)[keyof typeof CampaignCompareOperator]

export const CampaignCompareOperatorLabels: Record<CampaignCompareOperator, string> = {
  [CampaignCompareOperator.EQ]: '等于',
  [CampaignCompareOperator.NEQ]: '不等于',
  [CampaignCompareOperator.GT]: '大于',
  [CampaignCompareOperator.GTE]: '大于等于',
  [CampaignCompareOperator.LT]: '小于',
  [CampaignCompareOperator.LTE]: '小于等于',
  [CampaignCompareOperator.CONTAINS]: '包含',
  [CampaignCompareOperator.IN]: '属于',
  [CampaignCompareOperator.NOT_IN]: '不属于',
}

export const RuleConditionRelation = {
  AND: 'AND',
  OR: 'OR',
} as const
export type RuleConditionRelation = (typeof RuleConditionRelation)[keyof typeof RuleConditionRelation]

export interface RuleConditionDTO {
  // 分组节点字段
  relation?: RuleConditionRelation
  children?: RuleConditionDTO[]
  // 叶子节点字段
  source?: AttributeSource
  attributeKey?: string
  operator?: CampaignCompareOperator
  value?: string
  values?: string[]
}

export interface CampaignTriggerRuleDTO {
  eventName: string
  segmentId: number | null
  rootCondition?: RuleConditionDTO | null
  frequencyEnabled?: boolean
  dedupWindowSec?: number | null
  frequencyWindowSec?: number | null
  frequencyLimit?: number | null
  frequencyFailStrategy?: FrequencyFailStrategy | null
}

export interface CampaignActionDTO {
  stepNo: number
  actionType: CampaignActionType
  actionProvider: string
  executionMode?: ActionExecutionMode | null
  timeoutSec?: number | null
  maxRetryCount?: number | null
  actionConfig: Record<string, any>
}

export interface CampaignDTO {
  id: number
  campaignCode: string
  campaignName: string
  description?: string
  triggerType: TriggerType
  priority?: number | null
  defaultExecutionMode?: ActionExecutionMode | null
  status: CampaignStatus
  startTime?: string | null
  endTime?: string | null
  triggerRule: CampaignTriggerRuleDTO
  actions: CampaignActionDTO[]
  createdTime?: string | null
  updatedTime?: string | null
}

export interface CampaignCreateRequest {
  campaignCode: string
  campaignName: string
  description?: string
  triggerType: TriggerType
  priority?: number | null
  defaultExecutionMode?: ActionExecutionMode | null
  startTime?: string | null
  endTime?: string | null
  triggerRule: CampaignTriggerRuleDTO
  actions: CampaignActionDTO[]
}

export interface CampaignStatusUpdateRequest {
  status: CampaignStatus
}

export interface CampaignActionExecutionDTO {
  id: number
  actionType: CampaignActionType
  actionProvider: string
  executionMode?: ActionExecutionMode | null
  dispatchId?: string | null
  status: ActionExecutionStatus
  message?: string | null
  executedTime?: string | null
}

export interface CampaignExecutionDTO {
  id: number
  campaignId: number
  traceId?: string | null
  triggerEventId?: string | null
  userId?: string | null
  segmentId?: number | null
  status: ExecutionStatus
  currentStepNo?: number | null
  message?: string | null
  triggerTime?: string | null
  finishedTime?: string | null
  actionExecutions: CampaignActionExecutionDTO[]
}
