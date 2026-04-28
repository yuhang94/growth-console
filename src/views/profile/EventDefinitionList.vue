<script setup lang="ts">
import { ref, reactive, computed, watch, onMounted, nextTick } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, Search, Refresh, Delete } from '@element-plus/icons-vue'
import {
  pageEventDefinitions,
  createEventDefinition,
  updateEventDefinition,
  updateEventDefinitionStatus,
  testMqMapping,
} from '@/api/eventDefinition'
import { getEventTemplates } from '@/api/eventTemplate'
import {
  EventType,
  EventTypeLabels,
  SourceType,
  SourceTypeLabels,
  UsageChannel,
  UsageChannelLabels,
  ExtractStrategy,
  ExtractStrategyLabels,
  type EventDefinitionDTO,
  type EventDefinitionCreateRequest,
  type EventDefinitionUpdateRequest,
  type EventTemplateDTO,
  type FieldMapping,
  type PropertyDefinitionDTO,
  type MqSourceConfigDTO,
  type MqMappingTestResult,
} from '@/types/api'
import { generateJsonPathSuggestions, type JsonPathSuggestion } from '@/utils/jsonPathGenerator'

// --- Table state ---
const loading = ref(false)
const tableData = ref<EventDefinitionDTO[]>([])
const total = ref(0)
const queryParams = reactive({
  eventType: '' as string,
  usageChannel: '' as string,
  keyword: '',
  pageNum: 1,
  pageSize: 20,
})

async function fetchData() {
  loading.value = true
  try {
    const result = await pageEventDefinitions({
      eventType: queryParams.eventType || undefined,
      usageChannel: queryParams.usageChannel || undefined,
      pageNum: queryParams.pageNum,
      pageSize: queryParams.pageSize,
    })
    tableData.value = result.list
    total.value = result.total
  } finally {
    loading.value = false
  }
}

function handleSearch() {
  queryParams.pageNum = 1
  fetchData()
}

function handleReset() {
  queryParams.eventType = ''
  queryParams.usageChannel = ''
  queryParams.keyword = ''
  queryParams.pageNum = 1
  fetchData()
}

function handlePageChange(page: number) {
  queryParams.pageNum = page
  fetchData()
}

function handleSizeChange(size: number) {
  queryParams.pageSize = size
  queryParams.pageNum = 1
  fetchData()
}

const filteredData = computed(() => {
  if (!queryParams.keyword) return tableData.value
  const kw = queryParams.keyword.toLowerCase()
  return tableData.value.filter(
    (item) =>
      item.eventName.toLowerCase().includes(kw) ||
      item.displayName.toLowerCase().includes(kw),
  )
})

// --- Dialog state ---
const dialogVisible = ref(false)
const dialogTitle = ref('新建事件')
const isEditing = ref(false)
const editingEventName = ref('')
const submitting = ref(false)
const initialFormSnapshot = ref('')
const mqConfigDrawerVisible = ref(false)
const mqDrawerSize = 'min(1080px, 88vw)'

const formRef = ref()
const form = reactive<{
  eventName: string
  eventType: EventType
  displayName: string
  description: string
  properties: PropertyDefinitionDTO[]
  sourceType: SourceType
  mqSourceConfig: MqSourceConfigDTO
  usageChannels: UsageChannel[]
}>({
  eventName: '',
  eventType: EventType.CUSTOM,
  displayName: '',
  description: '',
  properties: [],
  sourceType: SourceType.SDK,
  mqSourceConfig: {
    topic: '',
    tag: '',
    consumerGroup: '',
    fieldMappings: [],
  },
  usageChannels: [],
})

const formRules = {
  eventName: [
    {
      validator: (_rule: unknown, value: string, callback: (error?: Error) => void) => {
        if (!value?.trim()) {
          callback(new Error('请输入事件名称'))
          return
        }
        callback()
      },
      trigger: 'blur',
    },
    { max: 64, message: '最长 64 字符', trigger: 'blur' },
  ],
  displayName: [
    {
      validator: (_rule: unknown, value: string, callback: (error?: Error) => void) => {
        if (!value?.trim()) {
          callback(new Error('请输入显示名称'))
          return
        }
        callback()
      },
      trigger: 'blur',
    },
    { max: 128, message: '最长 128 字符', trigger: 'blur' },
  ],
  eventType: [{ required: true, message: '请选择事件类型', trigger: 'change' }],
  usageChannels: [{ required: true, message: '请选择使用渠道', trigger: 'change', type: 'array', min: 1 }],
  'mqSourceConfig.topic': [
    {
      validator: (_rule: unknown, value: string, callback: (error?: Error) => void) => {
        if (form.sourceType === SourceType.MQ && !value?.trim()) {
          callback(new Error('请输入 Topic'))
          return
        }
        callback()
      },
      trigger: 'blur',
    },
  ],
  'mqSourceConfig.consumerGroup': [
    {
      validator: (_rule: unknown, value: string, callback: (error?: Error) => void) => {
        if (form.sourceType === SourceType.MQ && !value?.trim()) {
          callback(new Error('请输入 Consumer Group'))
          return
        }
        callback()
      },
      trigger: 'blur',
    },
  ],
}

function createEmptyMqConfig(): MqSourceConfigDTO {
  return { topic: '', tag: '', consumerGroup: '', fieldMappings: [] }
}

function createEmptyFieldMapping() {
  return {
    targetField: '',
    strategy: ExtractStrategy.JSON_PATH,
    expression: '',
    sourceType: '',
    defaultValue: '',
  }
}

function ensureFieldMappingExists() {
  if (form.sourceType === SourceType.MQ && form.mqSourceConfig.fieldMappings.length === 0) {
    form.mqSourceConfig.fieldMappings.push(createEmptyFieldMapping())
  }
}

function buildFieldMappingsFromSuggestions() {
  const usedNames = new Set<string>()
  return jsonPathSuggestions.value.map((suggestion) => {
    const targetField = buildUniqueTargetFieldName(suggestion.fieldName || 'field', usedNames)
    usedNames.add(targetField)
    return {
      targetField,
      strategy: ExtractStrategy.JSON_PATH,
      expression: suggestion.jsonPath,
      sourceType: suggestion.inferredType,
      defaultValue: '',
    }
  })
}

async function handleGenerateMappings() {
  if (!parseSampleJson(testSampleMessage.value, false) || jsonPathSuggestions.value.length === 0) {
    ElMessage.warning('请先提供可解析的样例消息')
    return
  }

  const hasExistingMappings = form.mqSourceConfig.fieldMappings.some((item) => (
    item.targetField.trim()
    || item.expression.trim()
    || item.sourceType?.trim()
    || item.defaultValue?.trim()
  ))

  if (hasExistingMappings) {
    try {
      await ElMessageBox.confirm('将使用样例消息重新生成字段映射，现有映射会被替换，是否继续？', '提示', {
        type: 'warning',
        confirmButtonText: '替换映射',
        cancelButtonText: '取消',
      })
    } catch {
      return
    }
  }

  form.mqSourceConfig.fieldMappings = buildFieldMappingsFromSuggestions()
  syncMappingAdvancedStates()
  nextTick(() => formRef.value?.clearValidate())
  ElMessage.success(`已生成 ${form.mqSourceConfig.fieldMappings.length} 条字段映射`)
}

function openMqConfigDrawer() {
  ensureFieldMappingExists()
  syncMappingAdvancedStates()
  activeMqDrawerSection.value = getDefaultDrawerSection()
  sampleInspectorTab.value = configuredMappings.value.length > 0 ? 'selected' : 'suggestions'
  mqConfigDrawerVisible.value = true
}

function closeMqConfigDrawer() {
  mqConfigDrawerVisible.value = false
}

function serializeDialogState() {
  return JSON.stringify({
    eventName: form.eventName,
    eventType: form.eventType,
    displayName: form.displayName,
    description: form.description,
    properties: form.properties,
    sourceType: form.sourceType,
    mqSourceConfig: form.mqSourceConfig,
    usageChannels: form.usageChannels,
    testSampleMessage: testSampleMessage.value,
    selectedTemplateName: selectedTemplateName.value,
  })
}

function markInitialDialogState() {
  initialFormSnapshot.value = serializeDialogState()
}

const hasUnsavedChanges = computed(() => (
  dialogVisible.value && serializeDialogState() !== initialFormSnapshot.value
))

async function requestCloseDialog(done?: () => void) {
  if (submitting.value) return

  if (!hasUnsavedChanges.value) {
    if (done) done()
    else dialogVisible.value = false
    return
  }

  try {
    await ElMessageBox.confirm('当前修改尚未保存，确定关闭吗？', '提示', {
      type: 'warning',
      confirmButtonText: '放弃修改',
      cancelButtonText: '继续编辑',
    })
    if (done) done()
    else dialogVisible.value = false
  } catch {
    // keep editing
  }
}

function afterDialogOpen() {
  nextTick(() => {
    formRef.value?.clearValidate()
    markInitialDialogState()
  })
}

function openCreateDialog() {
  isEditing.value = false
  dialogTitle.value = '新建事件'
  editingEventName.value = ''
  Object.assign(form, {
    eventName: '',
    eventType: EventType.CUSTOM,
    displayName: '',
    description: '',
    properties: [],
    sourceType: SourceType.SDK,
    mqSourceConfig: createEmptyMqConfig(),
    usageChannels: [],
  })
  testResult.value = null
  testResultDirty.value = false
  testResultView.value = 'all'
  testSampleMessage.value = ''
  sampleJsonError.value = ''
  selectedTemplateName.value = ''
  templateList.value = []
  jsonPathSuggestions.value = []
  mappingAdvancedStates.value = []
  sampleInspectorTab.value = 'suggestions'
  activeMqDrawerSection.value = 'basic'
  mqConfigDrawerVisible.value = false
  dialogVisible.value = true
  afterDialogOpen()
}

function openEditDialog(row: EventDefinitionDTO) {
  isEditing.value = true
  dialogTitle.value = '编辑事件'
  editingEventName.value = row.eventName
  Object.assign(form, {
    eventName: row.eventName,
    eventType: row.eventType,
    displayName: row.displayName,
    description: row.description || '',
    properties: row.properties ? row.properties.map((p) => ({ ...p })) : [],
    sourceType: row.sourceType || SourceType.SDK,
    mqSourceConfig: row.mqSourceConfig
      ? JSON.parse(JSON.stringify(row.mqSourceConfig))
      : createEmptyMqConfig(),
    usageChannels: row.usageChannels ? [...row.usageChannels] : [],
  })
  testResult.value = null
  testResultDirty.value = false
  testResultView.value = 'all'
  testSampleMessage.value = ''
  sampleJsonError.value = ''
  selectedTemplateName.value = ''
  templateList.value = []
  jsonPathSuggestions.value = []
  mappingAdvancedStates.value = []
  sampleInspectorTab.value = 'suggestions'
  activeMqDrawerSection.value = 'basic'
  mqConfigDrawerVisible.value = false
  dialogVisible.value = true
  afterDialogOpen()
  // Load templates for the event type
  if (row.sourceType === SourceType.MQ) {
    ensureFieldMappingExists()
    loadTemplates(row.eventType)
  }
}

