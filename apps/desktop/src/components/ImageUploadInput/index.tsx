import { ImagePlus } from 'lucide-react'
import { useRef } from 'react'
import type { ChangeEvent, InputHTMLAttributes } from 'react'

import { Button } from '@/components/Button'
import { cn } from '@/lib/utils'

type ImageUploadInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'accept' | 'children' | 'onChange' | 'type'> & {
  buttonClassName?: string
  label?: string
  onFilesChange: (files: FileList | null) => void
}

export function ImageUploadInput({
  buttonClassName,
  className,
  disabled,
  label = '添加图片',
  multiple,
  onFilesChange,
  ...props
}: ImageUploadInputProps) {
  const inputRef = useRef<HTMLInputElement>(null)

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    onFilesChange(event.target.files)
    event.target.value = ''
  }

  return (
    <div className={cn('min-w-0', className)}>
      <input
        accept="image/*"
        className="sr-only"
        disabled={disabled}
        multiple={multiple}
        ref={inputRef}
        type="file"
        onChange={handleChange}
        {...props}
      />
      <Button
        className={cn('gap-1.5', buttonClassName)}
        disabled={disabled}
        type="button"
        onClick={() => inputRef.current?.click()}
      >
        <ImagePlus className="size-4" strokeWidth={1.9} />
        {label}
      </Button>
    </div>
  )
}
