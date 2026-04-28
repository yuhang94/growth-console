<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, Refresh, Delete, CopyDocument, InfoFilled } from '@element-plus/icons-vue'
import {
  pageSegments, createSegment, updateSegment, deleteSegment,
  previewSegment, computeSegment, getSegmentUsers,
} from '@/api/segment'
import { pageTagDefinitions } from '@/api/tagDefinition'
import { pageEventDefinitions } from '@/api/eventDefinition'
import { listSegmentTemplates } from '@/api/segmentTemplate'
import {
  CompareOperator, CompareOperatorLabels, CompareOperatorsByTagType, ConditionOperator,
  BehaviorOperator, BehaviorOperatorLabels,
  EventType, TagType, TagTypeLabels,
  type SegmentDTO, type SegmentConditionDTO, type TagDefinitionDTO,
  type EventDefinitionDTO, type EventPropertyFilterDTO, type PropertyDefinitionDTO,
  type SegmentTemplateDTO,
} from '@/types/api'

// ==================== RuleGroup model ====================
// Each section (tag / behavior) has multiple RuleGroups.
// A RuleGroup contains multiple leaf conditions with an intra-group operator.
// Groups are connected by an inter-group operator.

interface TagRuleGroup {
  intraOp: ConditionOperator // conditions within this group
  conditions: SegmentConditionDTO[]
}

interface BehaviorRuleGroup {
  intraOp: ConditionOperator
  conditions: SegmentConditionDTO[]
}

interface QuickStartTemplate {
  key: string
  title: string
  description: string
  kind: 'starter'
}

// --- Table state ---
const loading = ref(false)
const tableData = ref<SegmentDTO[]>([])
const total = ref(0)
const queryParams = reactive({ pageNum: 1, pageSize: 20 })

async function fetchData() {
  loading.value = true
  try {
    const result = await pageSegments({ pageNum: queryParams.pageNum, pageSize: queryParams.pageSize })
    tableData.value = result.list
    total.value = result.total
  } finally { loading.value = false }
}
function handlePageChange(page: number) { queryParams.pageNum = page; fetchData() }
function handleSizeChange(size: number) { queryParams.pageSize = size; queryParams.pageNum = 1; fetchData() }

// --- Options ---
const tagOptions = ref<TagDefinitionDTO[]>([])
async function loadTagOptions() { tagOptions.value = (await pageTagDefinitions({ pageSize: 1000 })).list }

const eventOptions = ref<EventDefinitionDTO[]>([])
async function loadEventOptions() { eventOptions.value = (await pageEventDefinitions({ pageSize: 1000 })).list }

function getEventProperties(eventName?: string): PropertyDefinitionDTO[] {
  if (!eventName) return []
  return eventOptions.value.find((e) => e.eventName === eventName)?.properties ?? []
}

const starterTemplates: QuickStartTemplate[] = [
  { key: 'tag_basic', title: '只看属性', description: '先建 1 条用户属性条件，适合筛选等级、会员状态、活跃日期。', kind: 'starter' },
  { key: 'behavior_basic', title: '只看行为', description: '先建 1 条行为条件，适合筛选最近做过什么、做了几次。', kind: 'starter' },
  { key: 'hybrid_basic', title: '属性 + 行为', description: '同时创建属性条件和行为条件，默认要求同时满足。', kind: 'starter' },
]
const serverTemplates = ref<SegmentTemplateDTO[]>([])
const serverTemplatesLoaded = ref(false)

async function loadServerTemplates() {
  if (serverTemplatesLoaded.value) return
  try {
    serverTemplates.value = await listSegmentTemplates()
    serverTemplatesLoaded.value = true
  } catch {
    // non-blocking
  }
}

const selectedTemplateKey = ref('')
const slotParams = ref<{ days: number; count: number }[]>([])

// --- Dialog state ---
const dialogVisible = ref(false)
const dialogTitle = ref('新建人群分层')
const isEditing = ref(false)
const editingId = ref(0)
const submitting = ref(false)
const form = reactive<{ segmentName: string; description: string }>({ segmentName: '', description: '' })

// --- Rule groups ---
const tagGroups = ref<TagRuleGroup[]>([])
const tagGroupsOp = ref<ConditionOperator>(ConditionOperator.AND)
const behaviorGroups = ref<BehaviorRuleGroup[]>([])
const behaviorGroupsOp = ref<ConditionOperator>(ConditionOperator.AND)
const rootOperator = ref<ConditionOperator>(ConditionOperator.AND)

function createTagLeaf(): SegmentConditionDTO {
  return { tagKey: '', compareOp: CompareOperator.EQ, values: [''] }
}
function createBehaviorLeaf(): SegmentConditionDTO & { _timeRange?: string[] } {
  return { behaviorOp: BehaviorOperator.DID, eventName: '', timeRangeStart: '', timeRangeEnd: '', countOp: CompareOperator.GE, countValue: 1, propertyFilters: [], _timeRange: [] }
}
function addTagGroup() {
  tagGroups.value.push({ intraOp: ConditionOperator.AND, conditions: [createTagLeaf()] })
}
function removeTagGroup(gi: number) { tagGroups.value.splice(gi, 1) }
function addTagToGroup(gi: number) { tagGroups.value[gi].conditions.push(createTagLeaf()) }
function removeTagFromGroup(gi: number, ci: number) { tagGroups.value[gi].conditions.splice(ci, 1); if (tagGroups.value[gi].conditions.length === 0) tagGroups.value.splice(gi, 1) }

function addBehaviorGroup() {
  behaviorGroups.value.push({ intraOp: ConditionOperator.AND, conditions: [createBehaviorLeaf()] })
}
function removeBehaviorGroup(gi: number) { behaviorGroups.value.splice(gi, 1) }
function addBehaviorToGroup(gi: number) { behaviorGroups.value[gi].conditions.push(createBehaviorLeaf()) }
function removeBehaviorFromGroup(gi: number, ci: number) { behaviorGroups.value[gi].conditions.splice(ci, 1); if (behaviorGroups.value[gi].conditions.length === 0) behaviorGroups.value.splice(gi, 1) }

function formatDate(date: Date) {
  const year = date.getFullYear()
  const month = `${date.getMonth() + 1}`.padStart(2, '0')
  const day = `${date.getDate()}`.padStart(2, '0')
  return `${year}-${month}-${day}`
}

function getRecentRange(days: number): [string, string] {
  const end = new Date()
  const start = new Date()
  start.setDate(start.getDate() - days)
  return [formatDate(start), formatDate(end)]
}

function createBehaviorTemplateCondition(options?: {
  eventName?: string
  behaviorOp?: BehaviorOperator
  days?: number
  countOp?: CompareOperator
  countValue?: number
  propertyFilters?: EventPropertyFilterDTO[]
}): SegmentConditionDTO & { _timeRange?: string[] } {
  const [start, end] = getRecentRange(options?.days ?? 30)
  return {
    behaviorOp: options?.behaviorOp ?? BehaviorOperator.DID,
    eventName: options?.eventName || '',
    timeRangeStart: start,
    timeRangeEnd: end,
    countOp: options?.countOp ?? CompareOperator.GE,
    countValue: options?.countValue ?? 1,
    propertyFilters: options?.propertyFilters ?? [],
    _timeRange: [start, end],
  }
}

function findFirstEventByTypes(types: EventType[]) {
  return eventOptions.value.find((item) => types.includes(item.eventType))
}

function clearSelectedTemplate() {
  selectedTemplateKey.value = ''
  slotParams.value = []
}

function handleQuickStartClick(template: QuickStartTemplate | SegmentTemplateDTO) {
  if ('kind' in template && template.kind === 'starter') {
    clearSelectedTemplate()
    applyQuickStartTemplate((template as QuickStartTemplate).key)
    return
  }
  const tmpl = template as SegmentTemplateDTO
  selectedTemplateKey.value = tmpl.templateKey
  slotParams.value = tmpl.slots.map((slot) => ({ days: slot.defaultDays, count: slot.defaultCount }))
}

const selectedServerTemplate = computed<SegmentTemplateDTO | undefined>(() =>
  serverTemplates.value.find((t) => t.templateKey === selectedTemplateKey.value)
)

function applySelectedTemplate() {
  if (!selectedTemplateKey.value) return
  applyQuickStartTemplate(selectedTemplateKey.value)
}

