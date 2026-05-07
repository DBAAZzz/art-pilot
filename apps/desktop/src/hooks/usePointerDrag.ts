import { useCallback, useEffect, useRef, useState } from 'react'
import type React from 'react'

type PointerDragStart<TState> = {
  event: React.PointerEvent<HTMLElement>
  state: TState
}

type UsePointerDragOptions<TState> = {
  cursor?: string
  onDrag: (event: PointerEvent, state: TState) => void
  onEnd?: (state: TState) => void
  userSelect?: string
}

export function usePointerDrag<TState>({
  cursor,
  onDrag,
  onEnd,
  userSelect,
}: UsePointerDragOptions<TState>) {
  const dragStateRef = useRef<TState | null>(null)
  const previousBodyCursorRef = useRef<string | null>(null)
  const previousBodyUserSelectRef = useRef<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)

  const clearBodyDragStyle = useCallback(() => {
    if (previousBodyCursorRef.current !== null) {
      document.body.style.cursor = previousBodyCursorRef.current
      previousBodyCursorRef.current = null
    }

    if (previousBodyUserSelectRef.current !== null) {
      document.body.style.userSelect = previousBodyUserSelectRef.current
      previousBodyUserSelectRef.current = null
    }
  }, [])

  const endDrag = useCallback(() => {
    const dragState = dragStateRef.current

    if (!dragState) {
      clearBodyDragStyle()
      return
    }

    dragStateRef.current = null
    setIsDragging(false)
    clearBodyDragStyle()
    onEnd?.(dragState)
  }, [clearBodyDragStyle, onEnd])

  const startDrag = useCallback(({ event, state }: PointerDragStart<TState>) => {
    event.preventDefault()
    dragStateRef.current = state
    setIsDragging(true)

    if (cursor !== undefined) {
      previousBodyCursorRef.current = document.body.style.cursor
      document.body.style.cursor = cursor
    }

    if (userSelect !== undefined) {
      previousBodyUserSelectRef.current = document.body.style.userSelect
      document.body.style.userSelect = userSelect
    }
  }, [cursor, userSelect])

  useEffect(() => {
    function handlePointerMove(event: PointerEvent) {
      const dragState = dragStateRef.current

      if (!dragState) {
        return
      }

      onDrag(event, dragState)
    }

    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', endDrag)
    window.addEventListener('pointercancel', endDrag)

    return () => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', endDrag)
      window.removeEventListener('pointercancel', endDrag)
      dragStateRef.current = null
      setIsDragging(false)
      clearBodyDragStyle()
    }
  }, [clearBodyDragStyle, endDrag, onDrag])

  return {
    isDragging,
    startDrag,
  }
}
