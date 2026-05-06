/**
 * 生成结果图片在内存 registry 中的键，格式为 jobId:index。
 */
export type GeneratedImageKey = `${string}:${number}`

/**
 * 参考图在内存 registry 中的键，格式为 jobId:reference:index。
 */
export type ReferenceImageKey = `${string}:reference:${number}`

/**
 * artpilot-image 协议解析后的受控图片 URL。
 *
 * generated 对应 artpilot-image://generated/<jobId>/<index>。
 * reference 对应 artpilot-image://reference/<jobId>/<index>。
 * asset-thumbnail 对应 artpilot-image://asset-thumbnail/<imageId>。
 * asset-original 对应 artpilot-image://asset-original/<imageId>。
 */
export type ImageProtocolUrl =
  | {
      /** 图片类别：生成结果图片。 */
      kind: 'generated'
      /** 图片所属的 Art Pilot 任务 ID。 */
      jobId: string
      /** 图片在任务内的序号。 */
      index: number
    }
  | {
      /** 图片类别：参考图。 */
      kind: 'reference'
      /** 参考图所属的 Art Pilot 任务 ID。 */
      jobId: string
      /** 参考图在任务内的序号。 */
      index: number
    }
  | {
      /** 图片类别：资产缩略图。 */
      kind: 'asset-thumbnail'
      /** 图片资产 ID。 */
      imageId: string
    }
  | {
      /** 图片类别：资产原图。 */
      kind: 'asset-original'
      /** 图片资产 ID。 */
      imageId: string
    }