function applyQuickStartTemplate(templateKey: string) {
  previewCount.value = null
  const warnings: string[] = []
  const usedEventNames: string[] = []

  if (templateKey === 'tag_basic') {
    form.segmentName = '属性筛选人群'
    form.description = '根据用户属性条件筛选目标人群'
    tagGroups.value = [{ intraOp: ConditionOperator.AND, conditions: [createTagLeaf()] }]
    behaviorGroups.value = []
    tagGroupsOp.value = ConditionOperator.AND
    behaviorGroupsOp.value = ConditionOperator.AND
    rootOperator.value = ConditionOperator.AND
    return
  }
  if (templateKey === 'behavior_basic') {
    form.segmentName = '行为筛选人群'
    form.description = '根据用户行为条件筛选目标人群'
    tagGroups.value = []
    behaviorGroups.value = [{ intraOp: ConditionOperator.AND, conditions: [createBehaviorLeaf()] }]
    tagGroupsOp.value = ConditionOperator.AND
    behaviorGroupsOp.value = ConditionOperator.AND
    rootOperator.value = ConditionOperator.AND
    return
  }
  if (templateKey === 'hybrid_basic') {
    form.segmentName = '属性与行为组合人群'
    form.description = '同时结合用户属性条件与行为条件筛选目标人群'
    tagGroups.value = [{ intraOp: ConditionOperator.AND, conditions: [createTagLeaf()] }]
    behaviorGroups.value = [{ intraOp: ConditionOperator.AND, conditions: [createBehaviorLeaf()] }]
    tagGroupsOp.value = ConditionOperator.AND
    behaviorGroupsOp.value = ConditionOperator.AND
    rootOperator.value = ConditionOperator.AND
    return
  }
  // Generic server template logic
  const serverTmpl = serverTemplates.value.find((t) => t.templateKey === templateKey)
  if (serverTmpl) {
    const conditions = serverTmpl.slots.map((slot, idx) => {
      const eventTypes = slot.eventTypes as EventType[]
      const matchedEvent = findFirstEventByTypes(eventTypes)
      const days = slotParams.value[idx]?.days ?? slot.defaultDays
      const count = slotParams.value[idx]?.count ?? slot.defaultCount
      if (matchedEvent?.displayName) usedEventNames.push(matchedEvent.displayName)
      else warnings.push(`${slot.label}：未找到匹配事件 [${eventTypes.join('/')}]，请应用后手动选择`)
      return createBehaviorTemplateCondition({ eventName: matchedEvent?.eventName, days, countValue: count })
    })
    form.segmentName = serverTmpl.title
    form.description = serverTmpl.description
    tagGroups.value = []
    behaviorGroups.value = [{ intraOp: ConditionOperator.AND, conditions }]
    rootOperator.value = ConditionOperator.AND
    behaviorGroupsOp.value = ConditionOperator.AND
    tagGroupsOp.value = ConditionOperator.AND
  }

  if (warnings.length > 0) {
    ElMessage.warning(warnings.join('；'))
    return
  }
  if (usedEventNames.length > 0) {
    ElMessage.success(`已应用模板，并自动匹配事件：${usedEventNames.join('、')}`)
  }
  clearSelectedTemplate()
}

// --- Build SegmentConditionDTO from rule groups ---
function buildGroupCondition(groups: { intraOp: ConditionOperator; conditions: SegmentConditionDTO[] }[], groupsOp: ConditionOperator): SegmentConditionDTO | null {
  const parts: SegmentConditionDTO[] = []
  for (const g of groups) {
    if (g.conditions.length === 0) continue
    if (g.conditions.length === 1) { parts.push(g.conditions[0]) }
    else { parts.push({ operator: g.intraOp, children: [...g.conditions] }) }
  }
  if (parts.length === 0) return null
  if (parts.length === 1) return parts[0]
  return { operator: groupsOp, children: parts }
}

function buildRootCondition(): SegmentConditionDTO {
  const children: SegmentConditionDTO[] = []
  const tagPart = buildGroupCondition(tagGroups.value, tagGroupsOp.value)
  if (tagPart) children.push(tagPart)
  const behaviorPart = buildGroupCondition(behaviorGroups.value, behaviorGroupsOp.value)
  if (behaviorPart) children.push(behaviorPart)
  return { operator: rootOperator.value, children }
}

// --- Parse SegmentConditionDTO back into rule groups ---
function isGroup(cond: SegmentConditionDTO): boolean {
  return !!cond.operator && Object.values(ConditionOperator).includes(cond.operator)
}
function isBehavior(cond: SegmentConditionDTO): boolean { return !!cond.behaviorOp }
function isTag(cond: SegmentConditionDTO): boolean { return !!cond.tagKey }

function parseIntoGroups(cond: SegmentConditionDTO | null, type: 'tag' | 'behavior'): { groups: { intraOp: ConditionOperator; conditions: SegmentConditionDTO[] }[]; groupsOp: ConditionOperator } {
  const check = type === 'tag' ? isTag : isBehavior
  if (!cond) return { groups: [], groupsOp: ConditionOperator.AND }
  // Single leaf
  if (!isGroup(cond) && check(cond)) return { groups: [{ intraOp: ConditionOperator.AND, conditions: [cond] }], groupsOp: ConditionOperator.AND }
  if (!isGroup(cond)) return { groups: [], groupsOp: ConditionOperator.AND }
  // Group node — check if children are all leaves or sub-groups
  const children = cond.children || []
  const allLeaves = children.every((c) => !isGroup(c) && check(c))
  if (allLeaves) {
    return { groups: [{ intraOp: cond.operator || ConditionOperator.AND, conditions: [...children] }], groupsOp: ConditionOperator.AND }
  }
  // Children are sub-groups (or mix)
  const groups: { intraOp: ConditionOperator; conditions: SegmentConditionDTO[] }[] = []
  for (const child of children) {
    if (isGroup(child)) {
      const leaves = (child.children || []).filter(check)
      if (leaves.length > 0) groups.push({ intraOp: child.operator || ConditionOperator.AND, conditions: leaves })
    } else if (check(child)) {
      groups.push({ intraOp: ConditionOperator.AND, conditions: [child] })
    }
  }
  return { groups, groupsOp: cond.operator || ConditionOperator.AND }
}

function parseRootCondition(root: SegmentConditionDTO) {
  rootOperator.value = root.operator || ConditionOperator.AND
  // Collect all tag and behavior subtrees
  let tagSubtree: SegmentConditionDTO | null = null
  let behaviorSubtree: SegmentConditionDTO | null = null

  if (!root.children || root.children.length === 0) {
    tagGroups.value = []; behaviorGroups.value = []
    tagGroupsOp.value = ConditionOperator.AND; behaviorGroupsOp.value = ConditionOperator.AND
    return
  }

  // Separate tag vs behavior children
  const tagChildren: SegmentConditionDTO[] = []
  const behaviorChildren: SegmentConditionDTO[] = []
  for (const child of root.children) {
    if (!isGroup(child)) {
      if (isBehavior(child)) behaviorChildren.push(child)
      else tagChildren.push(child)
    } else {
      // Check what's inside
      const leaves = child.children || []
      const hasTags = leaves.some((l) => isTag(l) || (isGroup(l) && (l.children || []).some(isTag)))
      const hasBehaviors = leaves.some((l) => isBehavior(l) || (isGroup(l) && (l.children || []).some(isBehavior)))
      if (hasTags && !hasBehaviors) tagChildren.push(child)
      else if (hasBehaviors && !hasTags) behaviorChildren.push(child)
      else {
        // Mixed — split
        for (const l of leaves) {
          if (isBehavior(l)) behaviorChildren.push(l)
          else tagChildren.push(l)
        }
      }
    }
  }

  if (tagChildren.length === 1) tagSubtree = tagChildren[0]
  else if (tagChildren.length > 1) tagSubtree = { operator: root.operator || ConditionOperator.AND, children: tagChildren }

  if (behaviorChildren.length === 1) behaviorSubtree = behaviorChildren[0]
  else if (behaviorChildren.length > 1) behaviorSubtree = { operator: root.operator || ConditionOperator.AND, children: behaviorChildren }

  const tagResult = parseIntoGroups(tagSubtree, 'tag')
  tagGroups.value = tagResult.groups
  tagGroupsOp.value = tagResult.groupsOp

  // Migrate old comma-separated IN/NOT_IN values for tag conditions
  for (const g of tagGroups.value) {
    for (const c of g.conditions) {
      if ((c.compareOp === CompareOperator.IN || c.compareOp === CompareOperator.NOT_IN) && c.values && c.values.length === 1 && c.values[0].includes(',')) {
        c.values = c.values[0].split(',').map((s) => s.trim()).filter(Boolean)
      }
    }
  }

  const behaviorResult = parseIntoGroups(behaviorSubtree, 'behavior')
  behaviorGroups.value = behaviorResult.groups
  behaviorGroupsOp.value = behaviorResult.groupsOp

  // Populate _timeRange for daterange picker and migrate old filter values
  for (const g of behaviorGroups.value) {
    for (const c of g.conditions as any[]) {
      c._timeRange = (c.timeRangeStart && c.timeRangeEnd) ? [c.timeRangeStart, c.timeRangeEnd] : []
      if (c.propertyFilters) {
        for (const pf of c.propertyFilters) {
          if ((pf.compareOp === CompareOperator.IN || pf.compareOp === CompareOperator.NOT_IN) && pf.values && pf.values.length === 1 && pf.values[0].includes(',')) {
            pf.values = pf.values[0].split(',').map((s: string) => s.trim()).filter(Boolean)
          }
        }
      }
    }
  }
}

