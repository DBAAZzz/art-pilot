import { useCallback, useState } from 'react'

type UseLoadingStateOptions = {
  initialLoading?: boolean
}

export function useLoadingState(options: UseLoadingStateOptions = {}) {
  const [loading, setLoading] = useState(Boolean(options.initialLoading))
  const [error, setError] = useState<string | null>(null)

  const startLoading = useCallback(() => {
    setLoading(true)
    setError(null)
  }, [])

  const stopLoading = useCallback(() => {
    setLoading(false)
  }, [])

  const failLoading = useCallback((errorValue: unknown) => {
    setError(getErrorMessage(errorValue))
    setLoading(false)
  }, [])

  return {
    error,
    failLoading,
    loading,
    setError,
    setLoading,
    startLoading,
    stopLoading,
  }
}

export function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error)
}
