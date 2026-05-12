import { RouterProvider } from 'react-router'

import { ConfirmProvider } from '@/components/ConfirmProvider'
import { router } from '@/router'

function App() {
  return (
    <ConfirmProvider>
      <RouterProvider router={router} />
    </ConfirmProvider>
  )
}

export default App
