import { ArrowUp, Image } from 'lucide-react'
import type { KeyboardEvent } from 'react'

import { cn } from '@/lib/utils'

export function GenerationForm({
  isGenerateDisabled,
  onGenerate,
  prompt,
  onPromptChange,
}: {
  isGenerateDisabled: boolean
  onGenerate: () => void | Promise<void>
  prompt: string
  onPromptChange: (value: string) => void
}) {
  function handlePromptKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== 'Enter' || event.shiftKey || event.nativeEvent.isComposing) {
      return
    }

    event.preventDefault()

    if (isGenerateDisabled) {
      return
    }

    void onGenerate()
  }

  return (
    <div className="flex min-h-[260px] w-full flex-col rounded-xl border border-border bg-fill">
      <textarea
        className="min-h-0 w-full flex-1 resize-none rounded-xl bg-transparent p-3 text-base text-text-strong outline-none placeholder:text-text-muted"
        placeholder="例如：清晨的湖边山谷，薄雾、柔和光线、远处有雪山，画面安静干净..."
        style={{
          fontSize: 'var(--text-base)',
          lineHeight: 'var(--text-base--line-height)',
        }}
        value={prompt}
        onChange={(event) => onPromptChange(event.target.value)}
        onKeyDown={handlePromptKeyDown}
      />

      <div className="flex items-center justify-end gap-2 px-3 py-2">
        <button
          aria-label="添加参考图"
          className="flex size-8 cursor-pointer items-center justify-center rounded-lg text-text-muted transition-colors hover:bg-fill-hover hover:text-text-strong"
          type="button"
        >
          <Image className="size-5" strokeWidth={1.8} />
        </button>
        <button
          aria-label="发送生成任务"
          className={cn(
            'flex size-6 items-center justify-center rounded-full transition-colors',
            isGenerateDisabled
              ? 'cursor-default bg-fill-active text-text-muted'
              : 'cursor-pointer bg-text-strong text-background-solid hover:bg-background-solid-hover hover:text-text-strong',
          )}
          disabled={isGenerateDisabled}
          type="button"
          onClick={() => void onGenerate()}
        >
          <ArrowUp className="size-4" strokeWidth={2} />
        </button>
      </div>
    </div>
  )
}
