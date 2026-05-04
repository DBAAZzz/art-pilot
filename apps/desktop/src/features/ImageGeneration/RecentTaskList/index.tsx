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
    <aside className="flex min-h-0 flex-col rounded-lg p-4">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-xl font-semibold text-text-strong">最近任务</h2>
      </div>

      {tasks.length === 0 ? (
        <div className="flex min-h-0 flex-1 items-center justify-center rounded-lg bg-background-subtle px-4 text-center">
          <p className="text-base text-text-muted">暂无最近任务</p>
        </div>
      ) : (
        <div className="art-pilot-scrollbar min-h-0 flex-1 space-y-2 overflow-y-auto rounded-lg bg-background-subtle p-4">
          {tasks.map((task) => (
            <GeneratedImageResult
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