// --- Dialog open/close ---
function openCreateDialog() {
  isEditing.value = false; dialogTitle.value = '新建人群分层'; editingId.value = 0
  form.segmentName = ''; form.description = ''
  tagGroups.value = []; behaviorGroups.value = []
  tagGroupsOp.value = ConditionOperator.AND; behaviorGroupsOp.value = ConditionOperator.AND
  rootOperator.value = ConditionOperator.AND; previewCount.value = null
  clearSelectedTemplate()
  dialogVisible.value = true; loadTagOptions(); loadEventOptions(); loadServerTemplates()
}

function openEditDialog(row: SegmentDTO) {
  isEditing.value = true; dialogTitle.value = '编辑人群分层'; editingId.value = row.id
  form.segmentName = row.segmentName; form.description = row.description || ''
  previewCount.value = null
  clearSelectedTemplate()
  if (row.rootCondition) parseRootCondition(JSON.parse(JSON.stringify(row.rootCondition)))
  else { tagGroups.value = []; behaviorGroups.value = [] }
  dialogVisible.value = true; loadTagOptions(); loadEventOptions()
}

async function handleSubmit() {
  if (!form.segmentName.trim()) { ElMessage.warning('请输入分层名称'); return }
  const validationError = validateConditions()
  if (validationError) { ElMessage.warning(validationError); return }
  submitting.value = true
  try {
    const root = buildRootCondition()
    // Strip _timeRange transient fields
    const clean = JSON.parse(JSON.stringify(root, (key, value) => key === '_timeRange' ? undefined : value))
    const payload = { segmentName: form.segmentName, description: form.description || undefined, rootCondition: clean }
    if (isEditing.value) { await updateSegment(editingId.value, payload); ElMessage.success('更新成功') }
    else { await createSegment(payload); ElMessage.success('创建成功') }
    dialogVisible.value = false; fetchData()
  } finally { submitting.value = false }
}

// --- Delete / Preview / Compute / Users ---
async function handleDelete(row: SegmentDTO) {
  try { await ElMessageBox.confirm(`确定删除人群分层「${row.segmentName}」吗？`, '提示', { type: 'warning' }); await deleteSegment(row.id); ElMessage.success('删除成功'); fetchData() } catch {}
}
const previewLoading = ref(false)
const previewCount = ref<number | null>(null)
async function handlePreview() {
  const validationError = validateConditions()
  if (validationError) { ElMessage.warning(validationError); return }
  previewLoading.value = true; previewCount.value = null
  try { previewCount.value = (await previewSegment({ rootCondition: buildRootCondition() })).userCount } finally { previewLoading.value = false }
}
async function handleCompute(row: SegmentDTO) {
  try { await ElMessageBox.confirm(`确定对「${row.segmentName}」执行计算吗？`, '提示', { type: 'info' }); await computeSegment(row.id); ElMessage.success('计算任务已触发'); fetchData() } catch {}
}
const usersDialogVisible = ref(false)
const usersLoading = ref(false)
const usersData = ref<string[]>([])
const usersTotal = ref(0)
const usersSegmentName = ref('')
const usersParams = reactive({ segmentId: 0, pageNum: 1, pageSize: 20 })
async function openUsersDialog(row: SegmentDTO) { usersSegmentName.value = row.segmentName; usersParams.segmentId = row.id; usersParams.pageNum = 1; usersDialogVisible.value = true; fetchUsers() }
async function fetchUsers() { usersLoading.value = true; try { const r = await getSegmentUsers(usersParams.segmentId, { pageNum: usersParams.pageNum, pageSize: usersParams.pageSize }); usersData.value = r.list; usersTotal.value = r.total } finally { usersLoading.value = false } }
function handleUsersPageChange(page: number) { usersParams.pageNum = page; fetchUsers() }

// --- Helpers ---
function needsValues(op?: CompareOperator) { return op !== CompareOperator.IS_NULL && op !== CompareOperator.IS_NOT_NULL }
function addPropertyFilter(cond: SegmentConditionDTO) { if (!cond.propertyFilters) cond.propertyFilters = []; cond.propertyFilters.push({ propertyKey: '', compareOp: CompareOperator.EQ, values: [''] }) }
function removePropertyFilter(cond: SegmentConditionDTO, index: number) { cond.propertyFilters?.splice(index, 1) }
const countOperators = [CompareOperator.GE, CompareOperator.LE, CompareOperator.EQ, CompareOperator.GT, CompareOperator.LT] as const
function getStatusType(status: number) { return status === 1 ? 'success' : 'info' }
function getStatusText(status: number) { return status === 1 ? '启用' : '停用' }
function getJoinText(op: ConditionOperator) { return op === ConditionOperator.AND ? '并且' : '或者' }
function getLogicModeLabel(op: ConditionOperator) { return op === ConditionOperator.AND ? '同时满足' : '满足任一' }
function getLogicHint(op: ConditionOperator, subject: string) { return op === ConditionOperator.AND ? `${subject}需要同时满足` : `${subject}满足任一即可` }

function normalizePropertyType(propertyType?: string): TagType {
  const normalized = (propertyType || '').toUpperCase()
  if (normalized === TagType.LONG) return TagType.LONG
  if (normalized === TagType.DOUBLE) return TagType.DOUBLE
  if (normalized === TagType.BOOLEAN) return TagType.BOOLEAN
  if (normalized === TagType.DATE) return TagType.DATE
  return TagType.STRING
}

function getEventPropertyDefinition(eventName?: string, propertyKey?: string): PropertyDefinitionDTO | undefined {
  if (!propertyKey) return undefined
  return getEventProperties(eventName).find((item) => item.propertyName === propertyKey)
}

function getEventPropertyType(eventName?: string, propertyKey?: string): TagType {
  return normalizePropertyType(getEventPropertyDefinition(eventName, propertyKey)?.propertyType)
}

function getAllowedFilterOperators(eventName?: string, propertyKey?: string): CompareOperator[] {
  if (!propertyKey) return Object.values(CompareOperator) as CompareOperator[]
  return CompareOperatorsByTagType[getEventPropertyType(eventName, propertyKey)] ?? Object.values(CompareOperator) as CompareOperator[]
}

// --- Tag-type-aware helpers ---
function getSelectedTagDef(tagKey?: string): TagDefinitionDTO | undefined {
  if (!tagKey) return undefined
  return tagOptions.value.find((t) => t.tagKey === tagKey)
}

function getAllowedOperators(tagKey?: string): CompareOperator[] {
  const def = getSelectedTagDef(tagKey)
  if (!def) return Object.values(CompareOperator) as CompareOperator[]
  return CompareOperatorsByTagType[def.tagType] ?? Object.values(CompareOperator) as CompareOperator[]
}

function onTagKeyChange(cond: SegmentConditionDTO) {
  const allowed = getAllowedOperators(cond.tagKey)
  if (cond.compareOp && !allowed.includes(cond.compareOp)) {
    cond.compareOp = allowed[0]
  }
  cond.values = ['']
}

function onCompareOpChange(cond: SegmentConditionDTO) {
  if (cond.compareOp === CompareOperator.BETWEEN) {
    cond.values = ['', '']
  } else if (cond.compareOp === CompareOperator.IN || cond.compareOp === CompareOperator.NOT_IN) {
    cond.values = []
  } else if (cond.compareOp === CompareOperator.IS_NULL || cond.compareOp === CompareOperator.IS_NOT_NULL) {
    cond.values = []
  } else {
    cond.values = ['']
  }
}

function onBehaviorEventChange(cond: SegmentConditionDTO) {
  cond.propertyFilters = []
}

function onPropertyKeyChange(eventName: string | undefined, pf: EventPropertyFilterDTO) {
  const allowed = getAllowedFilterOperators(eventName, pf.propertyKey)
  if (!allowed.includes(pf.compareOp)) {
    pf.compareOp = allowed[0]
  }
  onFilterOpChange(pf)
}

function onFilterOpChange(pf: EventPropertyFilterDTO) {
  if (pf.compareOp === CompareOperator.BETWEEN) {
    pf.values = ['', '']
  } else if (pf.compareOp === CompareOperator.IN || pf.compareOp === CompareOperator.NOT_IN) {
    pf.values = []
  } else if (pf.compareOp === CompareOperator.IS_NULL || pf.compareOp === CompareOperator.IS_NOT_NULL) {
    pf.values = []
  } else {
    pf.values = ['']
  }
}

