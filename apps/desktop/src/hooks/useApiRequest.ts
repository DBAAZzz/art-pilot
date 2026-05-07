import { useCallback, useEffect, useRef, useState } from 'react'

import { getErrorMessage, useLoadingState } from './useLoadingState'

type UseApiRequestOptions<TData> = {
  initialData: TData
  initialLoading?: boolean
}

export function useApiRequest<TData, TArgs extends unknown[]>(
  request: (...args: TArgs) => Promise<TData>,
  options: UseApiRequestOptions<TData>,
) {
  const [data, setData] = useState<TData>(options.initialData)
  const {
    error,
    failLoading,
    loading,
    setError,
    setLoading,
    startLoading,
    stopLoading,
  } = useLoadingState({ initialLoading: options.initialLoading })
  const requestIdRef = useRef(0)
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true

    return () => {
      mountedRef.current = false
    }
  }, [])

  const execute = useCallback(async (...args: TArgs) => {
    const requestId = requestIdRef.current + 1
    requestIdRef.current = requestId
    startLoading()

    try {
      const result = await request(...args)

      if (!mountedRef.current || requestId !== requestIdRef.current) {
        return undefined
      }

      setData(result)
      stopLoading()
      return result
    } catch (error) {
      if (!mountedRef.current || requestId !== requestIdRef.current) {
        return undefined
      }

      failLoading(error)
      return undefined
    }
  }, [failLoading, request, startLoading, stopLoading])

  const setRequestError = useCallback((error: unknown) => {
    setError(getErrorMessage(error))
  }, [setError])

  return {
    data,
    error,
    execute,
    loading,
    setData,
    setError: setRequestError,
    setLoading,
  }
}
