'use client'

import { useCallback, useRef, useState } from 'react'

export interface UseSpeechRecognitionResult {
  isSupported: boolean
  isListening: boolean
  start: () => void
  stop: () => void
}

const GRADING_TIMEOUT_MS = 10_000

// Stale-closure hazard (hit twice in the prior implementation attempt):
// onResult/onEnd/onTimeout are captured by the recognition instance's event
// handlers at the time `start()` runs, so they must always read the LATEST
// callback, not the one from whichever render created the recognition
// instance. Refs sidestep this.
//
// `onEnd` fires from `recognition.onend`, which the Web Speech API spec
// guarantees always runs (after `onresult` or `onerror`, whichever the
// browser reaches first) - EXCEPT when the browser is still processing a
// long captured audio buffer (e.g. the user kept talking well past the
// target sentence after clicking "stop"), which can delay `onend`
// indefinitely in practice. The timeout below is a fallback for that case:
// if `onend` hasn't fired within GRADING_TIMEOUT_MS of calling stop(), we
// force the same "done" transition ourselves (via onEnd) so the caller's
// UI never hangs, and separately signal onTimeout so the caller can show an
// error instead of grading a possibly-truncated transcript.
export function useSpeechRecognition(
  onResult: (transcript: string) => void,
  onEnd?: () => void,
  onTimeout?: () => void
): UseSpeechRecognitionResult {
  const onResultRef = useRef(onResult)
  onResultRef.current = onResult

  const onEndRef = useRef(onEnd)
  onEndRef.current = onEnd

  const onTimeoutRef = useRef(onTimeout)
  onTimeoutRef.current = onTimeout

  const recognitionRef = useRef<any>(null)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const hasEndedRef = useRef(false)
  const [isListening, setIsListening] = useState(false)

  const SpeechRecognitionCtor =
    typeof window !== 'undefined'
      ? (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
      : undefined

  const isSupported = Boolean(SpeechRecognitionCtor)

  const clearGradingTimeout = () => {
    if (timeoutRef.current !== null) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
  }

  const start = useCallback(() => {
    if (!SpeechRecognitionCtor) return

    const recognition = new SpeechRecognitionCtor()
    recognitionRef.current = recognition
    recognition.lang = 'zh-TW'
    recognition.continuous = false
    recognition.interimResults = false
    hasEndedRef.current = false

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript
      onResultRef.current(transcript)
    }

    recognition.onerror = () => {
      setIsListening(false)
    }

    recognition.onend = () => {
      hasEndedRef.current = true
      clearGradingTimeout()
      setIsListening(false)
      onEndRef.current?.()
    }

    setIsListening(true)
    recognition.start()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- clearGradingTimeout is stable across renders (closes only over refs)
  }, [SpeechRecognitionCtor])

  const stop = useCallback(() => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop()
      } catch {
        // recognition already stopped
      }
    }
    setIsListening(false)

    if (hasEndedRef.current) return

    clearGradingTimeout()
    timeoutRef.current = setTimeout(() => {
      timeoutRef.current = null
      onTimeoutRef.current?.()
      onEndRef.current?.()
    }, GRADING_TIMEOUT_MS)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- clearGradingTimeout is stable across renders (closes only over refs)
  }, [])

  return { isSupported, isListening, start, stop }
}