// --- Event Template ---
const templateList = ref<EventTemplateDTO[]>([])
const selectedTemplateName = ref<string>('')
const templateLoading = ref(false)
const jsonPathSuggestions = ref<JsonPathSuggestion[]>([])
const sampleInspectorTab = ref<'suggestions' | 'selected'>('suggestions')
const mappingAdvancedStates = ref<boolean[]>([])
const testResultView = ref<'all' | 'failed'>('all')
const mqBasicSectionRef = ref<HTMLElement | null>(null)
const mqSampleSectionRef = ref<HTMLElement | null>(null)
const mqMappingSectionRef = ref<HTMLElement | null>(null)
const mqTestSectionRef = ref<HTMLElement | null>(null)

type MqDrawerSectionKey = 'basic' | 'sample' | 'mapping' | 'test'

const activeMqDrawerSection = ref<MqDrawerSectionKey>('basic')

interface JsonPathSuggestionGroup {
  key: string
  title: string
  suggestions: JsonPathSuggestion[]
}

async function loadTemplates(eventType: EventType) {
  templateLoading.value = true
  try {
    templateList.value = await getEventTemplates(eventType)
  } catch {
    templateList.value = []
  } finally {
    templateLoading.value = false
  }
}

function handleTemplateSelect(templateName: string) {
  if (!templateName) {
    testSampleMessage.value = ''
    sampleJsonError.value = ''
    jsonPathSuggestions.value = []
    sampleInspectorTab.value = 'suggestions'
    return
  }
  const tmpl = templateList.value.find((t) => t.templateName === templateName)
  if (!tmpl) return
  testSampleMessage.value = tmpl.sampleJson
  parseSampleJson(tmpl.sampleJson, true, true)
  activeMqDrawerSection.value = 'sample'
}

function refreshJsonPathSuggestions(json: string) {
  jsonPathSuggestions.value = generateJsonPathSuggestions(json)
}

function getSuggestionByExpression(expression: string) {
  return jsonPathSuggestions.value.find((item) => item.jsonPath === expression.trim())
}

function getMappingResolvedType(mapping: FieldMapping) {
  return mapping.sourceType?.trim() || getSuggestionByExpression(mapping.expression)?.inferredType || '未指定'
}

function getMappingPreviewValue(mapping: FieldMapping) {
  const suggestion = getSuggestionByExpression(mapping.expression)
  if (!suggestion) return '未关联样例字段'
  return formatSuggestionSampleValue(suggestion.sampleValue)
}

function getMappingChipText(mapping: FieldMapping) {
  const chips = [getMappingResolvedType(mapping)]
  if (mapping.defaultValue?.trim()) {
    chips.push(`默认值: ${mapping.defaultValue}`)
  }
  return chips.join(' · ')
}

function getMappingAdvancedSummary(mapping: FieldMapping) {
  const summary: string[] = []
  if (mapping.sourceType?.trim()) summary.push(mapping.sourceType.trim())
  if (mapping.defaultValue?.trim()) summary.push(`默认值 ${mapping.defaultValue.trim()}`)
  return summary.length > 0 ? summary.join(' / ') : '未设置'
}

function formatJsonContent(json: string) {
  return JSON.stringify(JSON.parse(json), null, 2)
}

function extractJsonErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) {
    return error.message.replace(/^Unexpected token\s+/i, 'JSON 语法错误，非法字符 ')
  }
  return '请检查逗号、引号和括号是否完整'
}

function parseSampleJson(json: string, silent = true, shouldFormat = false) {
  const trimmed = json.trim()
  if (!trimmed) {
    sampleJsonError.value = ''
    jsonPathSuggestions.value = []
    return true
  }

  try {
    const formatted = formatJsonContent(trimmed)
    if (shouldFormat && formatted !== testSampleMessage.value) {
      testSampleMessage.value = formatted
    }
    sampleJsonError.value = ''
    refreshJsonPathSuggestions(formatted)
    return true
  } catch (error) {
    sampleJsonError.value = `样例消息不是合法 JSON，${extractJsonErrorMessage(error)}`
    jsonPathSuggestions.value = []
    if (!silent) {
      ElMessage.warning(sampleJsonError.value)
    }
    return false
  }
}

function handleSampleJsonBlur() {
  parseSampleJson(testSampleMessage.value, false, true)
}

function handleParseSampleJson() {
  parseSampleJson(testSampleMessage.value, false, true)
}

function handleFormatSampleJson() {
  if (!testSampleMessage.value.trim()) {
    ElMessage.warning('请先输入样例消息')
    return
  }
  if (parseSampleJson(testSampleMessage.value, false, true)) {
    ElMessage.success('JSON 已自动格式化')
  }
}

function handleSampleJsonTab(event: KeyboardEvent) {
  const target = event.target as HTMLTextAreaElement | null
  if (!target) return
  event.preventDefault()

  const indent = '  '
  const { selectionStart, selectionEnd, value } = target
  const selectedText = value.slice(selectionStart, selectionEnd)
  const hasSelection = selectionStart !== selectionEnd

  if (event.shiftKey && hasSelection) {
    const lineStart = value.lastIndexOf('\n', selectionStart - 1) + 1
    const lineEndIndex = value.indexOf('\n', selectionEnd)
    const lineEnd = lineEndIndex === -1 ? value.length : lineEndIndex
    const block = value.slice(lineStart, lineEnd)
    const lines = block.split('\n')
    let removedPrefixCount = 0
    const updatedBlock = lines.map((line, index) => {
      if (line.startsWith(indent)) {
        removedPrefixCount += 1
        return line.slice(indent.length)
      }
      if (line.startsWith('\t')) {
        removedPrefixCount += 1
        return line.slice(1)
      }
      if (index === 0 && selectionStart > lineStart) return line
      return line
    }).join('\n')

    testSampleMessage.value = `${value.slice(0, lineStart)}${updatedBlock}${value.slice(lineEnd)}`
    nextTick(() => {
      const start = Math.max(lineStart, selectionStart - indent.length)
      const end = Math.max(start, selectionEnd - removedPrefixCount * indent.length)
      target.setSelectionRange(start, end)
    })
    return
  }

  const insertion = hasSelection ? selectedText : indent
  testSampleMessage.value = `${value.slice(0, selectionStart)}${insertion}${value.slice(selectionEnd)}`
  nextTick(() => {
    const cursor = selectionStart + insertion.length
    target.setSelectionRange(cursor, cursor)
  })
}

function applyJsonPathToMapping(index: number, suggestion: JsonPathSuggestion) {
  const fm = form.mqSourceConfig.fieldMappings[index]
  fm.expression = suggestion.jsonPath
  fm.sourceType = suggestion.inferredType
  if (!fm.targetField) {
    fm.targetField = suggestion.fieldName
  }
  fm.strategy = ExtractStrategy.JSON_PATH
}

function handleMappingExpressionSelect(index: number, value: string) {
  const suggestion = jsonPathSuggestions.value.find((item) => item.jsonPath === value)
  if (suggestion) {
    applyJsonPathToMapping(index, suggestion)
  }
}

function buildUniqueTargetFieldName(baseName: string, usedNames = new Set<string>()) {
  let targetField = baseName
  let suffix = 2
  while (usedNames.has(targetField)) {
    targetField = `${baseName}_${suffix}`
    suffix += 1
  }
  return targetField
}

function handleApplySuggestion(suggestion: JsonPathSuggestion) {
  const existingIndex = form.mqSourceConfig.fieldMappings.findIndex((item) => item.expression === suggestion.jsonPath)
  if (existingIndex >= 0) {
    applyJsonPathToMapping(existingIndex, suggestion)
    ElMessage.success(`已更新映射字段 ${form.mqSourceConfig.fieldMappings[existingIndex].targetField || suggestion.fieldName}`)
    return
  }

  const mapping = createEmptyFieldMapping()
  const usedNames = new Set(form.mqSourceConfig.fieldMappings.map((item) => item.targetField.trim()).filter(Boolean))
  mapping.targetField = buildUniqueTargetFieldName(suggestion.fieldName || 'field', usedNames)
  mapping.expression = suggestion.jsonPath
  mapping.sourceType = suggestion.inferredType
  form.mqSourceConfig.fieldMappings.push(mapping)
  syncMappingAdvancedStates()
  ElMessage.success(`已添加字段映射 ${suggestion.fieldName}`)
}

function isSuggestionMapped(suggestion: JsonPathSuggestion) {
  return form.mqSourceConfig.fieldMappings.some((item) => item.expression === suggestion.jsonPath)
}

function getSuggestionGroupKey(path: string) {
  const lastDotIndex = path.lastIndexOf('.')
  if (lastDotIndex <= 1) return '$'
  return path.slice(0, lastDotIndex)
}

function getSuggestionGroupTitle(path: string) {
  return path === '$' ? '顶层字段' : path.replace(/^\$\./, '')
}

