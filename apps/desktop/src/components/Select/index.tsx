import { CheckIcon, ChevronDownIcon, ChevronUpIcon } from 'lucide-react'
import * as React from 'react'
import { Select as SelectPrimitive } from '@base-ui/react/select'

import { cn } from '@/lib/utils'

function Select({ ...props }: React.ComponentProps<typeof SelectPrimitive.Root>) {
  return <SelectPrimitive.Root data-slot="select" {...props} />
}

function SelectGroup({
  className,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Group>) {
  return (
    <SelectPrimitive.Group
      data-slot="select-group"
      className={cn('scroll-my-1 p-1', className)}
      {...props}
    />
  )
}

function SelectValue({ ...props }: React.ComponentProps<typeof SelectPrimitive.Value>) {
  return <SelectPrimitive.Value data-slot="select-value" {...props} />
}

function SelectTrigger({
  className,
  size = 'default',
  children,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Trigger> & {
  size?: 'sm' | 'default'
}) {
  return (
    <SelectPrimitive.Trigger
      data-slot="select-trigger"
      data-size={size}
      className={cn(
        'flex w-fit cursor-pointer items-center justify-between gap-1.5 rounded-lg border border-border bg-fill py-1.5 pl-2.5 pr-2 text-base text-text-strong whitespace-nowrap transition-colors outline-none select-none hover:border-border-hover hover:bg-fill-hover focus-visible:border-border-hover disabled:cursor-not-allowed disabled:opacity-50 data-placeholder:text-text-muted data-[size=default]:h-7 data-[size=sm]:h-6 *:data-[slot=select-value]:line-clamp-1 *:data-[slot=select-value]:flex *:data-[slot=select-value]:items-center *:data-[slot=select-value]:gap-1.5 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*=\'size-\'])]:size-3.5',
        className,
      )}
      {...props}
    >
      {children}
      <SelectPrimitive.Icon className="inline-flex items-center justify-center">
        <ChevronDownIcon className="pointer-events-none size-3.5 text-text-muted" />
      </SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
  )
}

function SelectContent({
  className,
  children,
  align = 'end',
  menuTitle,
  menuTitleClassName,
  side = 'bottom',
  sideOffset = 6,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Popup>
  & Pick<React.ComponentProps<typeof SelectPrimitive.Positioner>, 'align' | 'side' | 'sideOffset'>
  & {
    menuTitle?: React.ReactNode
    menuTitleClassName?: string
  }) {
  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Positioner
        align={align}
        alignItemWithTrigger={false}
        side={side}
        sideOffset={sideOffset}
      >
        <SelectPrimitive.Popup
          data-slot="select-content"
          className={cn(
            'relative z-50 max-h-[var(--available-height)] min-w-32 origin-[var(--transform-origin)] overflow-x-hidden overflow-y-auto rounded-lg border border-border bg-background-solid text-text-strong duration-100 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95',
            className,
          )}
          {...props}
        >
          <SelectScrollUpButton />
          <SelectPrimitive.List data-slot="select-list" className="p-1">
            {menuTitle ? (
              <div
                data-slot="select-menu-title"
                className={cn('px-2 pb-1.5 pt-2 text-base font-medium text-text-muted', menuTitleClassName)}
              >
                {menuTitle}
              </div>
            ) : null}
            {children}
          </SelectPrimitive.List>
          <SelectScrollDownButton />
        </SelectPrimitive.Popup>
      </SelectPrimitive.Positioner>
    </SelectPrimitive.Portal>
  )
}

function SelectLabel({
  className,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.GroupLabel>) {
  return (
    <SelectPrimitive.GroupLabel
      data-slot="select-label"
      className={cn('px-1.5 py-1 text-base text-text-muted', className)}
      {...props}
    />
  )
}

function SelectItem({
  className,
  children,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Item>) {
  return (
    <SelectPrimitive.Item
      data-slot="select-item"
      className={cn(
        'relative flex h-8 w-full cursor-pointer items-center gap-1.5 rounded-lg py-0 pl-2 pr-7 text-base text-text-muted outline-hidden select-none transition-colors data-disabled:pointer-events-none data-disabled:opacity-50 data-highlighted:bg-fill-hover data-highlighted:text-text-strong data-selected:bg-fill-hover data-selected:text-text-strong [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*=\'size-\'])]:size-3.5 *:[span]:last:flex *:[span]:last:items-center *:[span]:last:gap-2',
        className,
      )}
      {...props}
    >
      <SelectPrimitive.ItemIndicator
        data-slot="select-item-indicator"
        className="pointer-events-none absolute right-2 flex size-3.5 items-center justify-center"
      >
        <CheckIcon className="pointer-events-none" />
      </SelectPrimitive.ItemIndicator>
      <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
    </SelectPrimitive.Item>
  )
}

function SelectSeparator({
  className,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Separator>) {
  return (
    <SelectPrimitive.Separator
      data-slot="select-separator"
      className={cn('pointer-events-none -mx-1 my-1 h-px bg-separator-subtle', className)}
      {...props}
    />
  )
}

function SelectScrollUpButton({
  className,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.ScrollUpArrow>) {
  return (
    <SelectPrimitive.ScrollUpArrow
      data-slot="select-scroll-up-button"
      className={cn(
        'z-10 flex cursor-default items-center justify-center bg-background-solid py-1 text-text-muted [&_svg:not([class*=\'size-\'])]:size-3.5',
        className,
      )}
      {...props}
    >
      <ChevronUpIcon />
    </SelectPrimitive.ScrollUpArrow>
  )
}

function SelectScrollDownButton({
  className,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.ScrollDownArrow>) {
  return (
    <SelectPrimitive.ScrollDownArrow
      data-slot="select-scroll-down-button"
      className={cn(
        'z-10 flex cursor-default items-center justify-center bg-background-solid py-1 text-text-muted [&_svg:not([class*=\'size-\'])]:size-3.5',
        className,
      )}
      {...props}
    >
      <ChevronDownIcon />
    </SelectPrimitive.ScrollDownArrow>
  )
}

export {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectScrollDownButton,
  SelectScrollUpButton,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
}
