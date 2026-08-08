'use client'

import { useRef, useState } from 'react'
import type { Dialogue } from '@/lib/db/types'

export default function ListenTab({ dialogue }: { dialogue: Dialogue }) {
  const [currentLineId, setCurrentLineId] = useState<string | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  function playLine(lineId: string, audioUrl: string | null) {
    if (!audioUrl) return
    audioRef.current?.pause()
    const audio = new Audio(audioUrl)
    audioRef.current = audio
    setCurrentLineId(lineId)
    audio.onended = () => setCurrentLineId((current) => (current === lineId ? null : current))
    audio.play()
  }

  return (
    <div className="flex flex-col gap-4">
      {dialogue.lines.map((line) => {
        const isCurrent = line.id === currentLineId
        return (
          <button
            key={line.id}
            type="button"
            onClick={() => playLine(line.id, line.audio_url)}
            disabled={!line.audio_url}
            className={`flex flex-col gap-2 rounded-card border p-5 text-left shadow-sm transition-all ${
              isCurrent ? 'border-brand-red/30 bg-white' : 'border-card-border bg-white/60'
            } ${line.audio_url ? 'cursor-pointer hover:-translate-y-0.5 hover:shadow-md' : 'cursor-default opacity-70'}`}
          >
            {line.speaker_zh && (
              <span className="text-xs font-bold uppercase tracking-wide text-ink-faint">{line.speaker_zh}</span>
            )}
            <span className="font-han-title text-2xl font-bold text-ink">{line.text_zh}</span>
            {line.pinyin && <span className="font-medium tracking-wide text-brand-gold">{line.pinyin}</span>}
            {line.translation_vi && <span className="text-sm text-ink-muted">{line.translation_vi}</span>}
          </button>
        )
      })}
    </div>
  )
}