function formatSuggestionSampleValue(value: unknown) {
  if (value === null || value === undefined) return 'null'
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

function getSuggestionTypeTag(type: string) {
  if (type === 'BOOLEAN') return 'success'
  if (type === 'LONG' || type === 'DOUBLE') return 'warning'
  return 'info'
}

const groupedJsonPathSuggestions = computed<JsonPathSuggestionGroup[]>(() => {
  const groups = new Map<string, JsonPathSuggestionGroup>()
  jsonPathSuggestions.value.forEach((suggestion) => {
    const key = getSuggestionGroupKey(suggestion.jsonPath)
    const group = groups.get(key)
    if (group) {
      group.suggestions.push(suggestion)
      return
    }
    groups.set(key, {
      key,
      title: getSuggestionGroupTitle(key),
      suggestions: [suggestion],
    })
  })
  return Array.from(groups.values())
})

const configuredMappings = computed(() => (
  form.mqSourceConfig.fieldMappings.filter((item) => (
    item.targetField.trim()
    || item.expression.trim()
    || item.sourceType?.trim()
    || item.defaultValue?.trim()
  ))
))

const completedMappingCount = computed(() => (
  form.mqSourceConfig.fieldMappings.filter((item) => item.targetField.trim() && item.expression.trim()).length
))

const mappingTestErrorTargets = computed(() => new Set((testResult.value?.errors || []).map((item) => item.targetField)))

const visibleExtractedFields = computed(() => {
  const entries = Object.entries(testResult.value?.extractedFields || {})
  const filteredEntries = testResultView.value !== 'failed'
    ? entries
    : entries.filter(([key]) => mappingTestErrorTargets.value.has(key))
  return filteredEntries.map(([key, value]) => ({ key, value }))
})

const visibleTestErrors = computed(() => testResult.value?.errors || [])

const mqStepCards = computed(() => ([
  {
    key: 'basic' as MqDrawerSectionKey,
    step: '01',
    title: '基础配置',
    desc: 'Topic、Tag、消费组',
    done: mqConfigReady.value,
    status: mqConfigReady.value ? 'done' : (activeMqDrawerSection.value === 'basic' ? 'active' : 'pending'),
    statusText: mqConfigReady.value ? '已完成' : (activeMqDrawerSection.value === 'basic' ? '进行中' : '待完成'),
  },
  {
    key: 'sample' as MqDrawerSectionKey,
    step: '02',
    title: '样例解析',
    desc: `${jsonPathSuggestions.value.length} 个字段建议`,
    done: sampleJsonReady.value && jsonPathSuggestions.value.length > 0,
    status: sampleJsonReady.value && jsonPathSuggestions.value.length > 0 ? 'done' : (activeMqDrawerSection.value === 'sample' ? 'active' : 'pending'),
    statusText: sampleJsonReady.value && jsonPathSuggestions.value.length > 0 ? '已完成' : (activeMqDrawerSection.value === 'sample' ? '进行中' : '待完成'),
  },
  {
    key: 'mapping' as MqDrawerSectionKey,
    step: '03',
    title: '字段映射',
    desc: `${completedMappingCount.value}/${form.mqSourceConfig.fieldMappings.length} 条完成`,
    done: fieldMappingsReady.value,
    status: fieldMappingsReady.value ? 'done' : (activeMqDrawerSection.value === 'mapping' ? 'active' : 'pending'),
    statusText: fieldMappingsReady.value ? '已完成' : (activeMqDrawerSection.value === 'mapping' ? '进行中' : '待完成'),
  },
  {
    key: 'test' as MqDrawerSectionKey,
    step: '04',
    title: '映射测试',
    desc: testResultDirty.value ? '结果待刷新' : (testResult.value ? (testResult.value.success ? '最近一次通过' : '最近一次失败') : '未测试'),
    done: !!testResult.value && !testResultDirty.value && testResult.value.success,
    status: !!testResult.value && !testResultDirty.value && testResult.value.success ? 'done' : (activeMqDrawerSection.value === 'test' ? 'active' : 'pending'),
    statusText: !!testResult.value && !testResultDirty.value && testResult.value.success ? '已完成' : (activeMqDrawerSection.value === 'test' ? '进行中' : '待完成'),
  },
]))

const mqOverviewCards = computed(() => ([
  {
    label: '样例字段',
    value: `${jsonPathSuggestions.value.length}`,
  },
  {
    label: '已选映射',
    value: `${completedMappingCount.value}`,
  },
  {
    label: '测试状态',
    value: testResultDirty.value ? '待重测' : (testResult.value ? (testResult.value.success ? '通过' : '失败') : '未测'),
  },
]))

function getDefaultDrawerSection(): MqDrawerSectionKey {
  if (!mqConfigReady.value) return 'basic'
  if (!sampleJsonReady.value || jsonPathSuggestions.value.length === 0) return 'sample'
  if (!fieldMappingsReady.value) return 'mapping'
  return 'test'
}

function getDrawerSectionElement(section: MqDrawerSectionKey) {
  if (section === 'basic') return mqBasicSectionRef.value
  if (section === 'sample') return mqSampleSectionRef.value
  if (section === 'mapping') return mqMappingSectionRef.value
  return mqTestSectionRef.value
}

function scrollToMqSection(section: MqDrawerSectionKey) {
  activeMqDrawerSection.value = section
  nextTick(() => {
    getDrawerSectionElement(section)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  })
}

function syncMappingAdvancedStates() {
  mappingAdvancedStates.value = form.mqSourceConfig.fieldMappings.map((item, index) => (
    mappingAdvancedStates.value[index] ?? !!(item.defaultValue?.trim())
  ))
}

function toggleMappingAdvanced(index: number) {
  mappingAdvancedStates.value[index] = !mappingAdvancedStates.value[index]
}

function handleEditMappedField() {
  sampleInspectorTab.value = 'selected'
  scrollToMqSection('mapping')
}

// Watch eventType change to reload templates when in MQ mode
watch(() => form.eventType, (newType) => {
  if (form.sourceType === SourceType.MQ) {
    selectedTemplateName.value = ''
    loadTemplates(newType)
  }
})

// Watch sourceType change
watch(() => form.sourceType, (newSource) => {
  if (newSource === SourceType.MQ) {
    ensureFieldMappingExists()
    syncMappingAdvancedStates()
    loadTemplates(form.eventType)
  } else {
    templateList.value = []
    selectedTemplateName.value = ''
    jsonPathSuggestions.value = []
    sampleInspectorTab.value = 'suggestions'
    mappingAdvancedStates.value = []
    mqConfigDrawerVisible.value = false
  }
})

// --- Properties management ---
function addProperty() {
  form.properties.push({
    propertyName: '',
    propertyType: 'STRING',
    displayName: '',
    required: false,
  })
}

function removeProperty(index: number) {
  form.properties.splice(index, 1)
  nextTick(() => formRef.value?.clearValidate())
}

const propertyTypeOptions = ['STRING', 'LONG', 'DOUBLE', 'BOOLEAN', 'DATE']

function validateUniquePropertyName(index: number) {
  return (_rule: unknown, value: string, callback: (error?: Error) => void) => {
    const current = value?.trim()
    if (!current) {
      callback(new Error('请输入属性名'))
      return
    }
    const duplicated = form.properties.some((item, itemIndex) => (
      itemIndex !== index && item.propertyName.trim() === current
    ))
    if (duplicated) {
      callback(new Error('属性名不能重复'))
      return
    }
    callback()
  }
}

// --- MQ field mappings ---
function addFieldMapping() {
  form.mqSourceConfig.fieldMappings.push(createEmptyFieldMapping())
  mappingAdvancedStates.value.push(false)
}

function removeFieldMapping(index: number) {
  form.mqSourceConfig.fieldMappings.splice(index, 1)
  mappingAdvancedStates.value.splice(index, 1)
  nextTick(() => formRef.value?.clearValidate())
}

function validateUniqueTargetField(index: number) {
  return (_rule: unknown, value: string, callback: (error?: Error) => void) => {
    const current = value?.trim()
    if (!current) {
      callback(new Error('请输入目标字段'))
      return
    }
    const duplicated = form.mqSourceConfig.fieldMappings.some((item, itemIndex) => (
      itemIndex !== index && item.targetField.trim() === current
    ))
    if (duplicated) {
      callback(new Error('目标字段不能重复'))
      return
    }
    callback()
  }
}

function validateMappingExpression(_rule: unknown, value: string, callback: (error?: Error) => void) {
  if (!value?.trim()) {
    callback(new Error('请输入提取表达式'))
    return
  }
  callback()
}

// --- MQ mapping test ---
const testSampleMessage = ref('')
const testLoading = ref(false)
const testResult = ref<MqMappingTestResult | null>(null)
const testResultDirty = ref(false)
const sampleJsonError = ref('')

const mqConfigReady = computed(() => (
  form.sourceType !== SourceType.MQ
  || (!!form.mqSourceConfig.topic.trim() && !!form.mqSourceConfig.consumerGroup.trim())
))

const sampleJsonReady = computed(() => (
  form.sourceType !== SourceType.MQ
  || (!!testSampleMessage.value.trim() && !sampleJsonError.value)
))

const fieldMappingsReady = computed(() => (
  form.sourceType !== SourceType.MQ
  || (
    form.mqSourceConfig.fieldMappings.length > 0
    && form.mqSourceConfig.fieldMappings.every((item) => item.targetField.trim() && item.expression.trim())
  )
))

const canTestMapping = computed(() => (
  form.sourceType === SourceType.MQ
  && mqConfigReady.value
  && sampleJsonReady.value
  && fieldMappingsReady.value
))

watch(testSampleMessage, (value) => {
  if (testResult.value) {
    testResultDirty.value = true
    testResultView.value = 'all'
  }
  const trimmed = value.trim()
  if (!trimmed) {
    sampleJsonError.value = ''
    jsonPathSuggestions.value = []
    return
  }

  try {
    JSON.parse(trimmed)
    sampleJsonError.value = ''
    refreshJsonPathSuggestions(trimmed)
  } catch {
    sampleJsonError.value = ''
    jsonPathSuggestions.value = []
  }
})

watch(() => form.mqSourceConfig.fieldMappings, () => {
  if (testResult.value) {
    testResultDirty.value = true
    testResultView.value = 'all'
  }
}, { deep: true })

watch(() => form.mqSourceConfig.fieldMappings.length, () => {
  syncMappingAdvancedStates()
})

async function handleTestMapping() {
  if (!testSampleMessage.value.trim()) {
    ElMessage.warning('请输入示例消息')
    return
  }
  if (!parseSampleJson(testSampleMessage.value, false)) {
    return
  }
  if (form.mqSourceConfig.fieldMappings.length === 0) {
    ElMessage.warning('请至少添加一条字段映射')
    return
  }
  const valid = await formRef.value?.validateField([
    'mqSourceConfig.topic',
    'mqSourceConfig.consumerGroup',
    ...form.mqSourceConfig.fieldMappings.flatMap((_, index) => [
      `mqSourceConfig.fieldMappings.${index}.targetField`,
      `mqSourceConfig.fieldMappings.${index}.expression`,
    ]),
  ]).then(() => true).catch(() => false)
  if (!valid) return
  testLoading.value = true
  testResult.value = null
  testResultDirty.value = false
  try {
    testResult.value = await testMqMapping({
      sampleMessage: testSampleMessage.value,
      fieldMappings: form.mqSourceConfig.fieldMappings,
    })
    testResultView.value = 'all'
  } catch (e: any) {
    ElMessage.error(e?.message || '测试失败')
  } finally {
    testLoading.value = false
  }
}

function buildMappingTestReport() {
  if (!testResult.value) return ''

  const lines = [
    `测试结果: ${testResult.value.success ? '通过' : '失败'}`,
    `提取字段数: ${Object.keys(testResult.value.extractedFields || {}).length}`,
    `错误数: ${(testResult.value.errors || []).length}`,
    '',
    '提取结果:',
  ]

  const extractedEntries = Object.entries(testResult.value.extractedFields || {})
  if (extractedEntries.length === 0) {
    lines.push('- 无')
  } else {
    extractedEntries.forEach(([key, value]) => {
      lines.push(`- ${key}: ${formatSuggestionSampleValue(value.value)} (${value.sourceType})`)
    })
  }

  lines.push('', '错误明细:')
  if (!testResult.value.errors || testResult.value.errors.length === 0) {
    lines.push('- 无')
  } else {
    testResult.value.errors.forEach((item) => {
      lines.push(`- ${item.targetField}: ${item.error}`)
    })
  }

  return lines.join('\n')
}

async function copyText(text: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text)
    return
  }

  const textarea = document.createElement('textarea')
  textarea.value = text
  textarea.style.position = 'fixed'
  textarea.style.opacity = '0'
  document.body.appendChild(textarea)
  textarea.select()
  document.execCommand('copy')
  document.body.removeChild(textarea)
}

