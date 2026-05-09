import { createHashRouter } from 'react-router'

import { AssetDetailPage, AssetManagementPage } from '@/features/AssetManagement'
import { ImageGenerationPage } from '@/features/ImageGeneration'
import { PromptManagementPage } from '@/features/PromptManagement'
import { PromptTemplateEditorPage } from '@/features/PromptTemplateEditorPage'
import { SettingPage } from '@/features/Setting'
import { AppLayout } from '@/layout/AppLayout'
import { AppNoHeaderLayout } from '@/layout/AppNoHeaderLayout'

export const router = createHashRouter([
  {
    path: '/',
    element: <AppNoHeaderLayout />,
    children: [
      {
        index: true,
        element: <ImageGenerationPage />,
        handle: {
          meta: {
            title: '创作',
          },
        },
      },
      {
        path: 'assets',
        element: <AssetManagementPage />,
        handle: {
          meta: {
            title: '资产管理',
          },
        },
      },
      {
        path: 'prompts',
        element: <PromptManagementPage />,
        handle: {
          meta: {
            title: '提示词管理',
          },
        },
      },
      {
        path: 'settings',
        element: <SettingPage />,
        handle: {
          meta: {
            title: '设置',
          },
        },
      },
    ],
  },
  {
    path: '/assets/:imageId',
    element: <AppLayout />,
    children: [
      {
        index: true,
        element: <AssetDetailPage />,
        handle: {
          meta: {
            title: '资产详情',
          },
        },
      },
    ],
  },
  {
    path: '/prompts',
    element: <AppLayout />,
    children: [
      {
        path: 'new',
        element: <PromptTemplateEditorPage />,
        handle: {
          meta: {
            title: '新建提示词模板',
          },
        },
      },
      {
        path: ':templateId/edit',
        element: <PromptTemplateEditorPage />,
        handle: {
          meta: {
            title: '编辑提示词模板',
          },
        },
      },
    ],
  },
])
