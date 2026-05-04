import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from '@/components/Select'

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
    <div className="flex min-w-0 items-center gap-1.5">
      <Select
        value={aspectRatio}
        onValueChange={(value) => onAspectRatioChange(value as AspectRatio)}
      >
        <SelectTrigger
          className="h-8 w-16 border-transparent bg-transparent pl-2.5 pr-2 text-base font-normal text-text-muted hover:border-transparent hover:bg-fill-hover"
          style={{
            fontSize: 'var(--text-base)',
            lineHeight: 'var(--text-base--line-height)',
          }}
        >
          <span className="text-text-strong">{aspectRatio}</span>
        </SelectTrigger>
        <SelectContent align="start" className="min-w-[120px]" menuTitle="画面比例">
          {aspectRatioOptions.map((option) => (
            <SelectItem className="text-base font-normal leading-5" key={option} value={option}>
              {option}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={String(imageCount)}
        onValueChange={(value) => onImageCountChange(Number(value) as ImageCount)}
      >
        <SelectTrigger
          className="h-8 w-14 border-transparent bg-transparent pl-2.5 pr-2 text-base font-normal text-text-muted hover:border-transparent hover:bg-fill-hover"
          style={{
            fontSize: 'var(--text-base)',
            lineHeight: 'var(--text-base--line-height)',
          }}
        >
          <span className="text-text-strong">{imageCount}张</span>
        </SelectTrigger>
        <SelectContent align="start" className="min-w-[120px]" menuTitle="生成张数">
          {imageCountOptions.map((option) => (
            <SelectItem className="text-base font-normal leading-5" key={option} value={String(option)}>
              {option}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
