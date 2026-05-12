const dateTimeFormatter = new Intl.DateTimeFormat('zh-CN', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
})

export function formatDateTime(timestamp: number) {
  return dateTimeFormatter.format(timestamp)
}

export function formatDuration(durationMs: number) {
  const totalSeconds = Math.max(0, Math.floor(durationMs / 1000))
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  if (hours > 0) {
    return `${hours}小时${padTimePart(minutes)}分 ${padTimePart(seconds)}秒`
  }

  return `${minutes}分${padTimePart(seconds)}秒`
}

function padTimePart(value: number) {
  return String(value).padStart(2, '0')
}
