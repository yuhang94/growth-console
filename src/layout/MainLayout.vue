<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  Menu as IconMenu,
  PriceTag,
  Search,
  Fold,
  Expand,
} from '@element-plus/icons-vue'

const route = useRoute()
const router = useRouter()
const isCollapsed = ref(false)

const activeMenu = computed(() => route.path)
const breadcrumb = computed(() => (route.meta.breadcrumb as string[]) || [])

function handleMenuSelect(index: string) {
  router.push(index)
}
</script>

<template>
  <el-container class="layout-container">
    <!-- Sidebar -->
    <el-aside :width="isCollapsed ? '64px' : '220px'" class="layout-aside">
      <div class="logo-area">
        <img src="@/assets/logo.svg" alt="logo" class="logo-icon" />
        <span v-show="!isCollapsed" class="logo-text">Growth Console</span>
      </div>
      <el-menu
        :default-active="activeMenu"
        :collapse="isCollapsed"
        :collapse-transition="false"
        background-color="#001529"
        text-color="#ffffffa6"
        active-text-color="#409EFF"
        @select="handleMenuSelect"
      >
        <el-sub-menu index="profile">
          <template #title>
            <el-icon><IconMenu /></el-icon>
            <span>画像管理</span>
          </template>
          <el-menu-item index="/tags/definitions">
            <el-icon><PriceTag /></el-icon>
            <span>标签定义</span>
          </el-menu-item>
          <el-menu-item index="/tags/values">
            <el-icon><Search /></el-icon>
            <span>标签值查询</span>
          </el-menu-item>
        </el-sub-menu>
      </el-menu>
    </el-aside>

    <!-- Main area -->
    <el-container>
      <!-- Header -->
      <el-header class="layout-header">
        <el-icon
          class="collapse-btn"
          @click="isCollapsed = !isCollapsed"
        >
          <Fold v-if="!isCollapsed" />
          <Expand v-else />
        </el-icon>
        <el-breadcrumb separator="/">
          <el-breadcrumb-item v-for="item in breadcrumb" :key="item">
            {{ item }}
          </el-breadcrumb-item>
        </el-breadcrumb>
      </el-header>

      <!-- Content -->
      <el-main class="layout-main">
        <router-view />
      </el-main>
    </el-container>
  </el-container>
</template>

<style lang="scss" scoped>
.layout-container {
  height: 100vh;
}

.layout-aside {
  background-color: #001529;
  transition: width 0.2s;
  overflow: hidden;

  .logo-area {
    height: 60px;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    border-bottom: 1px solid #ffffff1a;

    .logo-icon {
      width: 28px;
      height: 28px;
    }

    .logo-text {
      color: #fff;
      font-size: 16px;
      font-weight: 600;
      white-space: nowrap;
    }
  }

  .el-menu {
    border-right: none;
  }
}

.layout-header {
  display: flex;
  align-items: center;
  gap: 12px;
  background: #fff;
  border-bottom: 1px solid #e8e8e8;
  height: 60px;

  .collapse-btn {
    font-size: 20px;
    cursor: pointer;
    color: #333;

    &:hover {
      color: #409eff;
    }
  }
}

.layout-main {
  background: #f5f7fa;
  min-height: 0;
}
</style>
