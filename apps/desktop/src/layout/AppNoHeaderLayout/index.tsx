import { Outlet } from 'react-router'

import { AppSidebar } from '@/components/AppSidebar'

export function AppNoHeaderLayout() {
  return (
    <main className="h-screen overflow-hidden bg-background-subtle text-text-strong antialiased">
      <div className="flex h-screen w-screen overflow-hidden bg-background-subtle">
        <AppSidebar />
        <section className="relative z-10 -ml-6 min-w-0 flex-1 overflow-hidden rounded-l-2xl bg-background-solid shadow-[-1px_0_0_rgba(0,0,0,0.08)]">
          <div className="h-full overflow-hidden bg-background-solid p-4">
            <Outlet />
          </div>
        </section>
      </div>
    </main>
  )
}
