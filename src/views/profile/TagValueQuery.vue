<script setup lang="ts">
import { ref, reactive, computed, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Search, Plus, Delete } from '@element-plus/icons-vue'
import { getUserTags, getTagValue, writeTagValue, deleteTagValue } from '@/api/tagValue'
import { pageTagDefinitions } from '@/api/tagDefinition'
import { TagType } from '@/types/api'
import type { TagDefinitionDTO, TagValueWriteRequest } from '@/types/api'

// --- Search ---
const searchUserId = ref('')
const searchTagKey = ref('')
const loading = ref(false)

interface TagValueRow {
  tagKey: string
  tagValue: string
}

const userTagRows = ref<TagValueRow[]>([])
const currentUserId = ref('')

async function handleSearchUser() {
  const uid = searchUserId.value.trim()
  if (!uid) {
    ElMessage.warning('请输入用户 ID')
    return
  }

  loading.value = true
  currentUserId.value = uid
  try {
    if (searchTagKey.value.trim()) {
      // Exact query
      const result = await getTagValue(uid, searchTagKey.value.trim())
      userTagRows.value = result ? [{ tagKey: result.tagKey, tagValue: result.tagValue }] : []
    } else {
      // All tags for user
      const result = await getUserTags(uid)
      if (result && result.tags) {
        userTagRows.value = Object.entries(result.tags).map(([tagKey, tagValue]) => ({
          tagKey,
          tagValue,
        }))
      } else {
        userTagRows.value = []
      }
    }

    if (userTagRows.value.length === 0) {
      ElMessage.info('未找到标签数据')
    }
  } finally {
    loading.value = false
  }
}

// --- Delete ---
async function handleDelete(row: TagValueRow) {
  try {
    await ElMessageBox.confirm(
      `确定要删除用户「${currentUserId.value}」的标签「${row.tagKey}」吗？`,
      '删除确认',
      { type: 'warning' },
    )
    await deleteTagValue(currentUserId.value, row.tagKey)
    ElMessage.success('删除成功')
    handleSearchUser()
  } catch {
    // cancelled
  }
}

// --- Write dialog ---
const writeDialogVisible = ref(false)
const submitting = ref(false)
const tagOptions = ref<TagDefinitionDTO[]>([])

const writeForm = reactive<TagValueWriteRequest>({
  userId: '',
  tagKey: '',
  tagValue: '',
})

const writeFormRules = {
  userId: [{ required: true, message: '请输入用户 ID', trigger: 'blur' }],
  tagKey: [{ required: true, message: '请选择标签', trigger: 'change' }],
  tagValue: [{ required: true, message: '请输入标签值', trigger: 'blur' }],
}

const writeFormRef = ref()

const selectedTag = computed<TagDefinitionDTO | undefined>(() =>
  tagOptions.value.find((t) => t.tagKey === writeForm.tagKey),
)

const enumSelected = ref<string[]>([])

watch(
  () => writeForm.tagKey,
  () => {
    writeForm.tagValue = ''
    enumSelected.value = []
  },
)

async function openWriteDialog() {
  writeForm.userId = currentUserId.value || ''
  writeForm.tagKey = ''
  writeForm.tagValue = ''
  enumSelected.value = []
  writeDialogVisible.value = true

  // Load tag definitions for dropdown
  if (tagOptions.value.length === 0) {
    try {
      const result = await pageTagDefinitions({ pageNum: 1, pageSize: 500 })
      tagOptions.value = result.list
    } catch {
      // ignore
    }
  }
}