// --- Time range helpers ---
const timeRangeShortcuts = [
  { text: '最近 7 天', value: () => { const end = new Date(); const start = new Date(); start.setDate(start.getDate() - 7); return [start, end] } },
  { text: '最近 30 天', value: () => { const end = new Date(); const start = new Date(); start.setDate(start.getDate() - 30); return [start, end] } },
  { text: '最近 90 天', value: () => { const end = new Date(); const start = new Date(); start.setDate(start.getDate() - 90); return [start, end] } },
]

function syncTimeRange(cond: any) {
  if (cond._timeRange && cond._timeRange.length === 2) {
    cond.timeRangeStart = cond._timeRange[0]
    cond.timeRangeEnd = cond._timeRange[1]
  } else {
    cond.timeRangeStart = ''
    cond.timeRangeEnd = ''
  }
}

// --- Copy helpers ---
function copyTagCondition(gi: number, ci: number) {
  const src = tagGroups.value[gi].conditions[ci]
  tagGroups.value[gi].conditions.splice(ci + 1, 0, JSON.parse(JSON.stringify(src)))
}
function copyTagGroup(gi: number) {
  const src = tagGroups.value[gi]
  const copy = JSON.parse(JSON.stringify(src))
  tagGroups.value.splice(gi + 1, 0, copy)
}
function copyBehaviorCondition(gi: number, ci: number) {
  const src = behaviorGroups.value[gi].conditions[ci]
  behaviorGroups.value[gi].conditions.splice(ci + 1, 0, JSON.parse(JSON.stringify(src)))
}
function copyBehaviorGroup(gi: number) {
  const src = behaviorGroups.value[gi]
  const copy = JSON.parse(JSON.stringify(src))
  behaviorGroups.value.splice(gi + 1, 0, copy)
}

// --- Validation ---
function isEmptyValue(value: unknown) {
  return value == null || value === ''
}

function isOrderedRange(start: unknown, end: unknown) {
  if (isEmptyValue(start) || isEmptyValue(end)) return true
  const startDate = new Date(String(start))
  const endDate = new Date(String(end))
  if (!Number.isNaN(startDate.getTime()) && !Number.isNaN(endDate.getTime())) {
    return startDate.getTime() <= endDate.getTime()
  }
  const startNum = Number(start)
  const endNum = Number(end)
  if (!Number.isNaN(startNum) && !Number.isNaN(endNum)) {
    return startNum <= endNum
  }
  return String(start) <= String(end)
}

function validateConditions(): string | null {
  if (tagGroups.value.length === 0 && behaviorGroups.value.length === 0) return '请至少添加 1 条标签规则或行为规则'
  for (let gi = 0; gi < tagGroups.value.length; gi++) {
    for (let ci = 0; ci < tagGroups.value[gi].conditions.length; ci++) {
      const c = tagGroups.value[gi].conditions[ci]
      if (!c.tagKey) return `标签条件 规则组${gi + 1}-条件${ci + 1}：请选择标签`
      if (!c.compareOp) return `标签条件 规则组${gi + 1}-条件${ci + 1}：请选择操作符`
      if (needsValues(c.compareOp)) {
        if (c.compareOp === CompareOperator.BETWEEN) {
          if (!c.values || c.values.length < 2 || !c.values[0] || !c.values[1]) return `标签条件 规则组${gi + 1}-条件${ci + 1}：BETWEEN 需要填写两个值`
          if (!isOrderedRange(c.values[0], c.values[1])) return `标签条件 规则组${gi + 1}-条件${ci + 1}：区间起始值不能大于结束值`
        } else if (c.compareOp === CompareOperator.IN || c.compareOp === CompareOperator.NOT_IN) {
          if (!c.values || c.values.length === 0) return `标签条件 规则组${gi + 1}-条件${ci + 1}：请至少填写一个值`
        } else {
          if (!c.values || !c.values[0]) return `标签条件 规则组${gi + 1}-条件${ci + 1}：请填写值`
        }
      }
    }
  }
  for (let gi = 0; gi < behaviorGroups.value.length; gi++) {
    for (let ci = 0; ci < behaviorGroups.value[gi].conditions.length; ci++) {
      const c = behaviorGroups.value[gi].conditions[ci]
      if (!c.eventName) return `行为条件 规则组${gi + 1}-条件${ci + 1}：请选择事件`
      if (!c.timeRangeStart || !c.timeRangeEnd) return `行为条件 规则组${gi + 1}-条件${ci + 1}：请选择时间范围`
      if (!isOrderedRange(c.timeRangeStart, c.timeRangeEnd)) return `行为条件 规则组${gi + 1}-条件${ci + 1}：开始时间不能晚于结束时间`
      if (!c.countOp) return `行为条件 规则组${gi + 1}-条件${ci + 1}：请选择次数比较方式`
      if (c.countValue == null || c.countValue < 0) return `行为条件 规则组${gi + 1}-条件${ci + 1}：请填写次数`
      if (c.propertyFilters) {
        for (let pi = 0; pi < c.propertyFilters.length; pi++) {
          const pf = c.propertyFilters[pi]
          if (!pf.propertyKey) return `行为条件 规则组${gi + 1}-条件${ci + 1}-属性${pi + 1}：请选择属性`
          if (!pf.compareOp) return `行为条件 规则组${gi + 1}-条件${ci + 1}-属性${pi + 1}：请选择比较方式`
          if (needsValues(pf.compareOp)) {
            if (pf.compareOp === CompareOperator.BETWEEN) {
              if (!pf.values || pf.values.length < 2 || !pf.values[0] || !pf.values[1]) return `行为条件 规则组${gi + 1}-条件${ci + 1}-属性${pi + 1}：BETWEEN 需要两个值`
              if (!isOrderedRange(pf.values[0], pf.values[1])) return `行为条件 规则组${gi + 1}-条件${ci + 1}-属性${pi + 1}：区间起始值不能大于结束值`
            } else if (pf.compareOp === CompareOperator.IN || pf.compareOp === CompareOperator.NOT_IN) {
              if (!pf.values || pf.values.length === 0) return `行为条件 规则组${gi + 1}-条件${ci + 1}-属性${pi + 1}：请至少填写一个值`
            } else {
              if (!pf.values || !pf.values[0]) return `行为条件 规则组${gi + 1}-条件${ci + 1}-属性${pi + 1}：请填写值`
            }
          }
        }
      }
    }
  }
  return null
}

// --- Condition counts ---
const tagConditionCount = computed(() => tagGroups.value.reduce((sum, g) => sum + g.conditions.length, 0))
const behaviorConditionCount = computed(() => behaviorGroups.value.reduce((sum, g) => sum + g.conditions.length, 0))
const conditionValidationMessage = computed(() => validateConditions())
const submitDisabled = computed(() => !form.segmentName.trim() || !!conditionValidationMessage.value)
const previewDisabled = computed(() => !!conditionValidationMessage.value)

// --- Condition summary ---
function getTagDisplayName(tagKey?: string) {
  const def = getSelectedTagDef(tagKey)
  return def ? def.tagName : (tagKey || '未选择标签')
}

function getEventDisplayName(eventName?: string) {
  const def = eventOptions.value.find((item) => item.eventName === eventName)
  return def ? def.displayName : (eventName || '未选择事件')
}

function getPropertyDisplayName(eventName?: string, propertyKey?: string) {
  if (!propertyKey) return '未选择属性'
  const property = getEventProperties(eventName).find((item) => item.propertyName === propertyKey)
  return property?.displayName || propertyKey
}

function formatValueList(values?: Array<string | number>) {
  const list = (values ?? []).filter((item) => !isEmptyValue(item)).map((item) => String(item))
  return list.length > 0 ? list.join('、') : '未填写值'
}

function formatCompareExpression(compareOp?: CompareOperator, values?: Array<string | number>) {
  if (!compareOp) return '未选择比较方式'
  if (compareOp === CompareOperator.IS_NULL || compareOp === CompareOperator.IS_NOT_NULL) return CompareOperatorLabels[compareOp]
  if (compareOp === CompareOperator.BETWEEN) {
    const [start = '未填写起始值', end = '未填写结束值'] = values ?? []
    return `介于 ${start} 到 ${end} 之间`
  }
  if (compareOp === CompareOperator.IN || compareOp === CompareOperator.NOT_IN) {
    return `${CompareOperatorLabels[compareOp]} ${formatValueList(values)}`
  }
  return `${CompareOperatorLabels[compareOp]} ${formatValueList(values?.slice(0, 1))}`
}

function describeTagCondition(cond: SegmentConditionDTO) {
  return `${getTagDisplayName(cond.tagKey)} ${formatCompareExpression(cond.compareOp, cond.values)}`
}

