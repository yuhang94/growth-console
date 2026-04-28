<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, Delete } from '@element-plus/icons-vue'
import { listSegmentTemplates, createSegmentTemplate, deleteSegmentTemplate } from '@/api/segmentTemplate'
import type { SegmentTemplateDTO, ConditionSlotDTO, SegmentTemplateCreateRequest } from '@/types/api'

const loading = ref(false)
const tableData = ref<SegmentTemplateDTO[]>([])

async function fetchData() {
  loading.value = true
  try {
    tableData.value = await listSegmentTemplates()
  } finally {
    loading.value = false
  }
}

// --- Delete ---
async function handleDelete(row: SegmentTemplateDTO) {
  try {
    await ElMessageBox.confirm(`确定删除模板「${row.title}」吗？`, '提示', { type: 'warning' })
    await deleteSegmentTemplate(row.id)
    ElMessage.success('删除成功')
    fetchData()
  } catch {}
}

// --- Create dialog ---
const dialogVisible = ref(false)
const submitting = ref(false)

const form = reactive<SegmentTemplateCreateRequest>({
  templateKey: '',
  title: '',
  description: '',
  slots: [],
})

function openCreateDialog() {
  form.templateKey = ''
  form.title = ''
  form.description = ''
  form.slots = [createEmptySlot()]
  dialogVisible.value = true
}

function createEmptySlot(): ConditionSlotDTO {
  return { label: '', eventTypes: [], defaultDays: 7, defaultCount: 1 }
}

function addSlot() {
  form.slots.push(createEmptySlot())
}

function removeSlot(index: number) {
  form.slots.splice(index, 1)
}

async function handleSubmit() {
  if (!form.templateKey.trim()) { ElMessage.warning('请填写模板标识'); return }
  if (!form.title.trim()) { ElMessage.warning('请填写模板标题'); return }
  if (form.slots.length === 0) { ElMessage.warning('请至少添加一个条件槽'); return }
  for (let i = 0; i < form.slots.length; i++) {
    const slot = form.slots[i]
    if (!slot.label.trim()) { ElMessage.warning(`条件槽 ${i + 1}：请填写标题`); return }
    if (slot.eventTypes.length === 0) { ElMessage.warning(`条件槽 ${i + 1}：请至少填写一个事件类型`); return }
  }
  submitting.value = true
  try {
    await createSegmentTemplate({ ...form, slots: form.slots })
    ElMessage.success('创建成功')
    dialogVisible.value = false
    fetchData()
  } finally {
    submitting.value = false
  }
}

onMounted(fetchData)
</script>

<template>
  <div class="page-card">
    <div class="table-toolbar">
      <div class="table-toolbar__left" />
      <div class="table-toolbar__right">
        <el-button type="primary" :icon="Plus" @click="openCreateDialog">新建模板</el-button>
      </div>
    </div>

    <el-table v-loading="loading" :data="tableData" stripe highlight-current-row style="width: 100%">
      <el-table-column prop="title" label="模板标题" min-width="140" show-overflow-tooltip />
      <el-table-column prop="description" label="描述" min-width="200" show-overflow-tooltip />
      <el-table-column label="条件槽数" width="90" align="center">
        <template #default="{ row }">{{ row.slots?.length ?? 0 }}</template>
      </el-table-column>
      <el-table-column label="类型" width="100" align="center">
        <template #default="{ row }">
          <el-tag :type="row.builtIn ? 'primary' : 'success'" size="small">
            {{ row.builtIn ? '内置' : '自定义' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="sortOrder" label="排序" width="70" align="center" />
      <el-table-column prop="templateKey" label="标识" width="160" show-overflow-tooltip />
      <el-table-column label="操作" width="100" fixed="right">
        <template #default="{ row }">
          <el-button
            v-if="!row.builtIn"
            type="danger"
            link
            size="small"
            :icon="Delete"
            @click="handleDelete(row)"
          >删除</el-button>
          <span v-else class="text-muted">—</span>
        </template>
      </el-table-column>
    </el-table>

    <!-- Create Dialog -->
    <el-dialog v-model="dialogVisible" title="新建业务模板" width="640px" destroy-on-close>
      <el-form label-width="90px">
        <el-form-item label="模板标识" required>
          <el-input v-model="form.templateKey" placeholder="如 vip_reorder，全局唯一" maxlength="64" />
        </el-form-item>
        <el-form-item label="模板标题" required>
          <el-input v-model="form.title" placeholder="如 VIP复购用户" maxlength="128" />
        </el-form-item>
        <el-form-item label="描述">
          <el-input v-model="form.description" type="textarea" :rows="2" maxlength="512" />
        </el-form-item>

        <el-divider>条件槽列表</el-divider>

        <div v-for="(slot, index) in form.slots" :key="index" class="slot-item">
          <div class="slot-item__header">
            <span class="slot-item__index">槽 {{ index + 1 }}</span>
            <el-button
              v-if="form.slots.length > 1"
              type="danger"
              link
              size="small"
              @click="removeSlot(index)"
            >删除</el-button>
          </div>
          <el-form-item label="槽标题" required>
            <el-input v-model="slot.label" placeholder="如 复购条件" maxlength="64" />
          </el-form-item>
          <el-form-item label="事件类型" required>
            <el-select
              v-model="slot.eventTypes"
              multiple
              filterable
              allow-create
              placeholder="如 ORDER、LOGIN、PAGE_VIEW"
              style="width: 100%"
            >
              <el-option value="ORDER" label="ORDER（下单）" />
              <el-option value="LOGIN" label="LOGIN（登录）" />
              <el-option value="PAGE_VIEW" label="PAGE_VIEW（浏览）" />
              <el-option value="SEARCH" label="SEARCH（搜索）" />
              <el-option value="CLICK" label="CLICK（点击）" />
              <el-option value="SHARE" label="SHARE（分享）" />
            </el-select>
          </el-form-item>
          <el-row :gutter="16">
            <el-col :span="12">
              <el-form-item label="默认天数">
                <el-input-number v-model="slot.defaultDays" :min="1" :max="365" controls-position="right" style="width: 100%" />
              </el-form-item>
            </el-col>
            <el-col :span="12">
              <el-form-item label="默认次数">
                <el-input-number v-model="slot.defaultCount" :min="1" :max="9999" controls-position="right" style="width: 100%" />
              </el-form-item>
            </el-col>
          </el-row>
        </div>

        <el-button type="dashed" style="width: 100%; margin-top: 4px" @click="addSlot">+ 添加条件槽</el-button>
      </el-form>

      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="handleSubmit">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style lang="scss" scoped>
.page-card {
  padding: 20px;
  background: #fff;
  border-radius: 4px;
}

.table-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.slot-item {
  border: 1px solid #e4e7ed;
  border-radius: 6px;
  padding: 12px 16px 4px;
  margin-bottom: 12px;

  &__header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 8px;
  }

  &__index {
    font-weight: 600;
    font-size: 13px;
    color: #303133;
  }
}

.text-muted {
  color: #c0c4cc;
  font-size: 13px;
}
</style>