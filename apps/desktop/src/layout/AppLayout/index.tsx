import { Outlet } from 'react-router'

import { AppHeader } from '@/components/AppHeader'
import { AppSidebar } from '@/components/AppSidebar'

export function AppLayout() {
  return (
    <main className="h-screen overflow-hidden bg-background-subtle text-text-strong antialiased">
      <div className="flex h-screen w-screen overflow-hidden bg-background-subtle">
        <AppSidebar />
        <section className="relative z-10 -ml-6 min-w-0 flex-1 overflow-hidden rounded-l-2xl bg-background-solid shadow-[-1px_0_0_rgba(0,0,0,0.08)]">
          <AppHeader />
          <div className="grid h-full grid-cols-[360px_minmax(0,1fr)] gap-4 overflow-y-auto bg-background-solid px-4 pb-4 pt-[72px]">
            <Outlet />
          </div>
        </section>
      </div>
    </main>
  )
}
