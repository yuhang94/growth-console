<script setup lang="ts">
import { computed } from 'vue'
import {
  AttributeSource,
  AttributeSourceLabels,
  CampaignCompareOperator,
  CampaignCompareOperatorLabels,
  type PropertyDefinitionDTO,
  type RuleConditionDTO,
  type TagDefinitionDTO,
} from '@/types/api'

const props = defineProps<{
  condition: RuleConditionDTO
  /** 是否为根节点（根节点不显示"删除分组"按钮，由父组件控制） */
  isRoot?: boolean
  /** 当前触发事件的属性定义列表，用于属性键下拉选择 */
  eventProperties?: PropertyDefinitionDTO[]
  /** 用户属性定义列表，用于用户属性下拉选择 */
  userProfileAttributes?: TagDefinitionDTO[]
}>()

const emit = defineEmits<{
  remove: []
}>()

// 叶子节点：attributeKey 字段存在（即使为空字符串）；分组节点：无 attributeKey 字段
const isLeaf = computed(() => props.condition.attributeKey !== undefined && props.condition.attributeKey !== null)

const isMultiValue = computed(() =>
  props.condition.operator === CampaignCompareOperator.IN ||
  props.condition.operator === CampaignCompareOperator.NOT_IN,
)

const availableSources = [AttributeSource.EVENT, AttributeSource.USER_PROFILE]

const attributeOptions = computed(() => {
  if (props.condition.source === AttributeSource.EVENT) {
    return (props.eventProperties ?? []).map((item) => ({
      key: item.propertyName,
      label: `${item.displayName || item.propertyName} (${item.propertyName})`,
      type: item.propertyType,
    }))
  }

  return (props.userProfileAttributes ?? []).map((item) => ({
    key: item.tagKey,
    label: `${item.tagName || item.tagKey} (${item.tagKey})`,
    type: item.tagType,
  }))
})

const attributePlaceholder = computed(() => {
  if (attributeOptions.value.length) return '选择属性键'
  if (props.condition.source === AttributeSource.EVENT) return '当前事件无属性键'
  return '暂无用户属性'
})

function createLeaf(): RuleConditionDTO {
  return { source: AttributeSource.EVENT, attributeKey: '', operator: CampaignCompareOperator.EQ, value: '' }
}

function createGroup(): RuleConditionDTO {
  return { relation: 'AND', children: [createLeaf()] }
}

function addLeaf() {
  if (!props.condition.children) props.condition.children = []
  props.condition.children.push(createLeaf())
}

function addGroup() {
  if (!props.condition.children) props.condition.children = []
  props.condition.children.push(createGroup())
}

function removeChild(index: number) {
  props.condition.children?.splice(index, 1)
}

function onSourceChange() {
  props.condition.attributeKey = ''
}

function onOperatorChange() {
  // 切换到多值算子时清空单值，反之亦然
  if (isMultiValue.value) {
    props.condition.value = undefined
    if (!props.condition.values) props.condition.values = []
  } else {
    props.condition.values = undefined
    if (props.condition.value === undefined) props.condition.value = ''
  }
}
</script>

<template>
  <!-- 叶子节点 -->
  <div v-if="isLeaf" class="rule-leaf">
    <el-select
      v-model="condition.source"
      size="small"
      style="width: 110px; flex-shrink: 0"
      placeholder="来源"
      @change="onSourceChange"
    >
      <el-option
        v-for="src in availableSources"
        :key="src"
        :label="AttributeSourceLabels[src]"
        :value="src"
      />
    </el-select>

    <el-select
      v-model="condition.attributeKey"
      filterable
      default-first-option
      size="small"
      style="width: 220px; flex-shrink: 0"
      :disabled="!attributeOptions.length"
      :placeholder="attributePlaceholder"
    >
      <el-option
        v-for="item in attributeOptions"
        :key="item.key"
        :label="item.type ? `${item.label} [${item.type}]` : item.label"
        :value="item.key"
      />
    </el-select>

    <el-select
      v-model="condition.operator"
      size="small"
      style="width: 110px; flex-shrink: 0"
      placeholder="算子"
      @change="onOperatorChange"
    >
      <el-option
        v-for="op in Object.values(CampaignCompareOperator)"
        :key="op"
        :label="CampaignCompareOperatorLabels[op]"
        :value="op"
      />
    </el-select>

    <!-- 多值输入（IN / NOT_IN） -->
    <el-select
      v-if="isMultiValue"
      v-model="condition.values"
      multiple
      filterable
      allow-create
      default-first-option
      size="small"
      style="min-width: 180px; flex: 1"
      placeholder="输入后回车添加多个值"
    />
    <!-- 单值输入 -->
    <el-input
      v-else
      v-model="condition.value"
      size="small"
      style="flex: 1; min-width: 120px"
      placeholder="值"
    />

    <el-button link type="danger" size="small" style="flex-shrink: 0" @click="emit('remove')">
      ×
    </el-button>
  </div>

  <!-- 分组节点 -->
  <div v-else class="rule-group">
    <div class="rule-group__header">
      <el-radio-group v-model="condition.relation" size="small">
        <el-radio-button value="AND">且(AND)</el-radio-button>
        <el-radio-button value="OR">或(OR)</el-radio-button>
      </el-radio-group>
      <el-button v-if="!isRoot" link type="danger" size="small" @click="emit('remove')">
        删除分组
      </el-button>
    </div>

    <div class="rule-group__children">
      <RuleConditionBuilder
        v-for="(child, idx) in condition.children"
        :key="idx"
        :condition="child"
        :event-properties="eventProperties"
        :user-profile-attributes="userProfileAttributes"
        @remove="removeChild(idx)"
      />
    </div>

    <div class="rule-group__actions">
      <el-button size="small" link type="primary" @click="addLeaf">+ 添加条件</el-button>
      <el-button size="small" link @click="addGroup">+ 添加分组</el-button>
    </div>
  </div>
</template>

<style scoped>
.rule-leaf {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 8px;
  flex-wrap: wrap;
}

.rule-group {
  border: 1px solid var(--el-border-color);
  border-radius: 6px;
  padding: 10px 12px;
  margin-bottom: 8px;
  background: var(--el-fill-color-extra-light);
}

.rule-group__header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 10px;
}

.rule-group__children {
  padding-left: 12px;
  border-left: 2px solid var(--el-border-color-light);
  margin-bottom: 8px;
}

.rule-group__actions {
  display: flex;
  gap: 8px;
}
</style>
