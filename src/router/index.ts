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
      {
        path: 'segments',
        name: 'Segments',
        component: () => import('@/views/profile/SegmentList.vue'),
        meta: { title: '人群分层', breadcrumb: ['画像管理', '人群分层'] },
      },
      {
        path: 'event-definitions',
        name: 'EventDefinitions',
        component: () => import('@/views/profile/EventDefinitionList.vue'),
        meta: { title: '事件定义', breadcrumb: ['画像管理', '事件定义'] },
      },
      {
        path: 'behavior-events',
        name: 'BehaviorEvents',
        component: () => import('@/views/profile/BehaviorEventQuery.vue'),
        meta: { title: '行为事件', breadcrumb: ['画像管理', '行为事件'] },
      },
      {
        path: 'segment-templates',
        name: 'SegmentTemplates',
        component: () => import('@/views/profile/SegmentTemplateList.vue'),
        meta: { title: '业务模板', breadcrumb: ['画像管理', '业务模板'] },
      },
      {
        path: 'campaign-events',
        name: 'CampaignEvents',
        component: () => import('@/views/campaign/CampaignEventManagement.vue'),
        meta: { title: '事件管理', breadcrumb: ['事件管理'] },
      },
      {
        path: 'campaigns',
        name: 'Campaigns',
        component: () => import('@/views/campaign/CampaignManagement.vue'),
        meta: { title: '活动管理', breadcrumb: ['营销管理', '活动管理'] },
      },
    ],
  },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

export default router
