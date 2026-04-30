import { MonitorCheck, Settings2 } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useState } from 'react'

import { EnvironmentPanel } from './EnvironmentPanel'
import { GeneralPanel } from './GeneralPanel'
import { SettingMenuItem } from './SettingMenuItem'

type SettingSection = 'environment' | 'general'

type SettingTab = {
  id: SettingSection
  label: string
  description?: string
  icon: LucideIcon
}

const tabs: SettingTab[] = [
  {
    id: 'environment',
    label: '环境检测',
    icon: MonitorCheck,
  },
  {
    id: 'general',
    label: '通用',
    icon: Settings2,
  },
]

function SettingMenu({
  activeSection,
  onSectionChange,
}: {
  activeSection: SettingSection
  onSectionChange: (section: SettingSection) => void
}) {
  return (
    <aside className="self-start rounded-lg px-1.5 py-2">
      <div className="flex flex-col gap-1">
        {tabs.map((tab) => (
          <SettingMenuItem
            active={activeSection === tab.id}
            key={tab.id}
            onClick={() => onSectionChange(tab.id)}
            tab={tab}
          />
        ))}
      </div>
    </aside>
  )
}

export function SettingPage() {
  const [activeSection, setActiveSection] = useState<SettingSection>('environment')
  
  return (
    <div className="col-span-2 grid h-full min-h-0 grid-cols-[244px_minmax(0,1fr)] gap-4">
      <SettingMenu activeSection={activeSection} onSectionChange={setActiveSection} />

      <div className="min-h-0 overflow-y-auto px-2 py-2">
        {activeSection === 'environment' ? <EnvironmentPanel /> : <GeneralPanel />}
      </div>
    </div>
  )
}
