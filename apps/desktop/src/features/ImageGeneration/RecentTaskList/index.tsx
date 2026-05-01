import type { RecentTask, TaskStatus } from '..'
import { Clock3, ImagePlus, Loader2 } from 'lucide-react'

export function RecentTaskList({ tasks }: { tasks: RecentTask[] }) {
  return (
    <aside className="flex min-h-0 flex-col rounded-lg p-4">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-base font-medium text-text-strong">最近任务</h2>
        <Clock3 className="size-4 text-text-muted" strokeWidth={1.8} />
      </div>

      {tasks.length === 0 ? (
        <div className="flex min-h-0 flex-1 items-center justify-center rounded-lg bg-background-subtle px-4 text-center">
          <p className="text-base text-text-muted">暂无最近任务</p>
        </div>
      ) : (
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto">
          {tasks.map((task) => (
            <RecentTaskItem key={task.jobId} task={task} />
          ))}
        </div>
      )}
    </aside>
  )
}

function RecentTaskItem({ task }: { task: RecentTask }) {
  const coverImage = task.images[0]

  return (
    <article className="rounded-lg bg-fill p-2">
      <div className="mb-2 aspect-[4/3] overflow-hidden rounded-lg bg-background-subtle">
        {coverImage ? (
          <img
            alt={task.prompt}
            className="size-full object-cover"
            src={coverImage.imageUrl}
          />
        ) : (
          <div className="flex size-full items-center justify-center text-base text-text-muted">
            {task.status === 'running' ? (
              <Loader2 className="size-5 animate-spin" strokeWidth={1.8} />
            ) : (
              <ImagePlus className="size-5" strokeWidth={1.8} />
            )}
          </div>
        )}
      </div>

      <div className="space-y-1">
        <div className="flex items-center justify-between gap-2">
          <span className="text-base font-medium text-text-strong">{getTaskStatusText(task.status)}</span>
          <span className="shrink-0 text-base text-text-muted">
            {task.images.length}/{task.count}
          </span>
        </div>
        <p className="line-clamp-2 text-base text-text-muted">{task.prompt}</p>
        {task.message && task.status === 'running' ? <p className="line-clamp-2 text-base text-text-muted">{task.message}</p> : null}
        <div className="flex items-center justify-between gap-2 text-base text-text-muted">
          <span>{task.aspectRatio}</span>
          <span>{formatTaskTime(task.createdAt)}</span>
        </div>
        {task.error ? <p className="line-clamp-2 text-base text-text-muted">{task.error}</p> : null}
      </div>
    </article>
  )
}

function getTaskStatusText(status: TaskStatus) {
  if (status === 'running') {
    return '生成中'
  }

  if (status === 'complete') {
    return '已完成'
  }

  if (status === 'cancelled') {
    return '已取消'
  }

  return '失败'
}

function formatTaskTime(timestamp: number) {
  return new Intl.DateTimeFormat('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(timestamp)
}
