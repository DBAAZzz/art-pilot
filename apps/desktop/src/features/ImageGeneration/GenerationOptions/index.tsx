import { OptionGroup, SegmentButton } from '../ImageGenerationPrimitives'

const aspectRatioOptions = ['1:1', '4:3', '3:2', '16:9', '9:16'] as const
const imageCountOptions = [1, 2, 4] as const

type AspectRatio = (typeof aspectRatioOptions)[number]
type ImageCount = (typeof imageCountOptions)[number]

export type { AspectRatio, ImageCount }

export function GenerationOptions({
  aspectRatio,
  onAspectRatioChange,
  imageCount,
  onImageCountChange,
}: {
  aspectRatio: AspectRatio
  onAspectRatioChange: (value: AspectRatio) => void
  imageCount: ImageCount
  onImageCountChange: (value: ImageCount) => void
}) {
  return (
    <div className="mt-5 grid w-full gap-4">
      <OptionGroup
        activeIndex={aspectRatioOptions.indexOf(aspectRatio)}
        label="画面比例"
        optionCount={aspectRatioOptions.length}
      >
        {aspectRatioOptions.map((option) => (
          <SegmentButton
            key={option}
            active={aspectRatio === option}
            label={option}
            onClick={() => onAspectRatioChange(option)}
          />
        ))}
      </OptionGroup>

      <OptionGroup
        activeIndex={imageCountOptions.indexOf(imageCount)}
        label="生成张数"
        optionCount={imageCountOptions.length}
      >
        {imageCountOptions.map((option) => (
          <SegmentButton
            key={option}
            active={imageCount === option}
            label={String(option)}
            onClick={() => onImageCountChange(option)}
          />
        ))}
      </OptionGroup>
    </div>
  )
}
