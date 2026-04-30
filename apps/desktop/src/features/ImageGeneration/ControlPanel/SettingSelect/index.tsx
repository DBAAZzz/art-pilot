import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/Select'
import { cn } from '@/lib/utils'

export type SettingSelectOption = {
  value: string
  label: string
  meta?: string
  icon?: 'auto' | 'square' | 'portrait' | 'story' | 'landscape' | 'wide'
}

const iconClassNameByType: Record<NonNullable<SettingSelectOption['icon']>, string> = {
  auto: 'h-3 w-[18px] rounded-[3px]',
  square: 'size-[18px] rounded-[4px]',
  portrait: 'h-6 w-4 rounded-[4px]',
  story: 'h-7 w-3.5 rounded-[4px]',
  landscape: 'h-4 w-6 rounded-[4px]',
  wide: 'h-3.5 w-7 rounded-[4px]',
}

export function SettingSelect({
  label,
  value,
  options = [{ value, label: value }],
  menuTitle,
  menuClassName,
}: {
  label: string
  value: string
  options?: SettingSelectOption[]
  menuTitle?: string
  menuClassName?: string
}) {
  return (
    <div className="grid grid-cols-[100px_1fr] items-center gap-2.5">
      <span className="text-base font-medium text-text-strong">{label}</span>
      <Select defaultValue={value}>
        <SelectTrigger className="h-7 w-full px-2.5">
          <SelectValue />
        </SelectTrigger>
        <SelectContent
          className={cn(
            'w-[190px] p-0',
            menuClassName,
          )}
          menuTitle={menuTitle}
        >
          <SelectGroup>
            {options.map((option) => (
              <SelectItem
                key={option.value}
                value={option.value}
                className="h-[34px] px-2 py-0 pr-9 font-medium [&_[data-slot=select-item-indicator]]:right-3.5"
              >
                <span className="flex items-center gap-2.5">
                  {option.icon ? (
                    <span
                      aria-hidden="true"
                      className={cn(
                        'inline-flex shrink-0 border-[1.8px] border-text-strong bg-fill',
                        iconClassNameByType[option.icon],
                      )}
                    />
                  ) : null}
                  <span>
                    {option.label}
                    {option.meta ? <span className="ml-1.5 text-text-muted">{option.meta}</span> : null}
                  </span>
                </span>
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </div>
  )
}