async function handleWriteSubmit() {
  const valid = await writeFormRef.value?.validate().catch(() => false)
  if (!valid) return

  submitting.value = true
  try {
    const payload: TagValueWriteRequest = { ...writeForm }
    if (selectedTag.value?.tagType === TagType.ENUM) {
      payload.tagValue = enumSelected.value.join(',')
    }
    await writeTagValue(payload)
    ElMessage.success('写入成功')
    writeDialogVisible.value = false
    // Refresh if same user
    if (writeForm.userId === currentUserId.value) {
      handleSearchUser()
    }
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <div class="page-card">
    <!-- Search bar -->
    <div class="search-bar">
      <el-input
        v-model="searchUserId"
        placeholder="输入用户 ID"
        clearable
        style="width: 280px"
        @keyup.enter="handleSearchUser"
      />
      <el-input
        v-model="searchTagKey"
        placeholder="标签 Key（可选，留空查全部）"
        clearable
        style="width: 260px"
        @keyup.enter="handleSearchUser"
      />
      <el-button type="primary" :icon="Search" :loading="loading" @click="handleSearchUser">
        查询
      </el-button>
      <el-button type="success" :icon="Plus" @click="openWriteDialog">写入标签值</el-button>
    </div>

    <!-- Result hint -->
    <div v-if="currentUserId" class="result-hint">
      用户 <strong>{{ currentUserId }}</strong> 的标签数据（共 {{ userTagRows.length }} 条）
    </div>

    <!-- Tag value table -->
    <el-table
      v-loading="loading"
      :data="userTagRows"
      stripe
      highlight-current-row
      style="width: 100%"
      empty-text="请先输入用户 ID 进行查询"
    >
      <el-table-column prop="tagKey" label="标签 Key" min-width="200" show-overflow-tooltip />
      <el-table-column prop="tagValue" label="标签值" min-width="300" show-overflow-tooltip />
      <el-table-column label="操作" width="100" fixed="right">
        <template #default="{ row }">
          <el-button type="danger" link size="small" :icon="Delete" @click="handleDelete(row)">
            删除
          </el-button>
        </template>
      </el-table-column>
    </el-table>

    <!-- Write tag value dialog -->
    <el-dialog v-model="writeDialogVisible" title="写入标签值" width="500px" destroy-on-close>
      <el-form ref="writeFormRef" :model="writeForm" :rules="writeFormRules" label-width="100px">
        <el-form-item label="用户 ID" prop="userId">
          <el-input v-model="writeForm.userId" placeholder="输入用户 ID" />
        </el-form-item>
        <el-form-item label="标签" prop="tagKey">
          <el-select
            v-model="writeForm.tagKey"
            filterable
            placeholder="选择标签"
            style="width: 100%"
          >
            <el-option
              v-for="tag in tagOptions"
              :key="tag.tagKey"
              :label="`${tag.tagName} (${tag.tagKey})`"
              :value="tag.tagKey"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="标签值" prop="tagValue">
          <!-- ENUM: multi-select from predefined values -->
          <el-select
            v-if="selectedTag?.tagType === TagType.ENUM"
            v-model="enumSelected"
            multiple
            filterable
            placeholder="选择枚举值"
            style="width: 100%"
            @change="writeForm.tagValue = enumSelected.join(',')"
          >
            <el-option
              v-for="ev in selectedTag.enumValues"
              :key="ev"
              :label="ev"
              :value="ev"
            />
          </el-select>

          <!-- DATE: date-time picker -->
          <el-date-picker
            v-else-if="selectedTag?.tagType === TagType.DATE"
            v-model="writeForm.tagValue"
            type="datetime"
            value-format="YYYY-MM-DD HH:mm:ss"
            placeholder="选择日期时间"
            style="width: 100%"
          />

          <!-- BOOLEAN: true / false select -->
          <el-select
            v-else-if="selectedTag?.tagType === TagType.BOOLEAN"
            v-model="writeForm.tagValue"
            placeholder="选择布尔值"
            style="width: 100%"
          >
            <el-option label="true" value="true" />
            <el-option label="false" value="false" />
          </el-select>

          <!-- LONG: integer input -->
          <el-input
            v-else-if="selectedTag?.tagType === TagType.LONG"
            v-model="writeForm.tagValue"
            type="number"
            placeholder="输入整数"
          />

          <!-- DOUBLE: decimal input -->
          <el-input
            v-else-if="selectedTag?.tagType === TagType.DOUBLE"
            v-model="writeForm.tagValue"
            type="number"
            placeholder="输入浮点数"
          />

          <!-- STRING / default: text input -->
          <el-input v-else v-model="writeForm.tagValue" placeholder="输入标签值" />
        </el-form-item>
      </el-form>

      <template #footer>
        <el-button @click="writeDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="handleWriteSubmit">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style lang="scss" scoped>
.search-bar {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 20px;
  flex-wrap: wrap;
}

.result-hint {
  margin-bottom: 12px;
  color: #606266;
  font-size: 14px;
}
</style>
