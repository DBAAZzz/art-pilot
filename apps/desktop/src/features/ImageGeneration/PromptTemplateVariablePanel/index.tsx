import { X } from 'lucide-react'
import { useMemo } from 'react'
import type { ImageReference, PromptImageVariable, PromptTemplate, PromptVariable, PromptVariableValue } from '@art-pilot/shared'
import { MAX_IMAGE_REFERENCES, getImageVariableMaxCount, resolvePromptTemplateContent } from '@art-pilot/shared'

import { ImageUploadInput } from '@/components/ImageUploadInput'

export type PromptImageInputValue = {
  id: string
  name: string
  path: string
  imageUrl: string
}

export function PromptTemplateVariablePanel({
  template,
  textValues,
  imageValues,
  onTextChange,
  onImageSelect,
  onImageRemove,
  onExit,
}: {
  template: PromptTemplate
  textValues: Record<string, string>
  imageValues: Record<string, PromptImageInputValue[]>
  onTextChange: (key: string, value: string) => void
  onImageSelect: (variable: PromptImageVariable, files: FileList | null) => void
  onImageRemove: (variableKey: string, imageId: string) => void
  onExit: () => void
}) {
  const values = useMemo(
    () => buildPromptVariableValues(template.variables, textValues, imageValues),
    [template.variables, textValues, imageValues],
  )
  const preview = useMemo(
    () => resolvePromptTemplateContent(template.content, template.variables, values),
    [template.content, template.variables, values],
  )
  const filledCount = useMemo(() => {
    let filled = 0

    for (const variable of template.variables) {
      if (variable.type === 'text') {
        const val = textValues[variable.key]

        if (val?.trim() || variable.defaultValue?.trim()) {
          filled++
        }
      } else {
        const imgs = imageValues[variable.key]

        if (imgs && imgs.length > 0) {
          filled++
        }
      }
    }

    return filled
  }, [template.variables, textValues, imageValues])

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-semibold text-text-strong">{template.title}</p>
          <p className="text-base text-text-muted">模板变量 {filledCount}/{template.variables.length} 已填写</p>
        </div>
        <button
          className="flex shrink-0 cursor-pointer items-center gap-1 rounded-lg px-2 py-1 text-base text-text-muted transition-colors hover:bg-fill-hover hover:text-text-strong"
          type="button"
          onClick={onExit}
        >
          <X className="size-3.5" strokeWidth={1.8} />
          退出模板
        </button>
      </div>

      {template.variables.length > 0 ? (
        <div className="flex flex-col gap-2">
          {template.variables.map((variable) => (
            <VariableField
              imageValues={imageValues[variable.key] ?? []}
              key={variable.key}
              textValue={textValues[variable.key] ?? ''}
              variable={variable}
              onImageRemove={(imageId) => onImageRemove(variable.key, imageId)}
              onImageSelect={variable.type === 'image' ? (files) => onImageSelect(variable, files) : undefined}
              onTextChange={(value) => onTextChange(variable.key, value)}
            />
          ))}
        </div>
      ) : null}

      {preview.errors.length > 0 ? (
        <div className="rounded-lg bg-background-subtle px-3 py-2 text-base text-text-error">
          {preview.errors[0]}
        </div>
      ) : null}

      {preview.previewPrompt ? (
        <details className="group">
          <summary className="cursor-pointer text-base text-text-muted transition-colors hover:text-text-strong">
            Prompt 预览
          </summary>
          <pre className="art-pilot-scrollbar mt-1 max-h-32 overflow-y-auto whitespace-pre-wrap rounded-lg bg-background-subtle p-3 text-base leading-5 text-text-strong">
            {preview.previewPrompt}
          </pre>
        </details>
      ) : null}
    </div>
  )
}

