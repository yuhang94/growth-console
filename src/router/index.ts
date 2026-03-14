import { createRouter, createWebHistory } from 'vue-router'
import type { RouteRecordRaw } from 'vue-router'
import MainLayout from '@/layout/MainLayout.vue'

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    component: MainLayout,
    redirect: '/tags/definitions',
    children: [
      {
        path: 'tags/definitions',
        name: 'TagDefinitions',
        component: () => import('@/views/profile/TagDefinitionList.vue'),
        meta: { title: '标签定义', breadcrumb: ['画像管理', '标签定义'] },
      },
      {
        path: 'tags/values',
        name: 'TagValues',
        component: () => import('@/views/profile/TagValueQuery.vue'),
        meta: { title: '标签值查询', breadcrumb: ['画像管理', '标签值查询'] },
      },
    ],
  },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

export default router
