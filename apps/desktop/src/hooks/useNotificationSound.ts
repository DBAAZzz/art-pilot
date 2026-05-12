import { useCallback, useEffect, useRef } from 'react'

type AudioContextConstructor = typeof AudioContext

export function useNotificationSound() {
  const audioContextRef = useRef<AudioContext | null>(null)

  const getAudioContext = useCallback(() => {
    if (audioContextRef.current) {
      return audioContextRef.current
    }

    const AudioContextClass = window.AudioContext ?? getWebkitAudioContext()

    if (!AudioContextClass) {
      return null
    }

    audioContextRef.current = new AudioContextClass()

    return audioContextRef.current
  }, [])

  const unlockAudioContext = useCallback(() => {
    const audioContext = getAudioContext()

    if (audioContext?.state === 'suspended') {
      void audioContext.resume()
    }
  }, [getAudioContext])

  useEffect(() => {
    window.addEventListener('pointerdown', unlockAudioContext, { once: true })
    window.addEventListener('keydown', unlockAudioContext, { once: true })

    return () => {
      window.removeEventListener('pointerdown', unlockAudioContext)
      window.removeEventListener('keydown', unlockAudioContext)
      void audioContextRef.current?.close()
      audioContextRef.current = null
    }
  }, [unlockAudioContext])

  const playCompletionSound = useCallback(async () => {
    const audioContext = getAudioContext()

    if (!audioContext) {
      return
    }

    if (audioContext.state === 'suspended') {
      await audioContext.resume()
    }

    const startedAt = audioContext.currentTime
    const finishedAt = startedAt + 0.22
    const oscillator = audioContext.createOscillator()
    const gain = audioContext.createGain()

    oscillator.type = 'sine'
    oscillator.frequency.setValueAtTime(660, startedAt)
    oscillator.frequency.exponentialRampToValueAtTime(880, startedAt + 0.12)

    gain.gain.setValueAtTime(0.0001, startedAt)
    gain.gain.exponentialRampToValueAtTime(0.16, startedAt + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.0001, finishedAt)

    oscillator.connect(gain)
    gain.connect(audioContext.destination)
    oscillator.start(startedAt)
    oscillator.stop(finishedAt)
  }, [getAudioContext])

  return {
    playCompletionSound,
  }
}

function getWebkitAudioContext(): AudioContextConstructor | undefined {
  return (window as Window & { webkitAudioContext?: AudioContextConstructor }).webkitAudioContext
}