function VariableField({
  variable,
  textValue,
  imageValues,
  onTextChange,
  onImageSelect,
  onImageRemove,
}: {
  variable: PromptVariable
  textValue: string
  imageValues: PromptImageInputValue[]
  onTextChange: (value: string) => void
  onImageSelect?: (files: FileList | null) => void
  onImageRemove: (imageId: string) => void
}) {
  return (
    <div className="rounded-lg border border-border bg-background-subtle p-3">
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <label
          className="text-base font-medium text-text-strong"
          htmlFor={`var-${variable.key}`}
        >
          {variable.label}
        </label>
        {variable.required ? (
          <span className="rounded-md bg-fill px-1.5 py-0.5 text-base text-text-muted">必填</span>
        ) : null}
      </div>
      {variable.description ? (
        <p className="mb-1.5 text-base text-text-muted">{variable.description}</p>
      ) : null}

      {variable.type === 'text' ? (
        <textarea
          className="min-h-16 w-full resize-y rounded-lg border border-border bg-fill px-3 py-2 text-base leading-5 text-text-strong outline-none transition-colors placeholder:text-text-muted focus:border-border-hover"
          id={`var-${variable.key}`}
          placeholder={variable.placeholder ?? `填写 ${variable.label}`}
          value={textValue}
          onChange={(event) => onTextChange(event.target.value)}
        />
      ) : (
        <ImageVariableField
          imageValues={imageValues}
          variable={variable}
          onImageRemove={onImageRemove}
          onImageSelect={onImageSelect ?? (() => {})}
        />
      )}
    </div>
  )
}

function ImageVariableField({
  variable,
  imageValues,
  onImageSelect,
  onImageRemove,
}: {
  variable: PromptImageVariable
  imageValues: PromptImageInputValue[]
  onImageSelect: (files: FileList | null) => void
  onImageRemove: (imageId: string) => void
}) {
  const maxCount = getImageVariableMaxCount(variable)
  const canAdd = imageValues.length < maxCount

  return (
    <div>
      {canAdd ? (
        <ImageUploadInput
          id={`var-${variable.key}`}
          label={maxCount > 1 ? `添加图片 ${imageValues.length}/${maxCount}` : '添加图片'}
          multiple={maxCount > 1}
          onFilesChange={onImageSelect}
        />
      ) : (
        <p className="text-base text-text-muted">已选 {imageValues.length}/{maxCount} 张</p>
      )}
      {imageValues.length > 0 ? (
        <div className="mt-2 grid grid-cols-3 gap-2">
          {imageValues.map((image) => (
            <div className="group relative aspect-square overflow-hidden rounded-lg bg-fill" key={image.id} title={image.name}>
              <img alt={image.name} className="size-full object-cover" src={image.imageUrl} />
              <button
                className="absolute right-1 top-1 flex size-5 cursor-pointer items-center justify-center rounded-full bg-black/50 text-white opacity-0 transition-opacity group-hover:opacity-100"
                type="button"
                onClick={() => onImageRemove(image.id)}
              >
                <X className="size-3" strokeWidth={2} />
              </button>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  )
}

export function buildPromptVariableValues(
  variables: PromptVariable[],
  textValues: Record<string, string>,
  imageValues: Record<string, PromptImageInputValue[]>,
): PromptVariableValue[] {
  return variables.map((variable) => {
    if (variable.type === 'image') {
      return {
        key: variable.key,
        type: 'image',
        imageIds: (imageValues[variable.key] ?? []).map((image) => image.id),
      }
    }

    return {
      key: variable.key,
      type: 'text',
      value: textValues[variable.key] ?? '',
    }
  })
}

export async function createPromptImageInputValue(file: File): Promise<PromptImageInputValue | null> {
  const filePath = window.api.getPathForFile(file)

  if (!filePath) {
    return null
  }

  return {
    id: crypto.randomUUID(),
    name: file.name,
    path: filePath,
    imageUrl: await readFileAsDataUrl(file),
  }
}

export function mapPromptImagesToReferences(
  imageInputs: Array<{ variableKey: string, imageIds: string[] }>,
  imageValues: Record<string, PromptImageInputValue[]>,
): ImageReference[] {
  const imagesById = new Map(Object.values(imageValues).flat().map((image) => [image.id, image]))
  const references: ImageReference[] = []

  for (const imageInput of imageInputs) {
    for (const imageId of imageInput.imageIds) {
      const image = imagesById.get(imageId)

      if (!image || references.some((reference) => reference.path === image.path)) {
        continue
      }

      references.push({
        id: image.id,
        kind: 'local-file',
        path: image.path,
        name: image.name,
        imageUrl: image.imageUrl,
      })
    }
  }

  return references.slice(0, MAX_IMAGE_REFERENCES)
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()

    reader.addEventListener('load', () => {
      resolve(String(reader.result))
    })
    reader.addEventListener('error', () => {
      reject(reader.error ?? new Error('读取图片失败'))
    })
    reader.readAsDataURL(file)
  })
}
