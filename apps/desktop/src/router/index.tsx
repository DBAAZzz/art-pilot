import { createHashRouter } from 'react-router'

import { ImageGenerationPage } from '@/features/ImageGeneration'
import { SettingPage } from '@/features/Setting'
import { AppLayout } from '@/layout/AppLayout'

export const router = createHashRouter([
  {
    path: '/',
    element: <AppLayout />,
    children: [
      {
        index: true,
        element: <ImageGenerationPage />,
      },
      {
        path: 'settings',
        element: <SettingPage />,
      },
    ],
  },
])
