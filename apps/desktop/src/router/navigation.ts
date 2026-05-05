import { Images, MessageSquareText, Sparkles } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

export type AppNavigationItem = {
  label: string
  icon: LucideIcon
  to: string
}

export const appNavigationItems: AppNavigationItem[] = [
  { label: '创作', icon: Sparkles, to: '/' },
  { label: '资产管理', icon: Images, to: '/assets' },
  { label: '提示词管理', icon: MessageSquareText, to: '/prompts' },
]
