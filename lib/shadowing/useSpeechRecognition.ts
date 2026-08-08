'use client'

import { useCallback, useRef, useState } from 'react'

export interface UseSpeechRecognitionResult {
  isSupported: boolean
  isListening: boolean
  start: () => void
  stop: () => void
}

// Stale-closure hazard (hit twice in the prior implementation attempt):
// onResult/onEnd are captured by the recognition instance's event handlers
// at the time `start()` runs, so they must always read the LATEST callback,
// not the one from whichever render created the recognition instance. Refs
// sidestep this.
//
// `onEnd` fires from `recognition.onend`, which the Web Speech API spec
// guarantees always runs (after `onresult` or `onerror`, whichever the
// browser reaches first). Callers should defer any grading/consumption of
// the recognized transcript until `onEnd` fires, rather than assuming
// `onResult` has already run by the time they need the transcript -
// `onresult` is asynchronous and often arrives after the user has already
// clicked "stop" elsewhere in the UI.
export function useSpeechRecognition(
  onResult: (transcript: string) => void,
  onEnd?: () => void
): UseSpeechRecognitionResult {
  const onResultRef = useRef(onResult)
  onResultRef.current = onResult

  const onEndRef = useRef(onEnd)
  onEndRef.current = onEnd

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
      onEndRef.current?.()
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
