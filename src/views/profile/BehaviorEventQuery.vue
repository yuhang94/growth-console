<script setup lang="ts">
import { ref, reactive } from 'vue'
import { Search, Refresh } from '@element-plus/icons-vue'
import { queryBehaviorEvents, getUserRecentEvents } from '@/api/behaviorEvent'
import type { BehaviorEventDTO } from '@/types/api'

const loading = ref(false)
const tableData = ref<BehaviorEventDTO[]>([])
const queryParams = reactive({
  userId: '',
  eventName: '',
  dateRange: null as [string, string] | null,
  pageNum: 1,
  pageSize: 20,
})

async function fetchData() {
  loading.value = true
  try {
    if (queryParams.userId && !queryParams.eventName && !queryParams.dateRange) {
      // Use recent events endpoint when only userId is provided
      tableData.value = await getUserRecentEvents(queryParams.userId, queryParams.pageSize)
    } else {
      tableData.value = await queryBehaviorEvents({
        userId: queryParams.userId || undefined,
        eventName: queryParams.eventName || undefined,
        startTime: queryParams.dateRange?.[0] || undefined,
        endTime: queryParams.dateRange?.[1] || undefined,
        pageNum: queryParams.pageNum,
        pageSize: queryParams.pageSize,
      })
    }
  } finally {
    loading.value = false
  }
}

function handleSearch() {
  queryParams.pageNum = 1
  fetchData()
}

function handleReset() {
  queryParams.userId = ''
  queryParams.eventName = ''
  queryParams.dateRange = null
  queryParams.pageNum = 1
  tableData.value = []
}

</script>

<template>
  <div class="page-card">
    <!-- Query Form -->
    <div class="table-toolbar">
      <div class="table-toolbar__left">
        <el-input
          v-model="queryParams.userId"
          placeholder="用户 ID"
          clearable
          style="width: 180px"
          @keyup.enter="handleSearch"
        />
        <el-input
          v-model="queryParams.eventName"
          placeholder="事件名称"
          clearable
          style="width: 180px"
          @keyup.enter="handleSearch"
        />
        <el-date-picker
          v-model="queryParams.dateRange"
          type="datetimerange"
          range-separator="至"
          start-placeholder="开始时间"
          end-placeholder="结束时间"
          value-format="YYYY-MM-DDTHH:mm:ss"
          style="width: 380px"
        />
        <el-button type="primary" :icon="Search" @click="handleSearch">查询</el-button>
        <el-button :icon="Refresh" @click="handleReset">重置</el-button>
      </div>
    </div>

    <!-- Table -->
    <el-table
      v-loading="loading"
      :data="tableData"
      stripe
      highlight-current-row
      style="width: 100%"
    >
      <el-table-column prop="eventId" label="事件 ID" min-width="180" show-overflow-tooltip />
      <el-table-column prop="userId" label="用户 ID" width="140" show-overflow-tooltip />
      <el-table-column prop="eventName" label="事件名称" width="140" show-overflow-tooltip />
      <el-table-column prop="eventType" label="事件类型" width="100">
        <template #default="{ row }">
          <el-tag size="small" effect="plain">{{ row.eventType }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="eventTime" label="事件时间" width="170" />
      <el-table-column label="属性" min-width="240">
        <template #default="{ row }">
          <template v-if="row.properties && Object.keys(row.properties).length > 0">
            <el-tag
              v-for="(val, key) in row.properties"
              :key="key"
              size="small"
              effect="plain"
              class="prop-tag"
            >
              {{ key }}={{ val }}
            </el-tag>
          </template>
          <span v-else class="text-muted">-</span>
        </template>
      </el-table-column>
      <el-table-column prop="createdTime" label="记录时间" width="170" />
    </el-table>

    <div v-if="tableData.length === 0 && !loading" class="empty-hint">
      请输入查询条件后点击查询
    </div>
  </div>
</template>

<style lang="scss" scoped>
.prop-tag {
  margin: 2px 4px 2px 0;
}

.text-muted {
  color: #909399;
}

.empty-hint {
  text-align: center;
  color: #909399;
  padding: 40px 0;
  font-size: 14px;
}
</style>
