import { MessageSquareText } from 'lucide-react'

export function PromptManagementPage() {
  return (
    <section className="col-span-2 flex min-h-0 items-center justify-center rounded-lg bg-background-solid px-6 py-6">
      <div className="flex max-w-sm flex-col items-center text-center">
        <div className="mb-4 flex size-12 items-center justify-center rounded-lg bg-fill-hover text-text-strong">
          <MessageSquareText className="size-5" strokeWidth={1.8} />
        </div>
        <h1 className="text-xl font-semibold text-text-strong">提示词管理</h1>
        <p className="mt-2 text-base text-text-muted">这里将用于保存、整理和复用常用提示词。</p>
      </div>
    </section>
  )
}