async function handleCopyTestResult() {
  if (!testResult.value) return
  try {
    await copyText(buildMappingTestReport())
    ElMessage.success('测试结果已复制')
  } catch {
    ElMessage.error('复制失败，请手动复制')
  }
}

async function handleSubmit() {
  const valid = await formRef.value?.validate().catch(() => false)
  if (!valid) return
  if (form.sourceType === SourceType.MQ && !parseSampleJson(testSampleMessage.value)) return

  submitting.value = true
  try {
    const mqConfig = form.sourceType === SourceType.MQ ? form.mqSourceConfig : undefined
    const properties = form.sourceType === SourceType.SDK && form.properties.length > 0
      ? form.properties
      : undefined
    if (isEditing.value) {
      const data: EventDefinitionUpdateRequest = {
        eventType: form.eventType,
        displayName: form.displayName,
        description: form.description || undefined,
        properties,
        sourceType: form.sourceType,
        mqSourceConfig: mqConfig,
        usageChannels: form.usageChannels,
      }
      await updateEventDefinition(editingEventName.value, data)
      ElMessage.success('更新成功')
    } else {
      const data: EventDefinitionCreateRequest = {
        eventName: form.eventName,
        eventType: form.eventType,
        displayName: form.displayName,
        description: form.description || undefined,
        properties,
        sourceType: form.sourceType,
        mqSourceConfig: mqConfig,
        usageChannels: form.usageChannels,
      }
      await createEventDefinition(data)
      ElMessage.success('创建成功')
    }
    dialogVisible.value = false
    fetchData()
  } finally {
    submitting.value = false
  }
}

// --- Status toggle ---
async function handleToggleStatus(row: EventDefinitionDTO) {
  const newStatus = row.status === 1 ? 0 : 1
  const action = newStatus === 1 ? '启用' : '停用'
  try {
    await ElMessageBox.confirm(`确定要${action}事件「${row.displayName}」吗？`, '提示', {
      type: 'warning',
    })
    await updateEventDefinitionStatus(row.eventName, newStatus)
    ElMessage.success(`${action}成功`)
    fetchData()
  } catch {
    // cancelled
  }
}

function getStatusType(status: number) {
  return status === 1 ? 'success' : 'info'
}

function getStatusText(status: number) {
  return status === 1 ? '启用' : '停用'
}

function getSourceLabel(sourceType?: string) {
  if (sourceType === SourceType.MQ) return 'MQ'
  return 'SDK'
}

function formatSuggestionLabel(s: JsonPathSuggestion): string {
  const val = typeof s.sampleValue === 'string' ? `"${s.sampleValue}"` : String(s.sampleValue)
  return `${s.jsonPath}  (${s.inferredType}: ${val})`
}

onMounted(fetchData)
</script>

