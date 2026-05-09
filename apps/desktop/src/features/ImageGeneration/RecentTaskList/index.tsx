import type { RecentTask } from '..'

import { GeneratedImageResult } from '@/components/GeneratedImageResult'

export function RecentTaskList({
  tasks,
  onCancelTask,
}: {
  tasks: RecentTask[]
  onCancelTask: (jobId: string) => void | Promise<void>
}) {
  async function openImageLocation(imagePath?: string) {
    if (!imagePath) {
      return
    }

    try {
      await window.api.openImageFileLocation(imagePath)
    } catch (error) {
      console.error('Failed to open image file location:', error)
    }
  }

  return (
    <aside className="flex min-h-0 min-w-0 w-full flex-col overflow-hidden rounded-r-lg bg-fill-hover px-3 py-4">
      <div className="mb-3 flex items-center justify-center">
        <h2 className="text-base font-semibold text-text-strong">最近任务</h2>
      </div>

      {tasks.length === 0 ? (
        <div className="flex min-h-0 flex-1 items-center justify-center px-4 text-center">
          <p className="text-base text-text-muted">暂无最近任务</p>
        </div>
      ) : (
        <div className="art-pilot-scrollbar min-h-0 flex-1 space-y-2 overflow-y-auto">
          {tasks.map((task) => (
            <GeneratedImageResult
              className="w-full"
              key={task.jobId}
              aspectRatio={task.aspectRatio}
              completedAt={task.completedAt}
              count={task.count}
              createdAt={task.createdAt}
              error={task.error}
              images={task.images}
              message={task.message}
              prompt={task.prompt}
              references={task.references}
              status={task.status}
              onCancel={() => onCancelTask(task.jobId)}
              onOpenImageLocation={(image) => openImageLocation(image.imagePath)}
            />
          ))}
        </div>
      )}
    </aside>
  )
}