function describePropertyFilter(eventName: string | undefined, filter: EventPropertyFilterDTO) {
  return `${getPropertyDisplayName(eventName, filter.propertyKey)} ${formatCompareExpression(filter.compareOp, filter.values)}`
}

function describeBehaviorCondition(cond: SegmentConditionDTO) {
  const parts = [
    `${BehaviorOperatorLabels[cond.behaviorOp || BehaviorOperator.DID]}「${getEventDisplayName(cond.eventName)}」`,
    `时间范围 ${cond.timeRangeStart || '未填写开始时间'} 至 ${cond.timeRangeEnd || '未填写结束时间'}`,
    `次数 ${formatCompareExpression(cond.countOp, [cond.countValue ?? '未填写'])} 次`,
  ]
  if (cond.propertyFilters && cond.propertyFilters.length > 0) {
    parts.push(`事件属性满足：${cond.propertyFilters.map((filter) => describePropertyFilter(cond.eventName, filter)).join('；')}`)
  }
  return parts.join('，')
}

function describeGroup(title: string, group: TagRuleGroup | BehaviorRuleGroup, renderCondition: (cond: SegmentConditionDTO) => string) {
  if (group.conditions.length === 1) return `${title}：${renderCondition(group.conditions[0])}`
  return `${title}：${getLogicModeLabel(group.intraOp)}以下条件：${group.conditions.map((cond) => renderCondition(cond)).join('；')}`
}

const conditionSummaryLines = computed(() => {
  const lines: string[] = []
  if (tagGroups.value.length === 0 && behaviorGroups.value.length === 0) return lines

  if (tagGroups.value.length > 0 && behaviorGroups.value.length > 0) {
    lines.push(rootOperator.value === ConditionOperator.AND
      ? '命中用户需要同时满足“用户属性条件”和“用户行为条件”。'
      : '命中用户满足“用户属性条件”或“用户行为条件”任一即可。')
  } else if (tagGroups.value.length > 0) {
    lines.push('命中用户需要满足以下用户属性条件。')
  } else {
    lines.push('命中用户需要满足以下用户行为条件。')
  }

  if (tagGroups.value.length > 0) {
    if (tagGroups.value.length > 1) {
      lines.push(`用户属性规则组之间：${getLogicHint(tagGroupsOp.value, '多个规则组') }。`)
    }
    tagGroups.value.forEach((group, index) => {
      lines.push(describeGroup(`用户属性规则组 ${index + 1}`, group, describeTagCondition))
    })
  }

  if (behaviorGroups.value.length > 0) {
    if (behaviorGroups.value.length > 1) {
      lines.push(`用户行为规则组之间：${getLogicHint(behaviorGroupsOp.value, '多个规则组') }。`)
    }
    behaviorGroups.value.forEach((group, index) => {
      lines.push(describeGroup(`用户行为规则组 ${index + 1}`, group, describeBehaviorCondition))
    })
  }

  return lines
})

onMounted(fetchData)
</script>

