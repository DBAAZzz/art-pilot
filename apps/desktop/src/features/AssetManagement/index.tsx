import { Images } from 'lucide-react'

export function AssetManagementPage() {
  return (
    <section className="col-span-2 flex min-h-0 items-center justify-center rounded-lg bg-background-solid px-6 py-6">
      <div className="flex max-w-sm flex-col items-center text-center">
        <div className="mb-4 flex size-12 items-center justify-center rounded-lg bg-fill-hover text-text-strong">
          <Images className="size-5" strokeWidth={1.8} />
        </div>
        <h1 className="text-xl font-semibold text-text-strong">资产管理</h1>
        <p className="mt-2 text-base text-text-muted">这里将用于管理生成结果、参考图和项目资产。</p>
      </div>
    </section>
  )
}
