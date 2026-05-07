import type { ImageGenerationRequest } from '@art-pilot/shared'
import {
  findCodexExecutable,
  runCodexExecStreaming,
} from '../utils/codexCli'
import type { CodexStreamingCallbacks, CodexStreamingChildProcess } from '../utils/codexCli'
import { createLogger } from '../utils/logger'

const logger = createLogger('art-pilot:image:codex-provider')

export class CodexImageProvider {
  async generateStreaming(
    request: ImageGenerationRequest,
    callbacks: CodexStreamingCallbacks,
  ): Promise<{
    childProcess: CodexStreamingChildProcess
    startedAt: number
  }> {
    logger.info(
      'preparing streaming image generation: count=%s size=%s references=%d promptLength=%d',
      String(request.count ?? 'default'),
      request.size ?? 'default',
      request.references?.length ?? 0,
      request.prompt.length,
    )

    const executablePath = await findCodexExecutable()
    const imageTimeoutMs = 600000 // 单张图片限制生图时间最长为 10 minutes

    if (!executablePath) {
      logger.error('cannot start streaming image generation: codex executable not found')
      throw new Error('未找到 codex 命令')
    }

    const startedAt = Date.now()
    const prompt = buildImageGenerationPrompt(request)
    logger.info(
      'starting codex streaming image generation: executable=%s promptLength=%d references=%d',
      executablePath,
      prompt.length,
      request.references?.length ?? 0,
    )

    const childProcess = runCodexExecStreaming(executablePath, prompt, callbacks, {
      sandbox: 'workspace-write',
      images: request.references?.map((reference) => reference.path),
      startupTimeoutMs: 30000,
      inactivityTimeoutMs: normalizeImageCount(request.count) * imageTimeoutMs,
      absoluteTimeoutMs: normalizeImageCount(request.count) * imageTimeoutMs,
    })
    logger.info('codex streaming process spawned: pid=%s', String(childProcess.pid ?? 'unknown'))

    return {
      childProcess,
      startedAt,
    }
  }
}

function buildImageGenerationPrompt(request: ImageGenerationRequest) {
  const count = normalizeImageCount(request.count)
  const lines = [
    '请使用 ImageGen skill 根据以下提示生成图片。',
    `必须生成 ${count} 张图片。`,
    count > 1 ? '这些图片属于同一个连续上下文，请保持角色、风格、世界观一致。' : undefined,
    request.size ? `图片尺寸：${request.size}` : undefined,
    request.references?.length ? `参考图数量：${request.references.length}` : undefined,
  ]

  const imageDescription = buildImageVariableDescription(request)

  if (imageDescription) {
    lines.push('', imageDescription)
  }

  lines.push(
    '如果图片文件被保存，请在最终回答回复ok。',
    '如果当前 Codex CLI 环境没有 ImageGen 能力，请直接说明无法生成图片。',
    '',
    '用户提示：',
    request.prompt,
  )

  return lines.filter(Boolean).join('\n')
}

const IMAGE_ROLE_LABELS: Record<string, string> = {
  reference: '参考图',
  character: '角色参考',
  style: '风格参考',
  composition: '构图参考',
}

function buildImageVariableDescription(request: ImageGenerationRequest): string | undefined {
  const bindings = request.promptTemplateUse?.imageBindings

  if (!bindings || bindings.length === 0) {
    return undefined
  }

  const totalReferenceCount = request.references?.length ?? 0
  const templateImageCount = bindings.reduce((sum, b) => sum + b.count, 0)
  const lines: string[] = ['输入图片说明：']

  for (const binding of bindings) {
    const roleLabel = binding.role ? IMAGE_ROLE_LABELS[binding.role] ?? binding.role : binding.variableLabel

    for (let i = 0; i < binding.count; i++) {
      const index = binding.startIndex + i
      lines.push(`- 第 ${index} 张输入图：变量 ${binding.variableKey}（${roleLabel}）`)
    }
  }

  for (let i = 0; i < totalReferenceCount - templateImageCount; i++) {
    lines.push(`- 第 ${templateImageCount + i + 1} 张输入图：额外参考图 ${i + 1}`)
  }

  lines.push('', '请严格按上述映射理解输入图片，不要混淆变量用途。')

  return lines.join('\n')
}

function normalizeImageCount(count: number | undefined) {
  if (typeof count !== 'number' || !Number.isFinite(count)) {
    return 1
  }

  return Math.min(Math.max(Math.trunc(count), 1), 8)
}
