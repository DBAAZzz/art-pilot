import { Image } from 'lucide-react'
import { useMemo } from 'react'
import type { KeyboardEvent } from 'react'

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
  const promptLengthText = useMemo(() => `${prompt.trim().length}/5000`, [prompt])

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
    <div className="flex min-h-[260px] w-full flex-col rounded-lg border border-border bg-fill">
      <textarea
        className="min-h-0 w-full flex-1 resize-none rounded-lg bg-transparent px-5 pb-3 pt-4 text-xs text-text-strong outline-none placeholder:text-text-muted"
        maxLength={5000}
        placeholder="例如：清晨的湖边山谷，薄雾、柔和光线、远处有雪山，画面安静干净..."
        value={prompt}
        onChange={(event) => onPromptChange(event.target.value)}
        onKeyDown={handlePromptKeyDown}
      />

      <div className="flex items-center justify-end gap-3 px-4 p-0">
        <span className="shrink-0 text-base text-text-muted">{promptLengthText}</span>
        <button
          aria-label="添加参考图"
          className="flex size-8 cursor-pointer items-center justify-center rounded-lg text-text-muted transition-colors hover:bg-fill-hover hover:text-text-strong"
          type="button"
        >
          <Image className="size-5" strokeWidth={1.8} />
        </button>
      </div>
    </div>
  )
}
