import { Outlet } from 'react-router'

import { AppHeader } from '@/components/AppHeader'
import { AppSidebar } from '@/components/AppSidebar'

export function AppLayout() {
  return (
    <main className="h-screen overflow-hidden bg-[#ffffff] text-text-strong antialiased">
      <div className="flex h-screen w-screen overflow-hidden">
        <AppSidebar />
        <section className="relative min-w-0 flex-1 overflow-hidden">
          <AppHeader />
          <div className="grid h-full bg-[#ffffff] grid-cols-[440px_minmax(0,1fr)] gap-4 overflow-y-auto px-4 pb-4 pt-[72px]">
            <Outlet />
          </div>
        </section>
      </div>
    </main>
  )
}
