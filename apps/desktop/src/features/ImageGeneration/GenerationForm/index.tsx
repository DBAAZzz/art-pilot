import { ArrowUp, FileImage, Image, X } from 'lucide-react'
import type { ImageReference } from '@art-pilot/shared'
import type { ClipboardEvent, KeyboardEvent } from 'react'
import { useMemo } from 'react'
import { useRef } from 'react'

import { ImagePreviewOverlay } from '@/components/ImagePreviewOverlay'
import { useImagePreview } from '@/hooks/useImagePreview'
import { cn } from '@/lib/utils'

export function GenerationForm({
  isGenerateDisabled,
  isReadOnly,
  onGenerate,
  prompt,
  onPromptChange,
  references,
  onRemoveReference,
  onAddReferences,
  onPasteReferences,
  onSelectReferences,
}: {
  isGenerateDisabled: boolean
  isReadOnly?: boolean
  onGenerate: () => void | Promise<void>
  prompt: string
  onPromptChange: (value: string) => void
  references: ImageReference[]
  onRemoveReference: (referenceId: string) => void
  onAddReferences: (references: ImageReference[]) => void
  onPasteReferences: () => Promise<boolean>
  onSelectReferences: () => void | Promise<void>
}) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  const referencePreviewImages = useMemo(
    () => references
      .map((reference, index) => reference.imageUrl
        ? {
            index,
            imageUrl: reference.imageUrl,
            imagePath: reference.path,
          }
        : null)
      .filter((reference): reference is { index: number, imageUrl: string, imagePath: string } => Boolean(reference)),
    [references],
  )
  const imagePreview = useImagePreview(referencePreviewImages)

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

  function handlePromptPaste(event: ClipboardEvent<HTMLTextAreaElement>) {
    const pastedText = event.clipboardData.getData('text/plain')

    if (!shouldPasteAsReference(event.clipboardData, pastedText)) {
      return
    }

    const selectionStart = event.currentTarget.selectionStart
    const selectionEnd = event.currentTarget.selectionEnd
    event.preventDefault()

    void pasteReferenceFiles(event.clipboardData.files)
      .then((didPasteFiles) => {
        if (didPasteFiles) {
          return true
        }

        return onPasteReferences()
      })
      .catch(() => onPasteReferences())
      .then((didPasteReferences) => {
        if (didPasteReferences || !pastedText) {
          return
        }

        const nextPrompt = `${prompt.slice(0, selectionStart)}${pastedText}${prompt.slice(selectionEnd)}`
        const nextCursorPosition = selectionStart + pastedText.length

        onPromptChange(nextPrompt)
        requestAnimationFrame(() => {
          textareaRef.current?.setSelectionRange(nextCursorPosition, nextCursorPosition)
        })
      })
  }

  async function pasteReferenceFiles(files: FileList) {
    const imageFiles = [...files].filter(isImageFile)

    if (imageFiles.length === 0) {
      return false
    }

    const fileReferences = await Promise.all(imageFiles.map(createImageReferenceFromFile))
    const usableReferences = fileReferences.filter((reference): reference is ImageReference => Boolean(reference))

    if (usableReferences.length === 0) {
      return false
    }

    onAddReferences(usableReferences)
    return true
  }

  function openReferencePreview(reference: ImageReference, index: number) {
    if (!reference.imageUrl) {
      return
    }

    imagePreview.openPreview({
      index,
      imageUrl: reference.imageUrl,
      imagePath: reference.path,
    })
  }

  return (
    <>
      <div className="flex min-w-0 w-full max-w-full flex-col rounded-xl border border-border bg-fill">
        <textarea
          ref={textareaRef}
          className={cn(
            'art-pilot-hidden-scrollbar h-[220px] min-w-0 w-full shrink-0 resize-none rounded-xl bg-transparent p-3 pb-2 text-base text-text-strong outline-none placeholder:text-text-muted',
            isReadOnly && 'cursor-default opacity-80',
          )}
          placeholder="例如：清晨的湖边山谷，薄雾、柔和光线、远处有雪山，画面安静干净..."
          readOnly={isReadOnly}
          style={{
            fontSize: 'var(--text-base)',
            lineHeight: 'var(--text-base--line-height)',
          }}
          value={prompt}
          onChange={(event) => onPromptChange(event.target.value)}
          onKeyDown={isReadOnly ? undefined : handlePromptKeyDown}
          onPaste={isReadOnly ? undefined : handlePromptPaste}
        />

        {references.length > 0 ? (
          <div className="shrink-0 px-3">
            <div className="art-pilot-hidden-scrollbar flex min-w-0 gap-2 overflow-x-auto py-2">
              {references.map((reference, index) => (
                <div
                  className={cn(
                    'relative aspect-[4/3] w-[30%] min-w-[132px] shrink-0 overflow-hidden rounded-lg bg-fill-hover text-text-strong transition-colors hover:bg-fill-active',
                    reference.imageUrl ? 'cursor-pointer' : 'cursor-default',
                  )}
                  key={reference.id}
                  role={reference.imageUrl ? 'button' : undefined}
                  tabIndex={reference.imageUrl ? 0 : undefined}
                  title={reference.path}
                  onClick={() => openReferencePreview(reference, index)}
                  onKeyDown={(event) => {
                    if (event.key !== 'Enter' && event.key !== ' ') {
                      return
                    }

                    event.preventDefault()
                    openReferencePreview(reference, index)
                  }}
                >
                  {reference.imageUrl ? (
                    <img
                      alt={`参考图 ${reference.name ?? reference.path}`}
                      className="size-full object-cover transition-transform hover:scale-[1.03]"
                      src={reference.imageUrl}
                    />
                  ) : (
                    <div className="flex size-full items-center justify-center text-text-muted">
                      <FileImage className="size-5" strokeWidth={1.8} />
                    </div>
                  )}
                  <button
                    aria-label={`移除参考图 ${reference.name ?? reference.path}`}
                    className="absolute right-1 top-1 flex size-6 cursor-pointer items-center justify-center rounded-lg bg-background-solid/80 text-text-muted transition-colors hover:bg-background-solid hover:text-text-strong"
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation()
                      onRemoveReference(reference.id)
                    }}
                  >
                    <X className="size-4" strokeWidth={1.8} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        <div className="flex shrink-0 items-center justify-end gap-2 px-3 py-1">
          <button
            aria-label="添加参考图"
            className="flex size-8 cursor-pointer items-center justify-center rounded-lg text-text-muted transition-colors hover:bg-fill-hover hover:text-text-strong"
            type="button"
            onClick={() => void onSelectReferences()}
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

      {imagePreview.isOpen && imagePreview.previewImage ? (
        <ImagePreviewOverlay
          currentPosition={imagePreview.currentPosition}
          image={imagePreview.previewImage}
          imageCount={imagePreview.imageCount}
          prompt="参考图"
          onClose={imagePreview.closePreview}
          onNext={imagePreview.showNext}
          onPrevious={imagePreview.showPrevious}
          onResetZoom={imagePreview.resetZoom}
          onZoomByDelta={imagePreview.zoomByDelta}
          onZoomIn={imagePreview.zoomIn}
          onZoomOut={imagePreview.zoomOut}
          zoom={imagePreview.zoom}
        />
      ) : null}
    </>
  )
}

function shouldPasteAsReference(clipboardData: DataTransfer, pastedText: string) {
  for (const file of clipboardData.files) {
    if (isImageFile(file)) {
      return true
    }
  }

  for (const item of clipboardData.items) {
    if (item.kind === 'file' && item.type.startsWith('image/')) {
      return true
    }
  }

  return isLikelySingleImageFileName(pastedText)
}

function isImageFile(file: File) {
  return file.type.startsWith('image/') || isLikelySingleImageFileName(file.name)
}

function isLikelySingleImageFileName(text: string) {
  const trimmedText = text.trim()

  return (
    trimmedText.length > 0
    && !trimmedText.includes('\n')
    && /\.(apng|avif|gif|jpe?g|png|webp)$/i.test(trimmedText)
  )
}

async function createImageReferenceFromFile(file: File): Promise<ImageReference | null> {
  const filePath = window.api.getPathForFile(file)

  if (!filePath) {
    return null
  }

  return {
    id: crypto.randomUUID(),
    kind: 'local-file',
    path: filePath,
    name: file.name,
    mimeType: file.type || guessImageMimeType(file.name),
    imageUrl: await readFileAsDataUrl(file),
  }
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()

    reader.addEventListener('load', () => {
      resolve(String(reader.result))
    })
    reader.addEventListener('error', () => {
      reject(reader.error ?? new Error('读取参考图失败'))
    })
    reader.readAsDataURL(file)
  })
}

function guessImageMimeType(fileName: string) {
  const extension = fileName.toLowerCase().split('.').pop()

  if (extension === 'jpg' || extension === 'jpeg') {
    return 'image/jpeg'
  }

  if (extension === 'png') {
    return 'image/png'
  }

  if (extension === 'webp') {
    return 'image/webp'
  }

  if (extension === 'gif') {
    return 'image/gif'
  }

  if (extension === 'avif') {
    return 'image/avif'
  }

  if (extension === 'apng') {
    return 'image/apng'
  }

  return undefined
}