<template>
  <div class="page-card">
    <!-- Toolbar -->
    <div class="table-toolbar">
      <div class="table-toolbar__left">
        <el-button :icon="Refresh" @click="fetchData">刷新</el-button>
      </div>
      <div class="table-toolbar__right">
        <el-button type="primary" :icon="Plus" @click="openCreateDialog">新建分层</el-button>
      </div>
    </div>

    <!-- Table -->
    <el-table v-loading="loading" :data="tableData" stripe highlight-current-row style="width: 100%">
      <el-table-column prop="segmentName" label="分层名称" min-width="160" show-overflow-tooltip />
      <el-table-column prop="description" label="描述" min-width="180" show-overflow-tooltip />
      <el-table-column prop="status" label="状态" width="80" align="center">
        <template #default="{ row }">
          <el-tag :type="getStatusType(row.status)" size="small">{{ getStatusText(row.status) }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="lastUserCount" label="用户数" width="100" align="right">
        <template #default="{ row }">{{ row.lastUserCount ?? '-' }}</template>
      </el-table-column>
      <el-table-column prop="lastComputedTime" label="最近计算时间" width="170" />
      <el-table-column prop="createdTime" label="创建时间" width="170" />
      <el-table-column label="操作" width="260" fixed="right">
        <template #default="{ row }">
          <el-button type="primary" link size="small" @click="openEditDialog(row)">编辑</el-button>
          <el-button type="primary" link size="small" @click="handleCompute(row)">计算</el-button>
          <el-button type="primary" link size="small" @click="openUsersDialog(row)">用户列表</el-button>
          <el-button type="danger" link size="small" @click="handleDelete(row)">删除</el-button>
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
    <el-dialog v-model="dialogVisible" :title="dialogTitle" width="900px" destroy-on-close>
      <el-form label-width="100px">
        <el-form-item label="分层名称" required>
          <el-input v-model="form.segmentName" placeholder="如 高价值用户" maxlength="128" show-word-limit />
        </el-form-item>
        <el-form-item label="描述">
          <el-input v-model="form.description" type="textarea" :rows="2" placeholder="分层描述" maxlength="512" />
        </el-form-item>

        <el-form-item label="快速开始">
          <div class="quick-start">
            <button
              v-for="template in starterTemplates"
              :key="template.key"
              type="button"
              class="quick-start__card"
              :class="{ 'quick-start__card--active': selectedTemplateKey === template.key }"
              @click="handleQuickStartClick(template)"
            >
              <span class="quick-start__badge">基础骨架</span>
              <span class="quick-start__title">{{ template.title }}</span>
              <span class="quick-start__desc">{{ template.description }}</span>
            </button>
            <button
              v-for="template in serverTemplates"
              :key="template.templateKey"
              type="button"
              class="quick-start__card"
              :class="{ 'quick-start__card--active': selectedTemplateKey === template.templateKey }"
              @click="handleQuickStartClick(template)"
            >
              <span class="quick-start__badge quick-start__badge--template">业务模板</span>
              <span class="quick-start__title">{{ template.title }}</span>
              <span class="quick-start__desc">{{ template.description }}</span>
            </button>
          </div>
        </el-form-item>

        <el-form-item v-if="selectedServerTemplate" label="模板参数">
          <div class="template-config">
            <div class="template-config__header">
              <div class="template-config__intro">
                <div class="template-config__title">{{ selectedServerTemplate.title }}</div>
                <div class="template-config__desc">{{ selectedServerTemplate.description }}</div>
              </div>
              <div class="template-config__actions">
                <el-button size="small" @click="slotParams = selectedServerTemplate.slots.map(s => ({ days: s.defaultDays, count: s.defaultCount }))">恢复默认</el-button>
                <el-button size="small" type="primary" @click="applySelectedTemplate">应用模板</el-button>
              </div>
            </div>

            <div class="template-config__grid">
              <div
                v-for="(slot, idx) in selectedServerTemplate.slots"
                :key="idx"
                class="template-config__block"
              >
                <div class="template-config__block-title">{{ slot.label }}</div>
                <div class="template-config__row">
                  <span class="template-config__label">时间窗口</span>
                  <el-input-number v-model="slotParams[idx].days" :min="1" :max="365" controls-position="right" style="width: 120px" />
                  <span class="template-config__suffix">天内</span>
                </div>
                <div class="template-config__row">
                  <span class="template-config__label">次数要求</span>
                  <el-input-number v-model="slotParams[idx].count" :min="1" :max="9999" controls-position="right" style="width: 120px" />
                  <span class="template-config__suffix">次及以上</span>
                </div>
                <div class="template-config__match">
                  事件类型 [{{ slot.eventTypes.join('/') }}]：
                  <strong>{{ eventOptions.find(e => slot.eventTypes.includes(e.eventType))?.displayName || '未自动匹配，请应用后手动选择' }}</strong>
                </div>
              </div>
            </div>
          </div>
        </el-form-item>

        <!-- ========== Condition Builder with Connector ========== -->
        <el-form-item label="条件规则">
          <div class="condition-layout">
            <!-- ===== Tag Section ===== -->
            <div class="condition-section condition-section--tag">
              <div class="condition-section__header">
                <div class="condition-section__heading">
                  <span class="condition-section__title">
                    <el-tag effect="dark" size="small">标签</el-tag>
                    用户属性筛选
                    <el-tag v-if="tagConditionCount > 0" size="small" round>{{ tagConditionCount }}</el-tag>
                  </span>
                  <span class="condition-section__hint">适合筛选用户等级、会员状态、最近活跃日期等静态或半静态属性。</span>
                </div>
                <el-button size="small" @click="addTagGroup">+ 添加规则组</el-button>
              </div>
              <div class="condition-section__body">
                <div v-if="tagGroups.length > 1" class="relation-panel relation-panel--tag">
                  <span class="relation-panel__label">多个属性规则组之间</span>
                  <el-radio-group v-model="tagGroupsOp" size="small">
                    <el-radio-button :label="ConditionOperator.AND">同时满足</el-radio-button>
                    <el-radio-button :label="ConditionOperator.OR">满足任一</el-radio-button>
                  </el-radio-group>
                  <span class="relation-panel__hint">{{ getLogicHint(tagGroupsOp, '多个属性规则组') }}</span>
                </div>
                <template v-for="(group, gi) in tagGroups" :key="gi">
                  <div v-if="gi > 0" class="condition-separator condition-separator--tag">{{ getJoinText(tagGroupsOp) }}</div>
                  <!-- Rule group card -->
                  <div class="rule-group rule-group--tag">
                    <div class="rule-group__header">
                      <div class="rule-group__heading">
                        <span class="rule-group__label">属性规则组 {{ gi + 1 }}</span>
                        <span class="rule-group__hint">同一规则组内用于表达一组强相关条件。</span>
                      </div>
                      <div class="rule-group__actions">
                        <el-radio-group v-if="group.conditions.length > 1" v-model="group.intraOp" size="small">
                          <el-radio-button :label="ConditionOperator.AND">同时满足</el-radio-button>
                          <el-radio-button :label="ConditionOperator.OR">满足任一</el-radio-button>
                        </el-radio-group>
                        <el-button size="small" link @click="addTagToGroup(gi)">+ 条件</el-button>
                        <el-button size="small" link :icon="CopyDocument" @click="copyTagGroup(gi)" />
                        <el-button size="small" link type="danger" :icon="Delete" @click="removeTagGroup(gi)" />
                      </div>
                    </div>
                    <div class="rule-group__body">
                      <template v-for="(cond, ci) in group.conditions" :key="ci">
                        <div v-if="ci > 0" class="condition-separator condition-separator--subtle">{{ getJoinText(group.intraOp) }}</div>
                        <div class="tag-row">
                          <el-select v-model="cond.tagKey" placeholder="选择标签" filterable style="width: 220px" @change="onTagKeyChange(cond)">
                            <el-option v-for="tag in tagOptions" :key="tag.tagKey" :label="`${tag.tagName} (${tag.tagKey}) [${TagTypeLabels[tag.tagType]}]`" :value="tag.tagKey" />
                          </el-select>
                          <el-select v-model="cond.compareOp" placeholder="操作符" style="width: 130px" @change="onCompareOpChange(cond)">
                            <el-option v-for="op in getAllowedOperators(cond.tagKey)" :key="op" :label="CompareOperatorLabels[op]" :value="op" />
                          </el-select>
                          <!-- Type-aware value input -->
                          <template v-if="needsValues(cond.compareOp)">
                            <!-- BOOLEAN -->
                            <el-select v-if="getSelectedTagDef(cond.tagKey)?.tagType === TagType.BOOLEAN" v-model="cond.values![0]" placeholder="选择值" style="width: 120px">
                              <el-option label="true" value="true" />
                              <el-option label="false" value="false" />
                            </el-select>
                            <!-- ENUM + EQ/NE → single select -->
                            <el-select v-else-if="getSelectedTagDef(cond.tagKey)?.tagType === TagType.ENUM && (cond.compareOp === CompareOperator.EQ || cond.compareOp === CompareOperator.NE)" v-model="cond.values![0]" placeholder="选择枚举值" filterable style="width: 200px">
                              <el-option v-for="ev in getSelectedTagDef(cond.tagKey)?.enumValues ?? []" :key="ev" :label="ev" :value="ev" />
                            </el-select>
                            <!-- ENUM + IN/NOT_IN → multi select -->
                            <el-select v-else-if="getSelectedTagDef(cond.tagKey)?.tagType === TagType.ENUM && (cond.compareOp === CompareOperator.IN || cond.compareOp === CompareOperator.NOT_IN)" v-model="cond.values" multiple placeholder="选择枚举值" filterable style="width: 260px">
                              <el-option v-for="ev in getSelectedTagDef(cond.tagKey)?.enumValues ?? []" :key="ev" :label="ev" :value="ev" />
                            </el-select>
                            <!-- BETWEEN -->
                            <template v-else-if="cond.compareOp === CompareOperator.BETWEEN">
                              <el-date-picker v-if="getSelectedTagDef(cond.tagKey)?.tagType === TagType.DATE" v-model="cond.values![0]" type="date" value-format="YYYY-MM-DD" placeholder="起始" style="width: 150px" />
                              <el-input-number v-else-if="getSelectedTagDef(cond.tagKey)?.tagType === TagType.LONG" v-model="cond.values![0]" :precision="0" controls-position="right" placeholder="最小值" style="width: 140px" />
                              <el-input-number v-else-if="getSelectedTagDef(cond.tagKey)?.tagType === TagType.DOUBLE" v-model="cond.values![0]" controls-position="right" placeholder="最小值" style="width: 140px" />
                              <el-input v-else v-model="cond.values![0]" placeholder="最小值" style="width: 120px" />
                              <span>~</span>
                              <el-date-picker v-if="getSelectedTagDef(cond.tagKey)?.tagType === TagType.DATE" v-model="cond.values![1]" type="date" value-format="YYYY-MM-DD" placeholder="结束" style="width: 150px" />
                              <el-input-number v-else-if="getSelectedTagDef(cond.tagKey)?.tagType === TagType.LONG" v-model="cond.values![1]" :precision="0" controls-position="right" placeholder="最大值" style="width: 140px" />
                              <el-input-number v-else-if="getSelectedTagDef(cond.tagKey)?.tagType === TagType.DOUBLE" v-model="cond.values![1]" controls-position="right" placeholder="最大值" style="width: 140px" />
                              <el-input v-else v-model="cond.values![1]" placeholder="最大值" style="width: 120px" />
                            </template>
                            <!-- DATE (non-BETWEEN) -->
                            <el-date-picker v-else-if="getSelectedTagDef(cond.tagKey)?.tagType === TagType.DATE" v-model="cond.values![0]" type="date" value-format="YYYY-MM-DD" placeholder="选择日期" style="width: 180px" />
                            <!-- LONG (non-BETWEEN) -->
                            <el-input-number v-else-if="getSelectedTagDef(cond.tagKey)?.tagType === TagType.LONG && cond.compareOp !== CompareOperator.IN && cond.compareOp !== CompareOperator.NOT_IN" v-model="cond.values![0]" :precision="0" controls-position="right" placeholder="整数值" style="width: 160px" />
                            <!-- DOUBLE (non-BETWEEN) -->
                            <el-input-number v-else-if="getSelectedTagDef(cond.tagKey)?.tagType === TagType.DOUBLE && cond.compareOp !== CompareOperator.IN && cond.compareOp !== CompareOperator.NOT_IN" v-model="cond.values![0]" controls-position="right" placeholder="数值" style="width: 160px" />
                            <!-- IN/NOT_IN (non-ENUM) → multi-select allow-create -->
                            <el-select v-else-if="cond.compareOp === CompareOperator.IN || cond.compareOp === CompareOperator.NOT_IN" v-model="cond.values" multiple filterable allow-create default-first-option placeholder="回车添加多个值" style="width: 260px" />
                            <!-- STRING default -->
                            <el-input v-else v-model="cond.values![0]" placeholder="值" style="width: 200px" />
                          </template>
                          <el-button :icon="CopyDocument" link @click="copyTagCondition(gi, ci)" />
                          <el-button :icon="Delete" type="danger" link @click="removeTagFromGroup(gi, ci)" />
                        </div>
                      </template>
                    </div>
                  </div>
                </template>
                <div v-if="tagGroups.length === 0" class="condition-section__empty">
                  <el-button link type="primary" @click="addTagGroup">+ 添加标签规则组</el-button>
                </div>
              </div>
            </div>

            <!-- ===== Root Connector (vertical) ===== -->
            <div v-if="tagGroups.length > 0 && behaviorGroups.length > 0" class="root-connector">
              <div class="relation-panel relation-panel--root">
                <span class="relation-panel__label">属性条件 与 行为条件之间</span>
                <el-radio-group v-model="rootOperator" size="small">
                  <el-radio-button :label="ConditionOperator.AND">同时满足</el-radio-button>
                  <el-radio-button :label="ConditionOperator.OR">满足任一</el-radio-button>
                </el-radio-group>
                <span class="relation-panel__hint">{{ rootOperator === ConditionOperator.AND ? '用户必须同时命中属性条件和行为条件' : '用户命中属性条件或行为条件中的任意一类即可' }}</span>
              </div>
            </div>

            <!-- ===== Behavior Section ===== -->
            <div class="condition-section condition-section--behavior">
              <div class="condition-section__header">
                <div class="condition-section__heading">
                  <span class="condition-section__title">
                    <el-tag type="warning" effect="dark" size="small">行为</el-tag>
                    用户行为筛选
                    <el-tag v-if="behaviorConditionCount > 0" type="warning" size="small" round>{{ behaviorConditionCount }}</el-tag>
                  </span>
                  <span class="condition-section__hint">适合筛选最近一段时间内做过什么、做了几次，以及事件属性条件。</span>
                </div>
                <el-button size="small" type="warning" plain @click="addBehaviorGroup">+ 添加规则组</el-button>
              </div>
              <div class="condition-section__body">
                <div v-if="behaviorGroups.length > 1" class="relation-panel relation-panel--behavior">
                  <span class="relation-panel__label">多个行为规则组之间</span>
                  <el-radio-group v-model="behaviorGroupsOp" size="small">
                    <el-radio-button :label="ConditionOperator.AND">同时满足</el-radio-button>
                    <el-radio-button :label="ConditionOperator.OR">满足任一</el-radio-button>
                  </el-radio-group>
                  <span class="relation-panel__hint">{{ getLogicHint(behaviorGroupsOp, '多个行为规则组') }}</span>
                </div>
                <template v-for="(group, gi) in behaviorGroups" :key="gi">
                  <div v-if="gi > 0" class="condition-separator condition-separator--behavior">{{ getJoinText(behaviorGroupsOp) }}</div>
                  <!-- Rule group card -->
                  <div class="rule-group rule-group--behavior">
                    <div class="rule-group__header">
                      <div class="rule-group__heading">
                        <span class="rule-group__label">行为规则组 {{ gi + 1 }}</span>
                        <span class="rule-group__hint">同一规则组内通常用于表达连续行为要求或替代行为方案。</span>
                      </div>
                      <div class="rule-group__actions">
                        <el-radio-group v-if="group.conditions.length > 1" v-model="group.intraOp" size="small">
                          <el-radio-button :label="ConditionOperator.AND">同时满足</el-radio-button>
                          <el-radio-button :label="ConditionOperator.OR">满足任一</el-radio-button>
                        </el-radio-group>
                        <el-button size="small" link @click="addBehaviorToGroup(gi)">+ 条件</el-button>
                        <el-button size="small" link :icon="CopyDocument" @click="copyBehaviorGroup(gi)" />
                        <el-button size="small" link type="danger" :icon="Delete" @click="removeBehaviorGroup(gi)" />
                      </div>
                    </div>
                    <div class="rule-group__body">
                      <template v-for="(cond, ci) in group.conditions" :key="ci">
                        <div v-if="ci > 0" class="condition-separator condition-separator--subtle">{{ getJoinText(group.intraOp) }}</div>
                        <div class="behavior-card">
                          <div class="behavior-card__row">
                            <el-select v-model="cond.behaviorOp" style="width: 100px">
                              <el-option v-for="op in Object.values(BehaviorOperator)" :key="op" :label="BehaviorOperatorLabels[op]" :value="op" />
                            </el-select>
                            <el-select v-model="cond.eventName" placeholder="选择事件" filterable style="width: 200px" @change="onBehaviorEventChange(cond)">
                              <el-option v-for="ev in eventOptions" :key="ev.eventName" :label="`${ev.displayName} (${ev.eventName})`" :value="ev.eventName" />
                            </el-select>
                            <span class="behavior-card__label">时间范围</span>
                            <el-date-picker
                              v-model="(cond as any)._timeRange"
                              type="daterange"
                              value-format="YYYY-MM-DD"
                              range-separator="~"
                              start-placeholder="开始"
                              end-placeholder="结束"
                              :shortcuts="timeRangeShortcuts"
                              style="width: 280px"
                              @change="syncTimeRange(cond)"
                            />
                            <el-button :icon="CopyDocument" link @click="copyBehaviorCondition(gi, ci)" />
                            <el-button :icon="Delete" type="danger" link @click="removeBehaviorFromGroup(gi, ci)" />
                          </div>
                          <div v-if="cond.eventName" class="behavior-card__filters">
                            <div class="behavior-card__filter-title">事件属性过滤</div>
                            <div class="behavior-card__filter-hint">选择字段后，会自动限制可选操作和输入方式，减少类型配置错误。</div>
                            <div v-for="(pf, pi) in cond.propertyFilters" :key="pi" class="behavior-card__filter-row">
                              <el-select v-model="pf.propertyKey" placeholder="选择属性" filterable style="width: 150px" @change="onPropertyKeyChange(cond.eventName, pf)">
                                <el-option v-for="prop in getEventProperties(cond.eventName)" :key="prop.propertyName" :label="`${prop.displayName || prop.propertyName} (${prop.propertyType})`" :value="prop.propertyName" />
                              </el-select>
                              <el-select v-model="pf.compareOp" style="width: 110px" @change="onFilterOpChange(pf)">
                                <el-option v-for="op in getAllowedFilterOperators(cond.eventName, pf.propertyKey)" :key="op" :label="CompareOperatorLabels[op]" :value="op" />
                              </el-select>
                              <!-- Filter value: BETWEEN -->
                              <template v-if="needsValues(pf.compareOp)">
                                <template v-if="pf.compareOp === CompareOperator.BETWEEN">
                                  <el-date-picker v-if="getEventPropertyType(cond.eventName, pf.propertyKey) === TagType.DATE" v-model="pf.values[0]" type="date" value-format="YYYY-MM-DD" placeholder="起始" style="width: 140px" />
                                  <el-input-number v-else-if="getEventPropertyType(cond.eventName, pf.propertyKey) === TagType.LONG" v-model="pf.values[0]" :precision="0" controls-position="right" placeholder="最小值" style="width: 120px" />
                                  <el-input-number v-else-if="getEventPropertyType(cond.eventName, pf.propertyKey) === TagType.DOUBLE" v-model="pf.values[0]" controls-position="right" placeholder="最小值" style="width: 120px" />
                                  <el-input v-else v-model="pf.values[0]" placeholder="最小值" style="width: 100px" />
                                  <span>~</span>
                                  <el-date-picker v-if="getEventPropertyType(cond.eventName, pf.propertyKey) === TagType.DATE" v-model="pf.values[1]" type="date" value-format="YYYY-MM-DD" placeholder="结束" style="width: 140px" />
                                  <el-input-number v-else-if="getEventPropertyType(cond.eventName, pf.propertyKey) === TagType.LONG" v-model="pf.values[1]" :precision="0" controls-position="right" placeholder="最大值" style="width: 120px" />
                                  <el-input-number v-else-if="getEventPropertyType(cond.eventName, pf.propertyKey) === TagType.DOUBLE" v-model="pf.values[1]" controls-position="right" placeholder="最大值" style="width: 120px" />
                                  <el-input v-else v-model="pf.values[1]" placeholder="最大值" style="width: 100px" />
                                </template>
                                <!-- IN/NOT_IN -->
                                <el-select v-else-if="pf.compareOp === CompareOperator.IN || pf.compareOp === CompareOperator.NOT_IN" v-model="pf.values" multiple filterable allow-create default-first-option placeholder="回车添加" style="width: 200px" />
                                <el-select v-else-if="getEventPropertyType(cond.eventName, pf.propertyKey) === TagType.BOOLEAN" v-model="pf.values[0]" placeholder="选择值" style="width: 120px">
                                  <el-option label="true" value="true" />
                                  <el-option label="false" value="false" />
                                </el-select>
                                <el-date-picker v-else-if="getEventPropertyType(cond.eventName, pf.propertyKey) === TagType.DATE" v-model="pf.values[0]" type="date" value-format="YYYY-MM-DD" placeholder="选择日期" style="width: 160px" />
                                <el-input-number v-else-if="getEventPropertyType(cond.eventName, pf.propertyKey) === TagType.LONG" v-model="pf.values[0]" :precision="0" controls-position="right" placeholder="整数值" style="width: 120px" />
                                <el-input-number v-else-if="getEventPropertyType(cond.eventName, pf.propertyKey) === TagType.DOUBLE" v-model="pf.values[0]" controls-position="right" placeholder="数值" style="width: 120px" />
                                <!-- default -->
                                <el-input v-else v-model="pf.values[0]" placeholder="值" style="width: 160px" />
                              </template>
                              <el-button :icon="Delete" type="danger" link @click="removePropertyFilter(cond, pi)" />
                            </div>
                            <el-button type="primary" link size="small" @click="addPropertyFilter(cond)">+ 属性过滤</el-button>
                          </div>
                          <div class="behavior-card__count">
                            <span class="behavior-card__label">次数条件</span>
                            <el-select v-model="cond.countOp" style="width: 110px">
                              <el-option v-for="op in countOperators" :key="op" :label="CompareOperatorLabels[op]" :value="op" />
                            </el-select>
                            <el-input-number v-model="cond.countValue" :min="0" style="width: 100px" />
                            <span>次</span>
                          </div>
                        </div>
                      </template>
                    </div>
                  </div>
                </template>
                <div v-if="behaviorGroups.length === 0" class="condition-section__empty">
                  <el-button link type="warning" @click="addBehaviorGroup">+ 添加行为规则组</el-button>
                </div>
              </div>
            </div>
          </div>
        </el-form-item>

        <!-- Validation -->
        <el-form-item v-if="conditionValidationMessage">
          <div class="condition-validation">
            <span class="condition-validation__title">当前规则还不能保存或预览</span>
            <span>{{ conditionValidationMessage }}</span>
          </div>
        </el-form-item>

        <!-- Condition Summary -->
        <el-form-item v-if="conditionSummaryLines.length > 0">
          <div class="condition-summary">
            <el-icon><InfoFilled /></el-icon>
            <div class="condition-summary__content">
              <div class="condition-summary__title">系统将按以下方式理解当前规则</div>
              <div v-for="(line, index) in conditionSummaryLines" :key="index" class="condition-summary__line">
                {{ line }}
              </div>
            </div>
          </div>
        </el-form-item>

        <!-- Preview -->
        <el-form-item>
          <div class="condition-preview">
            <el-button type="primary" plain :loading="previewLoading" :disabled="previewDisabled" @click="handlePreview">预览人数</el-button>
            <span v-if="previewCount !== null" class="preview-result">
              预估命中用户：<strong>{{ previewCount }}</strong> 人
            </span>
          </div>
        </el-form-item>
      </el-form>

      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" :disabled="submitDisabled" @click="handleSubmit">确定</el-button>
      </template>
    </el-dialog>

    <!-- Users Dialog -->
    <el-dialog v-model="usersDialogVisible" :title="`用户列表 — ${usersSegmentName}`" width="500px">
      <el-table v-loading="usersLoading" :data="usersData.map((id) => ({ userId: id }))" stripe style="width: 100%">
        <el-table-column prop="userId" label="用户 ID" />
      </el-table>
      <div class="pagination-wrapper">
        <el-pagination
          v-model:current-page="usersParams.pageNum"
          :page-size="usersParams.pageSize"
          :total="usersTotal"
          layout="total, prev, pager, next"
          @current-change="handleUsersPageChange"
        />
      </div>
    </el-dialog>
  </div>
</template>

<style lang="scss" scoped>
.condition-layout {
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.quick-start {
  width: 100%;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 12px;

  &__card {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 6px;
    width: 100%;
    padding: 12px 14px;
    border: 1px solid #dcdfe6;
    border-radius: 8px;
    background: linear-gradient(180deg, #ffffff 0%, #f7f9fc 100%);
    text-align: left;
    cursor: pointer;
    transition: border-color 0.2s, box-shadow 0.2s, transform 0.2s;

    &:hover {
      border-color: #409eff;
      box-shadow: 0 6px 16px rgba(64, 158, 255, 0.12);
      transform: translateY(-1px);
    }

    &--active {
      border-color: #409eff;
      box-shadow: 0 6px 18px rgba(64, 158, 255, 0.16);
      background: linear-gradient(180deg, #ffffff 0%, #eef5ff 100%);
    }
  }

  &__title {
    font-size: 13px;
    font-weight: 600;
    color: #303133;
  }

  &__badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 2px 8px;
    border-radius: 999px;
    background: #ecf5ff;
    color: #409eff;
    font-size: 11px;
    font-weight: 600;

    &--template {
      background: #fdf6ec;
      color: #e6a23c;
    }
  }

  &__desc {
    font-size: 12px;
    line-height: 1.6;
    color: #606266;
  }
}

.template-config {
  width: 100%;
  padding: 14px;
  border-radius: 8px;
  border: 1px solid #d9ecff;
  background: linear-gradient(180deg, #ffffff 0%, #f5faff 100%);
  display: flex;
  flex-direction: column;
  gap: 14px;

  &__header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
    flex-wrap: wrap;
  }

  &__intro {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  &__title {
    font-size: 14px;
    font-weight: 600;
    color: #303133;
  }

  &__desc {
    font-size: 12px;
    line-height: 1.6;
    color: #606266;
  }

  &__actions {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }

  &__grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
    gap: 12px;
  }

  &__block {
    padding: 12px;
    border-radius: 8px;
    background: #fff;
    border: 1px solid #e4e7ed;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  &__block-title {
    font-size: 13px;
    font-weight: 600;
    color: #303133;
  }

  &__row {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }

  &__label {
    min-width: 60px;
    font-size: 12px;
    color: #606266;
  }

  &__suffix {
    font-size: 12px;
    color: #909399;
  }

  &__match {
    font-size: 12px;
    line-height: 1.6;
    color: #606266;

    strong {
      color: #303133;
    }
  }
}

.root-connector {
  width: 100%;
  padding: 12px 0;
}

.relation-panel {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
  width: 100%;
  padding: 10px 12px;
  border-radius: 8px;
  background: #f5f7fa;
  border: 1px solid #e4e7ed;

  &--tag {
    background: #f5faff;
    border-color: #d9ecff;
  }

  &--behavior {
    background: #fff9f0;
    border-color: #faecd8;
  }

  &--root {
    background: #f4f4f5;
  }

  &__label {
    font-size: 12px;
    font-weight: 600;
    color: #303133;
  }

  &__hint {
    font-size: 11px;
    color: #909399;
  }
}

.condition-separator {
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 8px 0;
  font-size: 12px;
  font-weight: 600;
  color: #606266;

  &--tag { color: #409eff; }
  &--behavior { color: #e6a23c; }
  &--subtle { color: #909399; margin: 6px 0; }
}

// ===== Section =====
.condition-section {
  width: 100%;
  border: 1px solid #dcdfe6;
  border-radius: 6px;
  overflow: hidden;

  &--tag {
    border-color: #409eff;
    .condition-section__header { background: #ecf5ff; }
  }
  &--behavior {
    border-color: #e6a23c;
    .condition-section__header { background: #fdf6ec; }
  }

  &__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 8px 12px;
  }

  &__heading {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  &__title {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;
    font-weight: 500;
    color: #303133;
  }

  &__hint {
    font-size: 12px;
    color: #909399;
    line-height: 1.5;
  }

  &__body {
    padding: 12px;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  &__empty {
    color: #909399;
    font-size: 13px;
    text-align: center;
    padding: 8px 0;
  }
}

// ===== Rule group card =====
.rule-group {
  border: 1px solid #e4e7ed;
  border-radius: 6px;
  overflow: hidden;

  &--tag {
    border-color: #b3d8ff;
    background: #f5faff;
  }
  &--behavior {
    border-color: #f3d19e;
    background: #fffbf0;
  }

  &__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    flex-wrap: wrap;
    padding: 6px 10px;
    background: rgba(0, 0, 0, 0.02);
    border-bottom: 1px solid #ebeef5;
  }

  &__heading {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  &__label {
    font-size: 12px;
    font-weight: 500;
    color: #606266;
  }

  &__hint {
    font-size: 11px;
    color: #909399;
  }

  &__actions {
    display: flex;
    align-items: center;
    gap: 4px;
    flex-wrap: wrap;
  }

  &__body {
    padding: 10px;
    display: flex;
    flex-direction: column;
    gap: 0;
  }
}

.tag-row {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  padding: 4px 0;
}

.behavior-card {
  border: 1px dashed #e6a23c;
  border-radius: 6px;
  padding: 10px;
  background: #fffdf5;
  display: flex;
  flex-direction: column;
  gap: 8px;

  &__row { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
  &__label { font-size: 12px; color: #909399; white-space: nowrap; }
  &__filters { padding-left: 12px; border-left: 3px solid #e6a23c; }
  &__filter-title { font-size: 12px; color: #909399; margin-bottom: 6px; }
  &__filter-hint { font-size: 11px; color: #b88230; margin-bottom: 8px; line-height: 1.5; }
  &__filter-row { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }
  &__count { display: flex; align-items: center; gap: 8px; }
}

.condition-preview {
  display: flex;
  align-items: center;
  gap: 12px;

  .preview-result {
    color: #606266;
    font-size: 14px;
    strong { color: #409eff; }
  }
}

.condition-summary {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 10px 14px;
  background: #f4f4f5;
  border-radius: 6px;
  font-size: 13px;
  color: #606266;
  line-height: 1.6;
  width: 100%;

  .el-icon { color: #909399; margin-top: 2px; flex-shrink: 0; }

  &__content {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  &__title {
    font-weight: 600;
    color: #303133;
  }
}

.condition-validation {
  display: flex;
  flex-direction: column;
  gap: 4px;
  width: 100%;
  padding: 10px 14px;
  border-radius: 6px;
  border: 1px solid #fde2e2;
  background: #fef0f0;
  color: #c45656;
  font-size: 13px;
  line-height: 1.6;

  &__title {
    font-weight: 600;
  }
}
</style>
