'use client'

import { useCallback, useRef, useState } from 'react'

export interface UseSpeechRecognitionResult {
  isSupported: boolean
  isListening: boolean
  start: () => void
  stop: () => void
}

// Stale-closure hazard (hit twice in the prior implementation attempt):
// onResult is captured by `recognition.onresult` at the time `start()` runs,
// so it must always read the LATEST callback, not the one from whichever
// render created the recognition instance. A ref sidesteps this.
export function useSpeechRecognition(
  onResult: (transcript: string) => void
): UseSpeechRecognitionResult {
  const onResultRef = useRef(onResult)
  onResultRef.current = onResult

  const recognitionRef = useRef<any>(null)
  const [isListening, setIsListening] = useState(false)

  const SpeechRecognitionCtor =
    typeof window !== 'undefined'
      ? (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
      : undefined

  const isSupported = Boolean(SpeechRecognitionCtor)

  const start = useCallback(() => {
    if (!SpeechRecognitionCtor) return

    const recognition = new SpeechRecognitionCtor()
    recognitionRef.current = recognition
    recognition.lang = 'zh-TW'
    recognition.continuous = false
    recognition.interimResults = false

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript
      onResultRef.current(transcript)
    }

    recognition.onerror = () => {
      setIsListening(false)
    }

    recognition.onend = () => {
      setIsListening(false)
    }

    setIsListening(true)
    recognition.start()
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
  }, [])

  return { isSupported, isListening, start, stop }
}