<template>
  <div class="page-card">
    <!-- Toolbar -->
    <div class="table-toolbar">
      <div class="table-toolbar__left">
        <el-input
          v-model="queryParams.keyword"
          placeholder="搜索事件名称"
          :prefix-icon="Search"
          clearable
          style="width: 240px"
          @keyup.enter="handleSearch"
        />
        <el-select
          v-model="queryParams.eventType"
          placeholder="事件类型"
          clearable
          style="width: 160px"
          @change="handleSearch"
        >
          <el-option
            v-for="t in Object.values(EventType)"
            :key="t"
            :label="EventTypeLabels[t]"
            :value="t"
          />
        </el-select>
        <el-select
          v-model="queryParams.usageChannel"
          placeholder="使用渠道"
          clearable
          style="width: 160px"
          @change="handleSearch"
        >
          <el-option
            v-for="ch in Object.values(UsageChannel)"
            :key="ch"
            :label="UsageChannelLabels[ch]"
            :value="ch"
          />
        </el-select>
        <el-button type="primary" :icon="Search" @click="handleSearch">查询</el-button>
        <el-button :icon="Refresh" @click="handleReset">重置</el-button>
      </div>
      <div class="table-toolbar__right">
        <el-button type="primary" :icon="Plus" @click="openCreateDialog">新建事件</el-button>
      </div>
    </div>

    <!-- Table -->
    <el-table
      v-loading="loading"
      :data="filteredData"
      stripe
      highlight-current-row
      style="width: 100%"
    >
      <el-table-column prop="eventName" label="事件名称" min-width="160" show-overflow-tooltip />
      <el-table-column prop="displayName" label="显示名称" min-width="140" show-overflow-tooltip />
      <el-table-column prop="eventType" label="事件类型" width="120">
        <template #default="{ row }">
          <el-tag size="small" effect="plain">{{ EventTypeLabels[row.eventType as EventType] || row.eventType }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="使用渠道" width="160">
        <template #default="{ row }">
          <template v-if="row.usageChannels && row.usageChannels.length > 0">
            <el-tag
              v-for="ch in row.usageChannels"
              :key="ch"
              size="small"
              effect="plain"
              type="primary"
              style="margin-right: 4px"
            >
              {{ UsageChannelLabels[ch as UsageChannel] || ch }}
            </el-tag>
          </template>
          <span v-else style="color: #909399; font-size: 12px">未指定</span>
        </template>
      </el-table-column>
      <el-table-column label="数据源" width="90" align="center">
        <template #default="{ row }">
          <el-tag :type="row.sourceType === 'MQ' ? 'warning' : ''" size="small" effect="plain">
            {{ getSourceLabel(row.sourceType) }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="status" label="状态" width="80" align="center">
        <template #default="{ row }">
          <el-tag :type="getStatusType(row.status)" size="small">
            {{ getStatusText(row.status) }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="createdTime" label="创建时间" width="170" />
      <el-table-column label="操作" width="160" fixed="right">
        <template #default="{ row }">
          <el-button type="primary" link size="small" @click="openEditDialog(row)">编辑</el-button>
          <el-button
            :type="row.status === 1 ? 'warning' : 'success'"
            link
            size="small"
            @click="handleToggleStatus(row)"
          >
            {{ row.status === 1 ? '停用' : '启用' }}
          </el-button>
        </template>
      </el-table-column>
    </el-table>

    <!-- Pagination -->
    <div class="pagination-wrapper">
      <el-pagination
        v-model:current-page="queryParams.pageNum"
        v-model:page-size="queryParams.pageSize"
        :total="total"
        :page-sizes="[10, 20, 50, 100]"
        layout="total, sizes, prev, pager, next, jumper"
        @current-change="handlePageChange"
        @size-change="handleSizeChange"
      />
    </div>

    <!-- Create / Edit Dialog -->
    <el-dialog
      v-model="dialogVisible"
      :title="dialogTitle"
      width="860px"
      destroy-on-close
      :before-close="requestCloseDialog"
    >
      <el-form ref="formRef" class="event-definition-form" :model="form" :rules="formRules" label-width="110px">
        <div class="form-section">
          <div class="form-section__header">
            <div>
              <div class="form-section__title">1. 基础信息</div>
              <div class="form-section__desc">先确认事件标识、展示名称和数据来源。</div>
            </div>
            <el-tag size="small" type="info" effect="plain">{{ isEditing ? '编辑模式' : '创建模式' }}</el-tag>
          </div>

          <el-form-item label="事件名称" prop="eventName">
            <el-input
              v-model="form.eventName"
              :disabled="isEditing"
              placeholder="如 page_view"
              maxlength="64"
              show-word-limit
            />
          </el-form-item>
          <el-form-item label="显示名称" prop="displayName">
            <el-input v-model="form.displayName" placeholder="如 页面浏览" maxlength="128" show-word-limit />
          </el-form-item>
          <el-form-item label="事件类型" prop="eventType">
            <el-select v-model="form.eventType" style="width: 100%">
              <el-option
                v-for="t in Object.values(EventType)"
                :key="t"
                :label="EventTypeLabels[t]"
                :value="t"
              />
            </el-select>
          </el-form-item>
          <el-form-item label="描述">
            <el-input
              v-model="form.description"
              type="textarea"
              :rows="3"
              placeholder="事件用途描述"
              maxlength="512"
              show-word-limit
            />
          </el-form-item>

          <el-form-item label="使用渠道" prop="usageChannels">
            <el-checkbox-group v-model="form.usageChannels">
              <el-checkbox
                v-for="ch in Object.values(UsageChannel)"
                :key="ch"
                :label="UsageChannelLabels[ch]"
                :value="ch"
              />
            </el-checkbox-group>
          </el-form-item>

          <el-form-item label="数据源类型">
            <el-radio-group v-model="form.sourceType">
              <el-radio v-for="st in Object.values(SourceType)" :key="st" :value="st">
                {{ SourceTypeLabels[st] }}
              </el-radio>
            </el-radio-group>
          </el-form-item>
        </div>

        <!-- MQ Source Config -->
        <template v-if="form.sourceType === SourceType.MQ">
          <div class="form-section form-section--mq">
            <div class="form-section__header">
              <div>
                <div class="form-section__title">2. MQ 数据源配置</div>
                <div class="form-section__desc">详细配置已拆到侧边抽屉，主弹窗只保留状态摘要，减少一次性信息量。</div>
              </div>
              <el-button type="primary" @click="openMqConfigDrawer">配置 MQ 解析</el-button>
            </div>

            <div class="mq-summary">
              <div class="mq-progress">
                <div class="mq-progress__item" :class="{ 'is-done': mqConfigReady }">1. 基础配置</div>
                <div class="mq-progress__item" :class="{ 'is-done': sampleJsonReady }">2. 解析样例消息</div>
                <div class="mq-progress__item" :class="{ 'is-done': fieldMappingsReady }">3. 完成字段映射</div>
              </div>

              <div class="mq-summary__grid">
                <div class="mq-summary__card">
                  <div class="mq-summary__label">Topic</div>
                  <div class="mq-summary__value">{{ form.mqSourceConfig.topic || '未配置' }}</div>
                </div>
                <div class="mq-summary__card">
                  <div class="mq-summary__label">Consumer Group</div>
                  <div class="mq-summary__value">{{ form.mqSourceConfig.consumerGroup || '未配置' }}</div>
                </div>
                <div class="mq-summary__card">
                  <div class="mq-summary__label">字段映射</div>
                  <div class="mq-summary__value">{{ form.mqSourceConfig.fieldMappings.length }} 条</div>
                </div>
                <div class="mq-summary__card">
                  <div class="mq-summary__label">测试状态</div>
                  <div class="mq-summary__value">
                    {{ testResultDirty ? '待重新测试' : testResult ? (testResult.success ? '已通过' : '存在错误') : '未测试' }}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <el-drawer
            v-model="mqConfigDrawerVisible"
            :size="mqDrawerSize"
            append-to-body
            class="mq-config-drawer"
          >
            <template #header>
              <div class="mq-drawer-hero">
                <div class="mq-drawer-hero__main">
                  <span class="mq-drawer-hero__eyebrow">Message Parser Studio</span>
                  <div class="mq-drawer-hero__title">配置 MQ 解析</div>
                  <div class="mq-drawer-hero__desc">把真实消息样例转成稳定的字段映射，尽量在一个纵向流程里完成，不依赖左右来回扫视。</div>
                </div>
                <div class="mq-drawer-hero__stats">
                  <div v-for="card in mqOverviewCards" :key="card.label" class="mq-drawer-stat">
                    <span class="mq-drawer-stat__label">{{ card.label }}</span>
                    <span class="mq-drawer-stat__value">{{ card.value }}</span>
                  </div>
                </div>
              </div>
            </template>

            <div class="mq-drawer-shell">
              <div class="mq-step-nav">
                <button
                  v-for="item in mqStepCards"
                  :key="item.key"
                  type="button"
                  class="mq-step-tab"
                  :class="[
                    { 'is-active': activeMqDrawerSection === item.key, 'is-done': item.done },
                    `is-${item.status}`,
                  ]"
                  @click="scrollToMqSection(item.key)"
                >
                  <span class="mq-step-tab__index">{{ item.step }}</span>
                  <span class="mq-step-tab__content">
                    <span class="mq-step-tab__title">{{ item.title }}</span>
                    <span class="mq-step-tab__desc">{{ item.desc }}</span>
                  </span>
                  <span class="mq-step-tab__status">{{ item.statusText }}</span>
                </button>
              </div>

              <div ref="mqBasicSectionRef" class="drawer-section drawer-section--panel">
                <div class="drawer-section__header">
                  <div>
                    <div class="drawer-section__eyebrow">Step 01</div>
                    <div class="drawer-section__title">基础配置</div>
                    <div class="drawer-section__desc">先确定来源和模板，后续样例与映射都基于这里展开。</div>
                  </div>
                  <el-tag size="small" :type="mqConfigReady ? 'success' : 'info'" effect="plain">
                    {{ mqConfigReady ? '已完成' : '待完善' }}
                  </el-tag>
                </div>

                <div class="drawer-form-grid">
                  <div class="drawer-form-grid__item drawer-form-grid__item--wide">
                    <el-form-item>
                      <template #label>
                        <span class="form-item-label form-item-label--strong">消息模板</span>
                      </template>
                      <div class="template-selector">
                        <el-select
                          v-model="selectedTemplateName"
                          placeholder="选择消息模板（可选）"
                          clearable
                          :loading="templateLoading"
                          style="width: 100%"
                          @change="handleTemplateSelect"
                        >
                          <el-option
                            v-for="tmpl in templateList"
                            :key="tmpl.templateName"
                            :label="tmpl.templateName"
                            :value="tmpl.templateName"
                          >
                            <div class="template-option">
                              <span class="template-option__name">{{ tmpl.templateName }}</span>
                              <span v-if="!tmpl.id" class="template-option__badge">内置</span>
                              <span v-if="tmpl.description" class="template-option__desc">{{ tmpl.description }}</span>
                            </div>
                          </el-option>
                        </el-select>
                      </div>
                    </el-form-item>
                  </div>

                  <div class="drawer-form-grid__item">
                    <el-form-item prop="mqSourceConfig.topic">
                      <template #label>
                        <span class="mq-key-label">Topic</span>
                      </template>
                      <el-input v-model="form.mqSourceConfig.topic" placeholder="如 order-events" />
                    </el-form-item>
                  </div>

                  <div class="drawer-form-grid__item">
                    <el-form-item>
                      <template #label>
                        <span class="mq-key-label">Tag</span>
                      </template>
                      <el-input v-model="form.mqSourceConfig.tag" placeholder="选填，消息 Tag" />
                    </el-form-item>
                  </div>

                  <div class="drawer-form-grid__item drawer-form-grid__item--wide">
                    <el-form-item prop="mqSourceConfig.consumerGroup">
                      <template #label>
                        <span class="mq-key-label">Consumer Group</span>
                      </template>
                      <el-input v-model="form.mqSourceConfig.consumerGroup" placeholder="如 GID_profile_order" />
                    </el-form-item>
                  </div>
                </div>
              </div>

              <div ref="mqSampleSectionRef" class="drawer-section drawer-section--panel">
                <div class="drawer-section__header">
                  <div>
                    <div class="drawer-section__eyebrow">Step 02</div>
                    <div class="drawer-section__title">解析样例消息</div>
                    <div class="drawer-section__desc">建议粘贴一条真实 JSON，系统会自动识别 JsonPath，并生成更可靠的映射建议。</div>
                  </div>
                  <div class="drawer-section__actions">
                    <el-button link type="primary" @click="handleFormatSampleJson">格式化 JSON</el-button>
                    <el-button link type="primary" @click="handleParseSampleJson">重新解析</el-button>
                  </div>
                </div>

                <el-form-item :error="sampleJsonError">
                  <template #label>
                    <span class="mq-key-label">样例消息</span>
                  </template>
                  <div class="sample-json-area">
                    <div class="sample-json-toolbar">
                      <div class="sample-json-toolbar__meta">
                        <span class="sample-json-toolbar__title">JSON 样例</span>
                        <span class="sample-json-toolbar__hint">支持 Tab 缩进；失焦时自动格式化，便于校验层级与字段名。</span>
                      </div>
                    </div>
                    <el-input
                      v-model="testSampleMessage"
                      type="textarea"
                      :rows="10"
                      resize="vertical"
                      placeholder="粘贴一条示例 MQ 消息 JSON，用于自动生成 JsonPath 建议和测试映射"
                      input-style="font-family: SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace; line-height: 1.6; font-size: 13px;"
                      class="sample-json-area__editor"
                      @blur="handleSampleJsonBlur"
                      @keydown.tab.prevent="handleSampleJsonTab"
                    />
                    <div class="sample-json-area__actions">
                      <span v-if="!sampleJsonError && testSampleMessage.trim()" class="sample-json-area__status">
                        已完成解析，可继续选择字段并生成映射
                      </span>
                      <span v-else class="sample-json-area__status">
                        建议先准备一条真实消息，再开始配置字段映射
                      </span>
                    </div>

                    <div class="sample-inspector">
                      <div class="sample-inspector__tabs">
                        <button
                          type="button"
                          class="sample-inspector__tab"
                          :class="{ 'is-active': sampleInspectorTab === 'suggestions' }"
                          @click="sampleInspectorTab = 'suggestions'"
                        >
                          字段建议
                          <span>{{ jsonPathSuggestions.length }}</span>
                        </button>
                        <button
                          type="button"
                          class="sample-inspector__tab"
                          :class="{ 'is-active': sampleInspectorTab === 'selected' }"
                          @click="sampleInspectorTab = 'selected'"
                        >
                          已选映射
                          <span>{{ configuredMappings.length }}</span>
                        </button>
                      </div>

                      <div v-if="sampleInspectorTab === 'suggestions'" class="sample-inspector__panel">
                        <div v-if="jsonPathSuggestions.length > 0" class="jsonpath-hints">
                          <el-tag size="small" type="info" effect="plain">
                            已识别 {{ jsonPathSuggestions.length }} 个字段
                          </el-tag>
                          <span class="jsonpath-hints__desc">建议区更偏向“挑字段”，不是完整编辑区。选中后再到下方微调。</span>
                        </div>
                        <div v-if="groupedJsonPathSuggestions.length > 0" class="suggestion-groups">
                          <div
                            v-for="group in groupedJsonPathSuggestions"
                            :key="group.key"
                            class="suggestion-group"
                          >
                            <div class="suggestion-group__header">
                              <span class="suggestion-group__title">{{ group.title }}</span>
                              <span class="suggestion-group__count">{{ group.suggestions.length }} 个字段</span>
                            </div>
                            <div class="suggestion-group__list">
                              <div
                                v-for="suggestion in group.suggestions"
                                :key="suggestion.jsonPath"
                                class="suggestion-card"
                              >
                                <div class="suggestion-card__top">
                                  <div class="suggestion-card__main">
                                    <div class="suggestion-card__name">{{ suggestion.fieldName }}</div>
                                    <div class="suggestion-card__path">{{ suggestion.jsonPath }}</div>
                                  </div>
                                  <el-tag size="small" :type="getSuggestionTypeTag(suggestion.inferredType)" effect="plain">
                                    {{ suggestion.inferredType }}
                                  </el-tag>
                                </div>
                                <div class="suggestion-card__bottom">
                                  <span class="suggestion-card__sample" :title="formatSuggestionSampleValue(suggestion.sampleValue)">
                                    {{ formatSuggestionSampleValue(suggestion.sampleValue) }}
                                  </span>
                                  <el-button
                                    size="small"
                                    :type="isSuggestionMapped(suggestion) ? 'success' : 'primary'"
                                    plain
                                    @click.stop="handleApplySuggestion(suggestion)"
                                  >
                                    {{ isSuggestionMapped(suggestion) ? '更新' : '加入映射' }}
                                  </el-button>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                        <div v-else class="editor-empty">
                          <span>还没有可用字段建议，先解析一条合法样例消息。</span>
                        </div>
                      </div>

                      <div v-else class="sample-inspector__panel">
                        <div v-if="configuredMappings.length > 0" class="selected-mappings">
                          <div
                            v-for="(mapping, index) in configuredMappings"
                            :key="`${mapping.targetField}-${mapping.expression}-${index}`"
                            class="selected-mapping-card"
                          >
                            <div class="selected-mapping-card__header">
                              <div>
                                <div class="selected-mapping-card__field">{{ mapping.targetField || '未命名字段' }}</div>
                                <div class="selected-mapping-card__path">{{ mapping.expression || '待填写表达式' }}</div>
                              </div>
                              <el-tag size="small" type="success" effect="plain">{{ getMappingResolvedType(mapping) }}</el-tag>
                            </div>
                            <div class="selected-mapping-card__footer">
                              <span class="selected-mapping-card__sample">{{ getMappingPreviewValue(mapping) }}</span>
                              <el-button link type="primary" @click="handleEditMappedField">继续编辑</el-button>
                            </div>
                          </div>
                        </div>
                        <div v-else class="editor-empty">
                          <span>还没有加入映射的字段，先从字段建议里挑选。</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </el-form-item>
              </div>

              <div ref="mqMappingSectionRef" class="drawer-section drawer-section--panel">
                <div class="drawer-section__header">
                  <div>
                    <div class="drawer-section__eyebrow">Step 03</div>
                    <div class="drawer-section__title">字段映射</div>
                    <div class="drawer-section__desc">映射改成纵向卡片，表达式独占一整行，高级项按需展开，避免在窄抽屉里横向拥挤。</div>
                  </div>
                  <el-button type="primary" plain :disabled="jsonPathSuggestions.length === 0" @click="handleGenerateMappings">
                    一键生成字段映射
                  </el-button>
                </div>

                <el-form-item>
                  <template #label>
                    <span class="mq-key-label">字段映射</span>
                  </template>
                  <div class="field-mappings">
                    <div class="field-mappings__summary">
                      <div class="field-mappings__summary-card">
                        <span class="field-mappings__summary-label">已完成</span>
                        <span class="field-mappings__summary-value">{{ completedMappingCount }}</span>
                      </div>
                      <div class="field-mappings__summary-card">
                        <span class="field-mappings__summary-label">总映射</span>
                        <span class="field-mappings__summary-value">{{ form.mqSourceConfig.fieldMappings.length }}</span>
                      </div>
                    </div>

                    <div v-if="form.mqSourceConfig.fieldMappings.length === 0" class="editor-empty">
                      <span>还没有字段映射，先添加第一条映射。</span>
                      <el-button type="primary" link @click="addFieldMapping">添加第一条映射</el-button>
                    </div>

                      <div v-else class="mapping-card-list">
                      <div
                        v-for="(fm, index) in form.mqSourceConfig.fieldMappings"
                        :key="index"
                        class="mapping-card"
                      >
                        <div class="mapping-card__header">
                          <div class="mapping-card__title-wrap">
                            <span class="mapping-card__index">映射 {{ String(index + 1).padStart(2, '0') }}</span>
                            <div class="mapping-card__chips">
                              <el-tag size="small" type="info" effect="plain">{{ getMappingChipText(fm) }}</el-tag>
                            </div>
                          </div>
                          <div class="mapping-card__actions">
                            <span class="mapping-card__advanced-summary">{{ getMappingAdvancedSummary(fm) }}</span>
                            <el-button link type="primary" @click="toggleMappingAdvanced(index)">
                              {{ mappingAdvancedStates[index] ? '收起高级项' : '高级设置' }}
                            </el-button>
                            <el-button :icon="Delete" type="danger" link @click="removeFieldMapping(index)" />
                          </div>
                        </div>

                        <div class="mapping-card__grid">
                          <el-form-item
                            :prop="`mqSourceConfig.fieldMappings.${index}.targetField`"
                            :rules="[{ validator: validateUniqueTargetField(index), trigger: 'blur' }]"
                            class="mapping-card__field"
                          >
                            <template #label>目标字段</template>
                            <el-input v-model="fm.targetField" placeholder="如 orderId" />
                          </el-form-item>

                          <el-form-item class="mapping-card__field">
                            <template #label>提取策略</template>
                            <el-select v-model="fm.strategy" placeholder="提取策略">
                              <el-option v-for="s in Object.values(ExtractStrategy)" :key="s" :label="ExtractStrategyLabels[s]" :value="s" />
                            </el-select>
                          </el-form-item>

                          <el-form-item
                            :prop="`mqSourceConfig.fieldMappings.${index}.expression`"
                            :rules="[{ validator: validateMappingExpression, trigger: 'blur' }]"
                            class="mapping-card__field mapping-card__field--wide mapping-card__field--expression"
                          >
                            <template #label>提取表达式</template>
                            <el-select
                              v-if="fm.strategy === ExtractStrategy.JSON_PATH && jsonPathSuggestions.length > 0"
                              v-model="fm.expression"
                              placeholder="选择 JsonPath"
                              filterable
                              allow-create
                              @change="(val: string) => handleMappingExpressionSelect(index, val)"
                            >
                              <el-option
                                v-for="s in jsonPathSuggestions"
                                :key="s.jsonPath"
                                :label="formatSuggestionLabel(s)"
                                :value="s.jsonPath"
                              />
                            </el-select>
                            <el-input v-else v-model="fm.expression" placeholder="如 $.orderId" />
                          </el-form-item>
                        </div>

                        <div
                          class="mapping-card__expression-preview"
                          :class="{ 'is-empty': !fm.expression.trim() }"
                        >
                          <span class="mapping-card__expression-chip">
                            {{ fm.strategy === ExtractStrategy.JSON_PATH ? 'JSONPath' : 'Expression' }}
                          </span>
                          <span class="mapping-card__expression-text">
                            {{ fm.expression || '待填写提取表达式，建议优先从样例建议中选择。' }}
                          </span>
                        </div>

                        <div class="mapping-card__meta">
                          <span class="mapping-card__meta-label">样例值</span>
                          <span class="mapping-card__meta-value">{{ getMappingPreviewValue(fm) }}</span>
                        </div>

                        <div v-if="mappingAdvancedStates[index]" class="mapping-card__advanced">
                          <el-form-item class="mapping-card__field">
                            <template #label>数据类型</template>
                            <el-input v-model="fm.sourceType" placeholder="如 STRING" />
                          </el-form-item>
                          <el-form-item class="mapping-card__field">
                            <template #label>默认值</template>
                            <el-input v-model="fm.defaultValue" placeholder="选填" />
                          </el-form-item>
                        </div>
                      </div>

                      <el-button type="primary" link @click="addFieldMapping">+ 添加映射</el-button>
                    </div>
                  </div>
                </el-form-item>
              </div>

              <div ref="mqTestSectionRef" class="drawer-section drawer-section--panel">
                <div class="drawer-section__header">
                  <div>
                    <div class="drawer-section__eyebrow">Step 04</div>
                    <div class="drawer-section__title">映射测试</div>
                    <div class="drawer-section__desc">配置变更后会标记测试结果过期，底部主操作始终保留“测试映射”，不用滚回上方找按钮。</div>
                  </div>
                  <el-tag size="small" :type="testResultDirty ? 'warning' : (testResult?.success ? 'success' : 'info')" effect="plain">
                    {{ testResultDirty ? '结果已过期' : testResult ? (testResult.success ? '最近一次通过' : '最近一次失败') : '尚未测试' }}
                  </el-tag>
                </div>

                <el-form-item>
                  <template #label>
                    <span class="mq-key-label">映射测试</span>
                  </template>
                  <div class="mapping-test">
                    <div class="mapping-test__actions">
                      <span class="mapping-test__hint">样例消息和字段映射配置完成后再测试，结果更稳定。</span>
                      <el-button type="primary" plain :loading="testLoading" :disabled="!canTestMapping" @click="handleTestMapping">
                        测试映射
                      </el-button>
                    </div>
                    <el-alert
                      v-if="testResultDirty"
                      class="mapping-test__stale"
                      type="warning"
                      title="字段映射或样例消息已变更，请重新测试"
                      :closable="false"
                      show-icon
                    />
                    <div v-if="testResult" class="mapping-test__result">
                      <el-alert
                        :type="testResult.success ? 'success' : 'error'"
                        :title="testResult.success ? '提取成功' : '提取存在错误'"
                        :closable="false"
                        show-icon
                      />
                      <div class="mapping-test__toolbar">
                        <div class="mapping-test__filters">
                          <el-button size="small" :type="testResultView === 'all' ? 'primary' : 'default'" plain @click="testResultView = 'all'">
                            全部结果
                          </el-button>
                          <el-button
                            size="small"
                            :type="testResultView === 'failed' ? 'danger' : 'default'"
                            plain
                            :disabled="visibleTestErrors.length === 0"
                            @click="testResultView = 'failed'"
                          >
                            仅看失败项
                          </el-button>
                        </div>
                        <el-button link type="primary" @click="handleCopyTestResult">复制测试结果</el-button>
                      </div>
                      <div v-if="visibleExtractedFields.length > 0" class="mapping-test__fields">
                        <el-descriptions :column="1" border size="small">
                          <el-descriptions-item v-for="item in visibleExtractedFields" :key="item.key" :label="String(item.key)">
                            <span>{{ item.value.value }}</span>
                            <el-tag size="small" type="info" style="margin-left: 8px">{{ item.value.sourceType }}</el-tag>
                          </el-descriptions-item>
                        </el-descriptions>
                      </div>
                      <div v-if="visibleTestErrors.length > 0" class="mapping-test__errors">
                        <div v-for="(err, i) in visibleTestErrors" :key="i" class="mapping-test__error-item">
                          <el-tag size="small" type="danger">{{ err.targetField }}</el-tag>
                          <span>{{ err.error }}</span>
                        </div>
                      </div>
                      <div v-else-if="testResultView === 'failed'" class="editor-empty">
                        <span>当前没有失败项，可以切回全部结果查看提取内容。</span>
                      </div>
                    </div>
                  </div>
                </el-form-item>
              </div>
            </div>

            <template #footer>
              <div class="drawer-footer">
                <div class="drawer-footer__summary">
                  <span class="drawer-footer__summary-label">当前进度</span>
                  <span class="drawer-footer__summary-value">{{ completedMappingCount }}/{{ form.mqSourceConfig.fieldMappings.length }} 条映射已完成</span>
                </div>
                <div class="drawer-footer__actions">
                  <el-button type="primary" plain :loading="testLoading" :disabled="!canTestMapping" @click="handleTestMapping">
                    测试映射
                  </el-button>
                  <el-button @click="closeMqConfigDrawer">完成配置</el-button>
                </div>
              </div>
            </template>
          </el-drawer>
        </template>

        <!-- Properties editor -->
        <div v-if="form.sourceType === SourceType.SDK" class="form-section">
          <div class="form-section__header">
            <div>
              <div class="form-section__title">2. 属性定义</div>
              <div class="form-section__desc">事件属性是可选项，建议只保留后续查询和分群会用到的字段。</div>
            </div>
          </div>

          <el-form-item label="属性定义">
            <div class="properties-editor">
              <div v-if="form.properties.length === 0" class="editor-empty">
                <span>当前没有属性定义，后续也可以在编辑事件时再补充。</span>
                <el-button type="primary" link @click="addProperty">添加第一个属性</el-button>
              </div>
              <template v-else>
                <div v-for="(prop, index) in form.properties" :key="index" class="property-row">
                  <el-form-item
                    :prop="`properties.${index}.propertyName`"
                    :rules="[{ validator: validateUniquePropertyName(index), trigger: 'blur' }]"
                    class="property-row__item"
                  >
                    <el-input v-model="prop.propertyName" placeholder="属性名" style="width: 140px" />
                  </el-form-item>
                  <el-form-item class="property-row__item">
                    <el-select v-model="prop.propertyType" placeholder="类型" style="width: 110px">
                      <el-option v-for="pt in propertyTypeOptions" :key="pt" :label="pt" :value="pt" />
                    </el-select>
                  </el-form-item>
                  <el-form-item class="property-row__item">
                    <el-input v-model="prop.displayName" placeholder="显示名" style="width: 140px" />
                  </el-form-item>
                  <el-form-item class="property-row__item">
                    <el-checkbox v-model="prop.required">必填</el-checkbox>
                  </el-form-item>
                  <el-button :icon="Delete" type="danger" link @click="removeProperty(index)" />
                </div>
                <el-button type="primary" link @click="addProperty">+ 添加属性</el-button>
              </template>
            </div>
          </el-form-item>
        </div>
      </el-form>

      <template #footer>
        <el-button @click="requestCloseDialog()">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="handleSubmit">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style lang="scss" scoped>
.event-definition-form {
  :deep(.el-form-item__label) {
    font-size: 13px;
    font-weight: 600;
    color: #475467;
    letter-spacing: 0.2px;
  }

  :deep(.el-form-item__content) {
    min-width: 0;
  }
}

.form-section {
  padding: 16px 18px 8px;
  border: 1px solid #ebeef5;
  border-radius: 10px;
  margin-bottom: 16px;
  background: #fafbfc;

  &--mq {
    background: #fffdf8;
    border-color: #f2d6a2;
  }

  &__header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 16px;
  }

  &__title {
    font-size: 14px;
    font-weight: 600;
    color: #303133;
  }

  &__desc {
    margin-top: 4px;
    font-size: 12px;
    color: #909399;
  }
}

.mq-progress {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 16px;

  &__item {
    padding: 6px 10px;
    border-radius: 999px;
    background: #f4f4f5;
    color: #606266;
    font-size: 12px;
    line-height: 1;

    &.is-done {
      background: #f0f9eb;
      color: #67c23a;
    }
  }
}

.mq-summary {
  display: flex;
  flex-direction: column;
  gap: 12px;

  &__grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 12px;
  }

  &__card {
    padding: 12px 14px;
    border: 1px solid #ebeef5;
    border-radius: 8px;
    background: #fff;
  }

  &__label {
    font-family: 'Trebuchet MS', 'Avenir Next', 'PingFang SC', 'Microsoft YaHei', sans-serif;
    font-size: 11px;
    font-weight: 800;
    color: #41556f;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    margin-bottom: 6px;
  }

  &__value {
    font-size: 14px;
    color: #303133;
    font-weight: 500;
  }
}

