import { Plus, X } from 'lucide-react'
import type React from 'react'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import {
  extractPromptVariableKeys,
  findUndefinedPromptVariables,
  getImageVariableMaxCount,
  normalizePromptVariableKey,
  validatePromptVariableKey,
} from '@art-pilot/shared'
import type { PromptImportDraft, PromptTemplateDraft, PromptVariable } from '@art-pilot/shared'

import { Button } from '@/components/Button'
import { Checkbox } from '@/components/Checkbox'
import { Input } from '@/components/Input'
import { PromptContentEditor } from '@/components/PromptContentEditor'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from '@/components/Select'
import { useLoadingState } from '@/hooks/useLoadingState'
import { useAppHeader } from '@/layout/AppLayout/headerContext'
import { cn } from '@/lib/utils'

const PROMPT_TEMPLATE_EDITOR_FORM_ID = 'prompt-template-editor-form'

export function PromptTemplateEditorPage() {
  const navigate = useNavigate()
  const { templateId } = useParams()
  const { setHeaderOptions } = useAppHeader()
  const [fillUrl, setFillUrl] = useState('')
  const [sourceDraft, setSourceDraft] = useState<PromptImportDraft | null>(null)
  const fillState = useLoadingState()
  const loadState = useLoadingState()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [content, setContent] = useState('')
  const [categories, setCategories] = useState('')
  const [previewImages, setPreviewImages] = useState<PromptTemplateDraft['previewImages']>([])
  const [variables, setVariables] = useState<PromptVariable[]>([])
  const saveState = useLoadingState()
  const detectedKeys = useMemo(() => extractPromptVariableKeys(content), [content])
  const undefinedKeys = useMemo(() => findUndefinedPromptVariables(content, variables), [content, variables])
  const promptSuggestions = useMemo(() => {
    const suggestionsByKey = new Map<string, { key: string, label: string, type: 'text' | 'image' }>()

    for (const variable of variables) {
      suggestionsByKey.set(variable.key, {
        key: variable.key,
        label: variable.label,
        type: variable.type,
      })
    }

    for (const key of detectedKeys) {
      if (!suggestionsByKey.has(key)) {
        suggestionsByKey.set(key, {
          key,
          label: key,
          type: 'text',
        })
      }
    }

    if (!suggestionsByKey.has('name')) {
      suggestionsByKey.set('name', {
        key: 'name',
        label: 'name',
        type: 'text',
      })
    }

    return [...suggestionsByKey.values()]
  }, [detectedKeys, variables])
  const isEditing = Boolean(templateId)
  const canSave = title.trim().length > 0 && content.trim().length > 0 && undefinedKeys.length === 0 && !saveState.loading && !loadState.loading

  useEffect(() => {
    setHeaderOptions({
      showBackButton: true,
      onBack: () => navigate('/prompts'),
      right: (
        <Button
          className="gap-1.5 bg-text-strong text-background-solid hover:bg-text-muted"
          disabled={!canSave}
          form={PROMPT_TEMPLATE_EDITOR_FORM_ID}
          type="submit"
        >
          <Plus className="size-3.5" strokeWidth={1.8} />
          {saveState.loading ? '保存中...' : isEditing ? '保存修改' : '保存模板'}
        </Button>
      ),
    })

    return () => setHeaderOptions({})
  }, [canSave, isEditing, navigate, saveState.loading, setHeaderOptions])

  useEffect(() => {
    if (!templateId) {
      return
    }

    void loadTemplate(templateId)
  }, [templateId])

  async function loadTemplate(targetTemplateId: string) {
    loadState.startLoading()
    saveState.setError(null)

    try {
      const template = await window.api.getPromptTemplateById(targetTemplateId)

      if (!template) {
        throw new Error('提示词模板不存在')
      }

      setSourceDraft(template)
      setTitle(template.title)
      setDescription(template.description ?? '')
      setContent(template.content)
      setCategories(template.categories.join(', '))
      setPreviewImages(template.previewImages)
      setVariables(template.variables)
      setFillUrl(template.sourceUrl ?? '')
    } catch (error) {
      loadState.failLoading(error)
    } finally {
      loadState.stopLoading()
    }
  }

  async function fillFromUrl() {
    fillState.startLoading()
    saveState.setError(null)

    try {
      const draft = await window.api.fillPromptTemplateFromUrl(fillUrl)
      setSourceDraft(draft)
      setTitle(draft.title)
      setDescription(draft.description ?? '')
      setContent(draft.content)
      setCategories(draft.categories.join(', '))
      setPreviewImages(draft.previewImages)
    } catch (error) {
      fillState.failLoading(error)
      return
    } finally {
      fillState.stopLoading()
    }
  }

  function addMissingVariables() {
    const existingKeys = new Set(variables.map((variable) => variable.key))
    const missingVariables: PromptVariable[] = detectedKeys
      .map(normalizePromptVariableKey)
      .filter((key) => validatePromptVariableKey(key) && !existingKeys.has(key))
      .map((key) => ({
        key,
        label: key,
        type: 'text',
        required: true,
      }))

    if (missingVariables.length === 0) {
      return
    }

    setVariables((currentVariables) => [...currentVariables, ...missingVariables])
  }

  function addVariable() {
    const nextKey = createNextVariableKey(variables)
    setVariables((currentVariables) => [
      ...currentVariables,
      {
        key: nextKey,
        label: nextKey,
        type: 'text',
        required: true,
      },
    ])
  }

  function updateVariable(index: number, nextVariable: PromptVariable) {
    setVariables((currentVariables) => currentVariables.map((variable, variableIndex) => (
      variableIndex === index ? nextVariable : variable
    )))
  }

  function removeVariable(index: number) {
    setVariables((currentVariables) => currentVariables.filter((_, variableIndex) => variableIndex !== index))
  }

  function removePreviewImage(index: number) {
    setPreviewImages((currentImages) => currentImages.filter((_, imageIndex) => imageIndex !== index))
  }

  async function submitForm(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!canSave) {
      return
    }

    saveState.startLoading()

    try {
      const draft = {
        title,
        description,
        content,
        sourceSite: sourceDraft?.sourceSite ?? 'manual',
        sourceUrl: sourceDraft?.sourceUrl,
        sourceAuthor: sourceDraft?.sourceAuthor,
        originalSourceUrl: sourceDraft?.originalSourceUrl,
        originalLanguage: sourceDraft?.originalLanguage,
        categories: parseCategoryInput(categories),
        variables,
        previewImages,
      }

      if (templateId) {
        await window.api.updatePromptTemplate({
          id: templateId,
          ...draft,
        })
      } else {
        await window.api.savePromptTemplate(draft)
      }
      void navigate('/prompts')
    } catch (error) {
      saveState.failLoading(error)
      return
    } finally {
      saveState.stopLoading()
    }
  }

  return (
    <form
      className="col-span-2 flex h-full min-h-0 flex-col bg-background-solid"
      id={PROMPT_TEMPLATE_EDITOR_FORM_ID}
      onSubmit={submitForm}
    >
      <div className="art-pilot-scrollbar min-h-0 flex-1 space-y-6 overflow-y-auto px-6 pb-6">
        {loadState.loading ? <div className="text-base text-text-muted">正在读取模板...</div> : null}
        {loadState.error ? <div className="text-base text-text-error">{loadState.error}</div> : null}
        <div className="bg-background-subtle px-4 py-3">
          <label className="block">
            <span className="mb-1.5 block text-base font-semibold text-text-strong">从链接填充</span>
            <div className="flex max-w-5xl gap-2">
              <Input
                className="h-9 flex-1"
                placeholder="可选，粘贴 YouMind 提示词详情页链接"
                value={fillUrl}
                onChange={(event) => setFillUrl(event.target.value)}
              />
              <Button className="shrink-0" disabled={fillState.loading || !fillUrl.trim()} onClick={() => void fillFromUrl()}>
                {fillState.loading ? '读取中...' : '读取填充'}
              </Button>
            </div>
          </label>
          {fillState.error ? <p className="mt-2 text-base text-text-error">{fillState.error}</p> : null}
          {sourceDraft ? (
            <div className="mt-3 flex flex-wrap gap-2 text-base text-text-muted">
              <span className="rounded-md bg-fill-hover px-2 py-1">来源：{getSourceSiteLabel(sourceDraft.sourceSite)}</span>
              {sourceDraft.sourceAuthor ? <span className="rounded-md bg-fill-hover px-2 py-1">作者：{sourceDraft.sourceAuthor}</span> : null}
              {sourceDraft.previewImages.length > 0 ? <span className="rounded-md bg-fill-hover px-2 py-1">{sourceDraft.previewImages.length} 张预览图</span> : null}
              {sourceDraft.categories.length > 0 ? <span className="rounded-md bg-fill-hover px-2 py-1">{sourceDraft.categories.length} 个分类</span> : null}
            </div>
          ) : null}
        </div>

        <div className="max-w-6xl space-y-5">
          <label className="block">
            <span className="mb-1.5 block text-base font-semibold text-text-strong">标题</span>
            <Input
              className="h-9 w-full rounded-lg font-normal"
              placeholder="例如：产品海报背景生成"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
            />
          </label>

          <div className="grid grid-cols-2 gap-4">
            <label className="block">
              <span className="mb-1.5 block text-base font-semibold text-text-strong">分类</span>
              <Input
                className="h-9 w-full rounded-lg font-normal"
                placeholder="可选，用逗号分隔，例如：海报, 电商, 写实"
                value={categories}
                onChange={(event) => setCategories(event.target.value)}
              />
            </label>
          </div>

          <label className="block">
            <span className="mb-1.5 block text-base font-semibold text-text-strong">描述</span>
            <Input
              className="h-9 w-full rounded-lg font-normal"
              placeholder="可选，用来说明适用场景"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </label>
        </div>

        <label className="block">
          <span className="mb-2 block text-base font-semibold text-text-strong">提示词</span>
          <PromptContentEditor
            autoFocus
            placeholder="输入 Prompt，可使用 {{name}} 这样的变量"
            suggestions={promptSuggestions}
            value={content}
            onChange={setContent}
          />
        </label>

        {previewImages.length > 0 ? (
          <div>
            <div className="mb-2 text-base font-semibold text-text-strong">预览图</div>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
              {previewImages.map((image, index) => (
                <div className="group relative aspect-square overflow-hidden rounded-lg bg-fill" key={`${image.url}-${index}`}>
                  <img
                    alt={image.alt ?? `预览图 ${index + 1}`}
                    className="size-full object-cover"
                    src={image.url}
                  />
                  <button
                    aria-label={`删除预览图 ${index + 1}`}
                    className="absolute right-1.5 top-1.5 inline-flex size-7 items-center justify-center rounded-lg bg-background-solid/80 text-text-muted opacity-0 transition-colors group-hover:opacity-100 hover:bg-background-solid/90 hover:text-text-strong focus:opacity-100"
                    type="button"
                    onClick={() => removePreviewImage(index)}
                  >
                    <X className="size-4" strokeWidth={1.8} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        <div className="max-w-6xl rounded-lg bg-background-subtle p-4">
          <div className="mb-2 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-text-strong">变量</h2>
              <p className="text-base text-text-muted">
                {detectedKeys.length > 0 ? `检测到 ${detectedKeys.length} 个占位符` : '在 Prompt 中输入 {{name}} 后可以定义变量'}
              </p>
            </div>
            <div className="flex shrink-0 gap-2">
              {undefinedKeys.length > 0 ? (
                <Button variant="ghost" onClick={addMissingVariables}>
                  补齐变量
                </Button>
              ) : null}
              <Button className="gap-1.5" onClick={addVariable}>
                <Plus className="size-3.5" strokeWidth={1.8} />
                添加变量
              </Button>
            </div>
          </div>

          {undefinedKeys.length > 0 ? (
            <p className="mb-3 rounded-lg bg-fill-hover px-3 py-2 text-base text-text-error">
              未定义变量：{undefinedKeys.join(', ')}
            </p>
          ) : null}

          {variables.length > 0 ? (
            <div className="overflow-x-auto">
              <div className="grid min-w-[920px] grid-cols-[minmax(130px,0.9fr)_minmax(150px,1fr)_116px_84px_minmax(170px,1fr)_96px_32px] gap-2 border-b border-border px-2 pb-1 text-base font-semibold text-text-muted">
                <span>变量名</span>
                <span>显示名称</span>
                <span>类型</span>
                <span>必填</span>
                <span>默认值 / 用途</span>
                <span>数量</span>
                <span />
              </div>
              {variables.map((variable, index) => (
                <PromptVariableEditor
                  index={index}
                  key={index}
                  variable={variable}
                  onRemove={() => removeVariable(index)}
                  onUpdate={(nextVariable) => updateVariable(index, nextVariable)}
                />
              ))}
            </div>
          ) : (
            <div className="rounded-lg bg-fill px-3 py-2 text-base text-text-muted">
              暂无变量。你可以先在 Prompt 中写入 {'{{name}}'}，再点击补齐变量。
            </div>
          )}
        </div>
        {saveState.error ? <div className="max-w-6xl text-base text-text-error">{saveState.error}</div> : null}
      </div>
    </form>
  )
}

function PromptVariableEditor({
  index,
  variable,
  onRemove,
  onUpdate,
}: {
  index: number
  variable: PromptVariable
  onRemove: () => void
  onUpdate: (variable: PromptVariable) => void
}) {
  const keyIsValid = validatePromptVariableKey(variable.key)

  function updateBase(update: Partial<Pick<PromptVariable, 'key' | 'label' | 'required' | 'description'>>) {
    onUpdate({
      ...variable,
      ...update,
      key: update.key !== undefined ? normalizePromptVariableKey(update.key) : variable.key,
    } as PromptVariable)
  }

  function updateType(type: PromptVariable['type']) {
    if (type === variable.type) {
      return
    }

    if (type === 'image') {
      onUpdate({
        key: variable.key,
        label: variable.label,
        type: 'image',
        required: variable.required,
        description: variable.description,
        maxCount: 1,
        role: 'reference',
      })
      return
    }

    onUpdate({
      key: variable.key,
      label: variable.label,
      type: 'text',
      required: variable.required,
      description: variable.description,
    })
  }

  return (
    <div className="grid min-w-[920px] grid-cols-[minmax(130px,0.9fr)_minmax(150px,1fr)_116px_84px_minmax(170px,1fr)_96px_32px] items-center gap-2 border-b border-border px-2 py-2">
      <Input
        aria-label={`变量 ${index + 1} 的变量名`}
        className={cn('h-8 w-full rounded-lg px-2 font-normal', keyIsValid ? '' : 'border-text-error text-text-error')}
        value={variable.key}
        onChange={(event) => updateBase({ key: event.target.value })}
      />
      <Input
        aria-label={`变量 ${index + 1} 的显示名称`}
        className="h-8 w-full rounded-lg px-2 font-normal"
        value={variable.label}
        onChange={(event) => updateBase({ label: event.target.value })}
      />
      <Select
        value={variable.type}
        onValueChange={(value) => updateType(value === 'image' ? 'image' : 'text')}
      >
        <SelectTrigger className="h-8 w-full justify-between pl-2 text-base font-normal leading-5">
          <span>{variable.type === 'image' ? '图片' : '文本'}</span>
        </SelectTrigger>
        <SelectContent align="start" className="min-w-[180px]" menuTitle="变量类型">
          <SelectItem className="text-base font-normal leading-5" value="text">
            文本
          </SelectItem>
          <SelectItem className="text-base font-normal leading-5" value="image">
            图片
          </SelectItem>
        </SelectContent>
      </Select>
      <Checkbox
        checked={variable.required}
        label="必填"
        onCheckedChange={(checked) => updateBase({ required: checked })}
      />

      {variable.type === 'text' ? (
        <Input
          aria-label={`变量 ${index + 1} 的默认值`}
          className="h-8 w-full rounded-lg px-2 font-normal"
          placeholder="默认值，可选"
          value={variable.defaultValue ?? ''}
          onChange={(event) => onUpdate({ ...variable, defaultValue: event.target.value || undefined })}
        />
      ) : (
        <Select
          value={variable.role ?? 'reference'}
          onValueChange={(value) => onUpdate({ ...variable, role: value as NonNullable<typeof variable.role> })}
        >
          <SelectTrigger className="h-8 w-full justify-between pl-2 text-base font-normal leading-5">
            <span>{getImageVariableRoleLabel(variable.role ?? 'reference')}</span>
          </SelectTrigger>
          <SelectContent align="start" className="min-w-[180px]" menuTitle="图片用途">
            <SelectItem className="text-base font-normal leading-5" value="reference">
              参考图
            </SelectItem>
            <SelectItem className="text-base font-normal leading-5" value="character">
              角色参考
            </SelectItem>
            <SelectItem className="text-base font-normal leading-5" value="style">
              风格参考
            </SelectItem>
            <SelectItem className="text-base font-normal leading-5" value="composition">
              构图参考
            </SelectItem>
          </SelectContent>
        </Select>
      )}

      {variable.type === 'image' ? (
        <Input
          aria-label={`变量 ${index + 1} 的最多图片数`}
          className="h-8 w-full rounded-lg px-2 font-normal"
          min={1}
          type="number"
          value={String(variable.maxCount ?? 1)}
          onChange={(event) => onUpdate({ ...variable, maxCount: getImageVariableMaxCount({ ...variable, maxCount: Number(event.target.value) || 1 }) })}
        />
      ) : (
        <span className="text-base text-text-muted">-</span>
      )}

      <button
        aria-label="删除变量"
        className="inline-flex size-8 items-center justify-center rounded-lg text-text-muted transition-colors hover:bg-fill-hover hover:text-text-strong"
        type="button"
        onClick={onRemove}
      >
        <X className="size-4" strokeWidth={1.8} />
      </button>
    </div>
  )
}

function createNextVariableKey(variables: PromptVariable[]) {
  const existingKeys = new Set(variables.map((variable) => variable.key))
  let index = variables.length + 1
  let key = `variable_${index}`

  while (existingKeys.has(key)) {
    index += 1
    key = `variable_${index}`
  }

  return key
}

function parseCategoryInput(value: string) {
  return [...new Set(value.split(/[,，]/).map((category) => category.trim()).filter(Boolean))]
}

function getImageVariableRoleLabel(role: NonNullable<Extract<PromptVariable, { type: 'image' }>['role']>) {
  const roleLabelMap: Record<typeof role, string> = {
    reference: '参考图',
    character: '角色参考',
    style: '风格参考',
    composition: '构图参考',
  }

  return roleLabelMap[role]
}

function getSourceSiteLabel(sourceSite: PromptTemplateDraft['sourceSite']) {
  if (sourceSite === 'youmind') {
    return 'YouMind'
  }

  return sourceSite === 'other' ? '其他' : '手动'
}
