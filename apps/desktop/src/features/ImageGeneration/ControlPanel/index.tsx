import { SlidersHorizontal } from 'lucide-react'

import { promptText } from '../data'
import type { SettingSelectOption } from './SettingSelect'
import { SettingSelect } from './SettingSelect'

const sizeOptions: SettingSelectOption[] = [
  { value: 'auto', label: '自动' },
  { value: 'square', label: '方形', meta: '1:1' },
  { value: 'portrait', label: '竖版', meta: '3:4' },
  { value: 'story', label: '故事版', meta: '9:16' },
  { value: 'landscape', label: '横版', meta: '4:3' },
  { value: 'wide', label: '宽屏', meta: '16:9' },
]

export function ControlPanel() {
  return (
    <div className="flex min-h-0 flex-col gap-4">
      <section className="flex flex-col gap-2.5">
        <label className="text-base font-medium text-text-strong">Prompt</label>
        <div className="relative rounded-[12px] border border-slate-200/70 bg-white/88 shadow-[inset_0_1px_2px_rgba(15,23,42,0.035),0_0_0_1px_rgba(255,255,255,0.72)] transition-[border-color,box-shadow,background-color] duration-150 focus-within:border-[#0a84ff]/70 focus-within:bg-white focus-within:shadow-[0_0_0_4px_rgba(10,132,255,0.18),0_0_0_1px_rgba(10,132,255,0.46),inset_0_1px_2px_rgba(15,23,42,0.035)]">
          <textarea
            readOnly
            value={promptText}
            className="h-[148px] resize-none border-0 bg-transparent px-3.5 pb-12 pt-3.5 text-base leading-5 text-text-strong shadow-none outline-none focus-visible:border-0 focus-visible:ring-0"
          />
          <span className="absolute bottom-3 left-3.5 text-[11px] text-text-muted">36 / 2000</span>
        </div>
      </section>

      <section className="flex flex-col gap-2.5">
        <div className="text-base font-semibold text-text-strong">模型与设置</div>
        <div className="rounded-[12px] border border-slate-200/70 bg-white/72 shadow-[inset_0_1px_2px_rgba(15,23,42,0.025),0_0_0_1px_rgba(255,255,255,0.68)]">
          <div className="flex flex-col gap-3 p-3.5">
            <SettingSelect label="模型" value="GPT-4o Image" />
            <SettingSelect
              label="尺寸"
              value="landscape"
              options={sizeOptions}
              menuTitle="选择图片宽高比"
              menuClassName="w-[260px]"
            />
            <SettingSelect label="质量" value="高质量" />
            <SettingSelect label="风格" value="写实照片" />
          </div>
        </div>
      </section>

      <div className="grid grid-cols-[1fr_56px] gap-2">
        <button className="h-12 rounded-[10px] bg-[#3f49f5] text-sm font-semibold shadow-[0_10px_20px_rgba(63,73,245,0.18)] hover:bg-[#3842df]">
          生成（8）
        </button>
        <button variant="outline" className="h-12 rounded-[10px] border-slate-200/70 bg-white/70 text-text-strong">
          <SlidersHorizontal className="size-4.5" />
        </button>
      </div>
    </div>
  )
}