.mq-config-drawer {
  :deep(.el-drawer__header) {
    margin-bottom: 0;
    padding: 22px 24px 0;
  }

  :deep(.el-drawer__body) {
    padding: 0 24px 24px;
    background:
      radial-gradient(circle at top right, rgba(229, 239, 255, 0.85), transparent 32%),
      linear-gradient(180deg, #f7fafc 0%, #ffffff 18%, #ffffff 100%);
  }

  :deep(.el-drawer__footer) {
    padding: 14px 24px 18px;
    border-top: 1px solid #e8edf4;
    background: rgba(255, 255, 255, 0.92);
    backdrop-filter: blur(8px);
  }

  :deep(.el-form-item) {
    margin-bottom: 18px;
  }

  :deep(.el-form-item__label) {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    min-height: 34px;
    padding-right: 12px;
    font-family: 'Trebuchet MS', 'Avenir Next', 'PingFang SC', 'Microsoft YaHei', sans-serif;
    font-size: 12px;
    font-weight: 800;
    line-height: 1.35;
    color: #243b53;
    letter-spacing: 0.08em;
    text-wrap: balance;
  }

  :deep(.el-form-item__label .form-item-label),
  :deep(.el-form-item__label:not(:empty)) {
    text-shadow: 0 1px 0 rgba(255, 255, 255, 0.7);
  }

  :deep(.el-input__wrapper),
  :deep(.el-select__wrapper),
  :deep(.el-textarea__inner) {
    border-radius: 12px;
  }
}

.mq-drawer-hero {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 20px;
  width: 100%;
  font-family: 'Avenir Next', 'PingFang SC', 'Microsoft YaHei', sans-serif;

  &__main {
    min-width: 0;
  }

  &__eyebrow {
    display: inline-flex;
    align-items: center;
    padding: 5px 10px;
    border-radius: 999px;
    background: #ecf3ff;
    color: #2f6bff;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.14em;
    text-transform: uppercase;
  }

  &__title {
    margin-top: 12px;
    font-size: 28px;
    line-height: 1.1;
    font-weight: 700;
    color: #111827;
    letter-spacing: 0.02em;
  }

  &__desc {
    margin-top: 10px;
    max-width: 620px;
    font-size: 13px;
    line-height: 1.65;
    color: #667085;
  }

  &__stats {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 10px;
    min-width: 320px;
  }
}

.mq-drawer-stat {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 12px 14px;
  border: 1px solid #dde7f5;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.86);
  box-shadow: 0 10px 28px rgba(15, 23, 42, 0.05);

  &__label {
    font-size: 11px;
    color: #8a94a6;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }

  &__value {
    font-size: 16px;
    font-weight: 700;
    color: #1f2937;
  }
}

.mq-drawer-shell {
  display: flex;
  flex-direction: column;
  gap: 18px;
  padding-top: 18px;
}

.mq-step-nav {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
}

.mq-step-tab {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  padding: 14px 16px;
  border: 1px solid #dde5f0;
  border-radius: 16px;
  background: linear-gradient(180deg, #ffffff 0%, #f7fafc 100%);
  text-align: left;
  cursor: pointer;
  transition: all 0.2s ease;
  font-family: 'Avenir Next', 'PingFang SC', 'Microsoft YaHei', sans-serif;

  &:hover {
    border-color: #b7cdfc;
    transform: translateY(-1px);
    box-shadow: 0 12px 24px rgba(47, 107, 255, 0.08);
  }

  &__index {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 34px;
    height: 34px;
    border-radius: 12px;
    background: #eef3fb;
    color: #44556f;
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.08em;
  }

  &__content {
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-width: 0;
  }

  &__title {
    font-size: 15px;
    font-weight: 700;
    color: #14213d;
    letter-spacing: 0.01em;
  }

  &__desc {
    font-size: 12px;
    color: #7b8797;
    line-height: 1.4;
  }

  &__status {
    margin-left: auto;
    padding: 5px 9px;
    border-radius: 999px;
    background: #eef2f7;
    color: #607086;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.04em;
    white-space: nowrap;
  }

  &.is-active {
    border-color: #2f6bff;
    background: linear-gradient(135deg, #edf4ff 0%, #ffffff 100%);
    box-shadow: 0 14px 30px rgba(47, 107, 255, 0.14);

    .mq-step-tab__index {
      background: #2f6bff;
      color: #fff;
    }
  }

  &.is-done {
    border-color: #d8eddc;
    background: linear-gradient(180deg, #ffffff 0%, #f6fcf7 100%);

    .mq-step-tab__index {
      background: #e8f7eb;
      color: #2d8a46;
    }

    .mq-step-tab__status {
      background: #e8f7eb;
      color: #2d8a46;
    }
  }

  &.is-active {
    .mq-step-tab__status {
      background: #dbe8ff;
      color: #1f4ed8;
    }
  }

  &.is-pending {
    .mq-step-tab__status {
      background: #eef2f7;
      color: #607086;
    }
  }
}

.drawer-section {
  &--panel {
    padding: 18px 20px 20px;
    border: 1px solid #e3eaf3;
    border-radius: 20px;
    background: linear-gradient(180deg, rgba(255, 255, 255, 0.98) 0%, #fbfdff 100%);
    box-shadow: 0 12px 28px rgba(15, 23, 42, 0.04);
  }

  &__header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 14px;
  }

  &__eyebrow {
    font-family: 'Avenir Next', 'PingFang SC', 'Microsoft YaHei', sans-serif;
    font-size: 11px;
    font-weight: 700;
    color: #2f6bff;
    letter-spacing: 0.14em;
    text-transform: uppercase;
  }

  &__title {
    margin-top: 8px;
    font-size: 20px;
    font-family: 'Trebuchet MS', 'Avenir Next', 'PingFang SC', 'Microsoft YaHei', sans-serif;
    font-weight: 800;
    color: #172b4d;
    letter-spacing: 0.04em;
  }

  &__desc {
    margin-top: 6px;
    font-size: 13px;
    line-height: 1.65;
    color: #6b7280;
  }

  &__actions {
    display: flex;
    align-items: center;
    gap: 12px;
    flex-wrap: wrap;
  }
}

.drawer-form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0 16px;

  &__item {
    min-width: 0;

    &--wide {
      grid-column: 1 / -1;
    }
  }
}

.template-selector {
  width: 100%;
}

.form-item-label {
  color: #606266;

  &--strong {
    font-size: 13px;
    font-weight: 700;
    color: #172033;
    letter-spacing: 0.02em;
  }
}

.mq-key-label {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-family: 'Trebuchet MS', 'Avenir Next', 'PingFang SC', 'Microsoft YaHei', sans-serif;
  font-size: 12px;
  font-weight: 800;
  color: #16324f;
  letter-spacing: 0.08em;
}

.mq-key-label::before {
  content: '';
  width: 7px;
  height: 7px;
  border-radius: 999px;
  background: linear-gradient(180deg, #2f6bff 0%, #ff8b37 100%);
  box-shadow: 0 0 0 3px rgba(47, 107, 255, 0.12);
}

.template-option {
  display: flex;
  align-items: center;
  gap: 8px;

  &__name {
    font-weight: 600;
  }

  &__badge {
    font-size: 11px;
    color: #667085;
    background: #eef2f7;
    padding: 2px 6px;
    border-radius: 999px;
  }

  &__desc {
    font-size: 12px;
    color: #909399;
    margin-left: auto;
    max-width: 260px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}

.sample-json-area {
  width: 100%;

  &__editor {
    :deep(.el-textarea__inner) {
      background: linear-gradient(180deg, #fbfcfe 0%, #f6f8fc 100%);
      border-color: #d7deea;
      box-shadow: inset 0 1px 2px rgba(15, 23, 42, 0.04);
    }

    :deep(.el-textarea__inner:focus) {
      border-color: #7aa2ff;
      box-shadow: 0 0 0 1px rgba(64, 158, 255, 0.15);
    }
  }

  .sample-json-toolbar {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 10px;
    padding: 12px 14px;
    border: 1px solid #e2e8f0;
    border-radius: 14px 14px 0 0;
    background: linear-gradient(180deg, #f8fbff 0%, #f5f8fd 100%);

    &__meta {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    &__title {
      font-family: 'Avenir Next', 'PingFang SC', 'Microsoft YaHei', sans-serif;
      font-size: 15px;
      font-weight: 700;
      color: #172033;
      letter-spacing: 0.01em;
    }

    &__hint {
      font-size: 12px;
      color: #6b7280;
    }
  }

  &__actions {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-top: 10px;
  }

  &__status {
    font-size: 12px;
    color: #667085;
    font-weight: 600;
    letter-spacing: 0.01em;
  }
}

.sample-inspector {
  margin-top: 16px;
  border: 1px solid #e3eaf3;
  border-radius: 18px;
  background: #f8fbff;
  overflow: hidden;

  &__tabs {
    display: inline-flex;
    gap: 8px;
    padding: 12px;
    border-bottom: 1px solid #e3eaf3;
    background: rgba(255, 255, 255, 0.9);
  }

  &__tab {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 9px 14px;
    border: 1px solid transparent;
    border-radius: 999px;
    background: transparent;
    color: #667085;
    cursor: pointer;
    font-family: 'Trebuchet MS', 'Avenir Next', 'PingFang SC', 'Microsoft YaHei', sans-serif;
    font-size: 14px;
    font-weight: 800;
    letter-spacing: 0.05em;
    transition: all 0.2s ease;

    span {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 24px;
      height: 24px;
      padding: 0 7px;
      border-radius: 999px;
      background: #edf2f8;
      color: #526176;
      font-size: 12px;
    }

    &.is-active {
      border-color: #b9cdfc;
      background: #edf4ff;
      color: #1f4ed8;

      span {
        background: #2f6bff;
        color: #fff;
      }
    }
  }

  &__panel {
    padding: 14px;
  }
}

.jsonpath-hints {
  margin-bottom: 10px;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  font-size: 12px;

  &__desc {
    color: #667085;
  }
}

.suggestion-groups {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.suggestion-group {
  border: 1px solid #e2e8f0;
  border-radius: 14px;
  background: #fff;
  overflow: hidden;

  &__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 10px 14px;
    background: #f8fafc;
    border-bottom: 1px solid #edf2f7;
  }

  &__title {
    font-size: 13px;
    font-weight: 700;
    color: #172033;
  }

  &__count {
    font-size: 12px;
    color: #748093;
  }

  &__list {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
    gap: 10px;
    padding: 12px;
  }
}

.suggestion-card {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 11px 12px;
  border: 1px solid #ebf0f7;
  border-radius: 12px;
  background: linear-gradient(180deg, #ffffff 0%, #fbfcff 100%);
  cursor: default;
  transition: all 0.2s ease;

  &:hover {
    border-color: #c8daf8;
    box-shadow: 0 10px 20px rgba(47, 107, 255, 0.08);
  }

  &__top {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 10px;
  }

  &__main {
    min-width: 0;
  }

  &__name {
    font-size: 13px;
    font-weight: 700;
    color: #172033;
  }

  &__path {
    margin-top: 3px;
    font-size: 12px;
    line-height: 1.45;
    color: #606266;
    word-break: break-all;
    font-family: SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;
  }

  &__bottom {
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
  }

  &__sample {
    flex: 1;
    min-width: 0;
    padding: 2px 8px;
    border-radius: 999px;
    background: #f5f7fa;
    color: #606266;
    font-size: 12px;
    line-height: 20px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-family: SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;
  }
}

.selected-mappings {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 12px;
}

.selected-mapping-card {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 14px;
  border: 1px solid #dbe6f4;
  border-radius: 14px;
  background: linear-gradient(180deg, #ffffff 0%, #f8fbff 100%);
  transition: all 0.2s ease;

  &__header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 10px;
  }

  &__field {
    font-size: 14px;
    font-weight: 700;
    color: #172033;
  }

  &__path {
    margin-top: 4px;
    font-size: 12px;
    line-height: 1.5;
    color: #667085;
    word-break: break-all;
    font-family: SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;
  }

  &__footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
  }

  &__sample {
    flex: 1;
    min-width: 0;
    font-size: 12px;
    color: #667085;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}

.properties-editor {
  width: 100%;

  .property-row {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    margin-bottom: 8px;
  }

  :deep(.el-form-item) {
    margin-bottom: 0;
  }
}

.editor-empty {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 14px;
  border: 1px dashed #dcdfe6;
  border-radius: 8px;
  background: #fff;
  color: #909399;
  font-size: 13px;
}

.field-mappings {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 14px;

  &__summary {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 12px;
  }

  &__summary-card {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 12px 14px;
    border: 1px solid #e2e8f0;
    border-radius: 14px;
    background: #f8fbff;
  }

  &__summary-label {
    font-size: 12px;
    color: #748093;
  }

  &__summary-value {
    font-family: 'Avenir Next', 'PingFang SC', 'Microsoft YaHei', sans-serif;
    font-size: 22px;
    font-weight: 700;
    color: #172033;
  }

  .mapping-card-list {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
}

.mapping-card {
  padding: 16px;
  border: 1px solid #dfe7f3;
  border-radius: 18px;
  background: linear-gradient(180deg, #ffffff 0%, #fbfdff 100%);
  box-shadow: 0 10px 24px rgba(15, 23, 42, 0.04);

  &__header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 14px;
  }

  &__title-wrap {
    display: flex;
    flex-direction: column;
    gap: 8px;
    min-width: 0;
  }

  &__index {
    font-family: 'Avenir Next', 'PingFang SC', 'Microsoft YaHei', sans-serif;
    font-size: 12px;
    font-weight: 700;
    color: #2f6bff;
    letter-spacing: 0.12em;
    text-transform: uppercase;
  }

  &__chips {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  &__actions {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-shrink: 0;
    flex-wrap: wrap;
    justify-content: flex-end;
  }

  &__advanced-summary {
    padding: 4px 10px;
    border-radius: 999px;
    background: #f2f5fa;
    color: #667085;
    font-size: 12px;
    line-height: 1.4;
  }

  &__grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0 14px;
  }

  &__field {
    min-width: 0;

    &--wide {
      grid-column: 1 / -1;
    }

    &--expression {
      :deep(.el-select__wrapper),
      :deep(.el-input__wrapper) {
        background: linear-gradient(180deg, #f8fbff 0%, #f2f7ff 100%);
        box-shadow: inset 0 1px 2px rgba(15, 23, 42, 0.04);
      }

      :deep(.el-input__inner),
      :deep(.el-select__selected-item),
      :deep(.el-select__placeholder) {
        font-family: SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;
        font-size: 13px;
      }
    }
  }

  &__expression-preview {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    align-items: start;
    gap: 10px;
    margin: 2px 0 0;
    padding: 12px 14px;
    border: 1px solid #e4ebf5;
    border-radius: 14px;
    background: linear-gradient(180deg, #f9fbff 0%, #f4f8ff 100%);
    transition: all 0.2s ease;

    &.is-empty {
      border-style: dashed;
      background: #fbfcfe;
    }

  }

  &__expression-chip {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 82px;
    padding: 5px 10px;
    border-radius: 999px;
    background: #eaf1ff;
    color: #295fd6;
    font-family: 'Avenir Next', 'PingFang SC', 'Microsoft YaHei', sans-serif;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  &__expression-text {
    min-width: 0;
    font-family: SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;
    font-size: 13px;
    line-height: 1.65;
    color: #1f2937;
    word-break: break-all;
  }

  &__meta {
    display: grid;
    grid-template-columns: 68px minmax(0, 1fr);
    align-items: center;
    gap: 10px;
    margin-top: 10px;
    padding: 12px 14px;
    border-radius: 12px;
    background: #f6f9fc;
  }

  &__meta-label {
    display: inline-flex;
    align-items: center;
    min-height: 24px;
    font-size: 12px;
    color: #667085;
    font-weight: 700;
    letter-spacing: 0.03em;
  }

  &__meta-value {
    min-width: 0;
    font-size: 12px;
    line-height: 1.6;
    color: #344054;
    word-break: break-all;
    font-family: SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;
  }

  &__advanced {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0 14px;
    margin-top: 12px;
    padding-top: 12px;
    border-top: 1px dashed #dbe3ee;
  }
}

.mapping-test {
  width: 100%;

  &__actions {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-top: 4px;
  }

  &__hint {
    font-family: 'Trebuchet MS', 'Avenir Next', 'PingFang SC', 'Microsoft YaHei', sans-serif;
    font-size: 12px;
    font-weight: 700;
    color: #516275;
    letter-spacing: 0.03em;
  }

  &__stale {
    margin-top: 12px;
  }

  &__result {
    margin-top: 12px;
  }

  &__toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-top: 12px;
    padding: 10px 12px;
    border: 1px solid #e3eaf3;
    border-radius: 12px;
    background: #f8fbff;
  }

  &__filters {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }

  &__fields {
    margin-top: 8px;
  }

  &__errors {
    margin-top: 8px;
  }

  &__error-item {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 4px;
    color: #f56c6c;
    font-size: 13px;
  }
}

.drawer-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;

  &__summary {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  &__summary-label {
    font-size: 12px;
    color: #748093;
  }

  &__summary-value {
    font-family: 'Avenir Next', 'PingFang SC', 'Microsoft YaHei', sans-serif;
    font-size: 15px;
    font-weight: 700;
    color: #172033;
  }

  &__actions {
    display: flex;
    align-items: center;
    gap: 12px;
  }
}

:deep(.mapping-card .el-form-item__content),
:deep(.field-mappings .el-form-item__content) {
  display: block;
  width: 100%;
}

:deep(.mapping-card .el-input),
:deep(.mapping-card .el-select) {
  width: 100%;
}

@media (max-width: 960px) {
  .mq-drawer-hero {
    flex-direction: column;

    &__stats {
      width: 100%;
      min-width: 0;
    }
  }

  .mq-step-nav {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .drawer-form-grid,
  .mapping-card__grid,
  .mapping-card__advanced {
    grid-template-columns: 1fr;
  }

  .selected-mappings,
  .field-mappings__summary {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 720px) {
  .mq-config-drawer {
    :deep(.el-drawer__header) {
      padding: 18px 16px 0;
    }

    :deep(.el-drawer__body) {
      padding: 0 16px 18px;
    }

    :deep(.el-drawer__footer) {
      padding: 12px 16px 16px;
    }
  }

  .mq-step-nav {
    grid-template-columns: 1fr;
  }

  .mq-drawer-hero__stats {
    grid-template-columns: 1fr;
  }

  .sample-json-toolbar,
  .drawer-section__header,
  .mapping-test__toolbar,
  .mapping-test__actions,
  .drawer-footer {
    flex-direction: column;
    align-items: stretch;
  }

  .mapping-card__expression-preview,
  .mapping-card__meta {
    grid-template-columns: 1fr;
  }

  .sample-inspector__tabs,
  .drawer-footer__actions {
    flex-wrap: wrap;
  }
}
</style>
