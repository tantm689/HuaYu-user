'use client'

import { useRef } from 'react'

// Reuses one Audio element per component instance instead of `new
// Audio(url).play()` on every click - the latter leaves the previous
// playback running uninterrupted, so repeated clicks stack up overlapping
// audio instead of replacing it.
export function usePlayAudio() {
  const audioRef = useRef<HTMLAudioElement | null>(null)

  return function play(url: string) {
    if (audioRef.current) {
      audioRef.current.pause()
    }
    const audio = new Audio(url)
    audioRef.current = audio
    audio.play()
  }
}
