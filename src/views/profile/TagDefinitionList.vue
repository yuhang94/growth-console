<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, Search, Refresh } from '@element-plus/icons-vue'
import {
  pageTagDefinitions,
  createTagDefinition,
  updateTagDefinition,
  updateTagDefinitionStatus,
} from '@/api/tagDefinition'
import {
  TagType,
  TagTypeLabels,
  type TagDefinitionDTO,
  type TagDefinitionCreateRequest,
  type TagDefinitionUpdateRequest,
} from '@/types/api'

// --- Table state ---
const loading = ref(false)
const tableData = ref<TagDefinitionDTO[]>([])
const total = ref(0)
const queryParams = reactive({
  category: '',
  keyword: '',
  pageNum: 1,
  pageSize: 20,
})

async function fetchData() {
  loading.value = true
  try {
    const result = await pageTagDefinitions({
      category: queryParams.category || undefined,
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
  queryParams.category = ''
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

// --- Dialog state ---
const dialogVisible = ref(false)
const dialogTitle = ref('新建标签')
const isEditing = ref(false)
const editingTagKey = ref('')
const submitting = ref(false)

const formRef = ref()
const form = reactive<{
  tagKey: string
  tagName: string
  tagType: TagType
  category: string
  description: string
  enumValues: string[]
}>({
  tagKey: '',
  tagName: '',
  tagType: TagType.STRING,
  category: '',
  description: '',
  enumValues: [],
})

const formRules = {
  tagKey: [
    { required: true, message: '请输入标签 Key', trigger: 'blur' },
    { max: 64, message: '最长 64 字符', trigger: 'blur' },
  ],
  tagName: [
    { required: true, message: '请输入标签名称', trigger: 'blur' },
    { max: 128, message: '最长 128 字符', trigger: 'blur' },
  ],
  tagType: [{ required: true, message: '请选择标签类型', trigger: 'change' }],
}

function openCreateDialog() {
  isEditing.value = false
  dialogTitle.value = '新建标签'
  editingTagKey.value = ''
  Object.assign(form, {
    tagKey: '',
    tagName: '',
    tagType: TagType.STRING,
    category: '',
    description: '',
    enumValues: [],
  })
  dialogVisible.value = true
}

function openEditDialog(row: TagDefinitionDTO) {
  isEditing.value = true
  dialogTitle.value = '编辑标签'
  editingTagKey.value = row.tagKey
  Object.assign(form, {
    tagKey: row.tagKey,
    tagName: row.tagName,
    tagType: row.tagType,
    category: row.category || '',
    description: row.description || '',
    enumValues: row.enumValues ? [...row.enumValues] : [],
  })
  dialogVisible.value = true
}

// Enum values management
const newEnumValue = ref('')

function addEnumValue() {
  const val = newEnumValue.value.trim()
  if (!val) return
  if (form.enumValues.includes(val)) {
    ElMessage.warning('枚举值已存在')
    return
  }
  form.enumValues.push(val)
  newEnumValue.value = ''
}

function removeEnumValue(index: number) {
  form.enumValues.splice(index, 1)
}

async function handleSubmit() {
  const valid = await formRef.value?.validate().catch(() => false)
  if (!valid) return

  submitting.value = true
  try {
    if (isEditing.value) {
      const data: TagDefinitionUpdateRequest = {
        tagName: form.tagName,
        tagType: form.tagType,
        category: form.category || undefined,
        description: form.description || undefined,
        enumValues: form.tagType === TagType.ENUM ? form.enumValues : undefined,
      }
      await updateTagDefinition(editingTagKey.value, data)
      ElMessage.success('更新成功')
    } else {
      const data: TagDefinitionCreateRequest = {
        tagKey: form.tagKey,
        tagName: form.tagName,
        tagType: form.tagType,
        category: form.category || undefined,
        description: form.description || undefined,
        enumValues: form.tagType === TagType.ENUM ? form.enumValues : undefined,
      }
      await createTagDefinition(data)
      ElMessage.success('创建成功')
    }
    dialogVisible.value = false
    fetchData()
  } finally {
    submitting.value = false
  }
}

// --- Status toggle ---
async function handleToggleStatus(row: TagDefinitionDTO) {
  const newStatus = row.status === 1 ? 0 : 1
  const action = newStatus === 1 ? '启用' : '停用'
  try {
    await ElMessageBox.confirm(`确定要${action}标签「${row.tagName}」吗？`, '提示', {
      type: 'warning',
    })
    await updateTagDefinitionStatus(row.tagKey, newStatus)
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

// --- Computed for filtered data (client-side keyword filter) ---
import { computed } from 'vue'
const filteredData = computed(() => {
  if (!queryParams.keyword) return tableData.value
  const kw = queryParams.keyword.toLowerCase()
  return tableData.value.filter(
    (item) =>
      item.tagKey.toLowerCase().includes(kw) ||
      item.tagName.toLowerCase().includes(kw),
  )
})

onMounted(fetchData)
</script>

<template>
  <div class="page-card">
    <!-- Toolbar -->
    <div class="table-toolbar">
      <div class="table-toolbar__left">
        <el-input
          v-model="queryParams.keyword"
          placeholder="搜索标签 Key / 名称"
          :prefix-icon="Search"
          clearable
          style="width: 240px"
          @keyup.enter="handleSearch"
        />
        <el-input
          v-model="queryParams.category"
          placeholder="分类筛选"
          clearable
          style="width: 160px"
          @keyup.enter="handleSearch"
        />
        <el-button type="primary" :icon="Search" @click="handleSearch">查询</el-button>
        <el-button :icon="Refresh" @click="handleReset">重置</el-button>
      </div>
      <div class="table-toolbar__right">
        <el-button type="primary" :icon="Plus" @click="openCreateDialog">新建标签</el-button>
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
      <el-table-column prop="tagKey" label="标签 Key" min-width="160" show-overflow-tooltip />
      <el-table-column prop="tagName" label="标签名称" min-width="140" show-overflow-tooltip />
      <el-table-column prop="tagType" label="类型" width="100">
        <template #default="{ row }">
          <el-tag size="small" effect="plain">{{ TagTypeLabels[row.tagType as TagType] || row.tagType }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="category" label="分类" width="120" show-overflow-tooltip />
      <el-table-column prop="description" label="描述" min-width="180" show-overflow-tooltip />
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
    <el-dialog v-model="dialogVisible" :title="dialogTitle" width="560px" destroy-on-close>
      <el-form ref="formRef" :model="form" :rules="formRules" label-width="100px">
        <el-form-item label="标签 Key" prop="tagKey">
          <el-input
            v-model="form.tagKey"
            :disabled="isEditing"
            placeholder="如 user_level"
            maxlength="64"
            show-word-limit
          />
        </el-form-item>
        <el-form-item label="标签名称" prop="tagName">
          <el-input v-model="form.tagName" placeholder="如 用户等级" maxlength="128" show-word-limit />
        </el-form-item>
        <el-form-item label="标签类型" prop="tagType">
          <el-select v-model="form.tagType" style="width: 100%">
            <el-option
              v-for="t in Object.values(TagType)"
              :key="t"
              :label="TagTypeLabels[t]"
              :value="t"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="分类">
          <el-input v-model="form.category" placeholder="可选，如 基础属性" maxlength="64" />
        </el-form-item>
        <el-form-item label="描述">
          <el-input
            v-model="form.description"
            type="textarea"
            :rows="3"
            placeholder="标签用途描述"
            maxlength="512"
            show-word-limit
          />
        </el-form-item>

        <!-- Enum values (only when tagType === ENUM) -->
        <el-form-item v-if="form.tagType === TagType.ENUM" label="枚举值">
          <div class="enum-editor">
            <div class="enum-tags">
              <el-tag
                v-for="(val, index) in form.enumValues"
                :key="val"
                closable
                @close="removeEnumValue(index)"
              >
                {{ val }}
              </el-tag>
            </div>
            <div class="enum-input">
              <el-input
                v-model="newEnumValue"
                placeholder="输入枚举值后回车"
                size="small"
                @keyup.enter="addEnumValue"
              />
              <el-button size="small" type="primary" @click="addEnumValue">添加</el-button>
            </div>
          </div>
        </el-form-item>
      </el-form>

      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="handleSubmit">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style lang="scss" scoped>
.enum-editor {
  width: 100%;

  .enum-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-bottom: 8px;
  }

  .enum-input {
    display: flex;
    gap: 8px;
  }
}
</style>
