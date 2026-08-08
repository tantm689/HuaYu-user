'use client'

import { useMemo, useRef, useState } from 'react'
import { Eye, EyeOff, Play } from 'lucide-react'
import type { Dialogue } from '@/lib/db/types'

const AVATAR_COLORS = [
  { bg: 'bg-brand-red', text: 'text-brand-cream-text' },
  { bg: 'bg-brand-gold', text: 'text-ink' },
] as const

function useSpeakerColors(lines: Dialogue['lines']) {
  return useMemo(() => {
    const map = new Map<string, (typeof AVATAR_COLORS)[number]>()
    let nextColorIndex = 0
    for (const line of lines) {
      if (!line.speaker_zh) continue
      if (!map.has(line.speaker_zh)) {
        map.set(line.speaker_zh, AVATAR_COLORS[nextColorIndex % AVATAR_COLORS.length])
        nextColorIndex += 1
      }
    }
    return map
  }, [lines])
}

export default function ListenTab({ dialogue }: { dialogue: Dialogue }) {
  const [currentLineId, setCurrentLineId] = useState<string | null>(null)
  const [showDetails, setShowDetails] = useState(true)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const speakerColors = useSpeakerColors(dialogue.lines)

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
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setShowDetails((prev) => !prev)}
          className="flex items-center gap-1.5 rounded-pill border border-card-border bg-white px-3 py-1.5 text-xs font-bold text-ink-faint transition-colors hover:text-brand-red"
        >
          {showDetails ? <EyeOff className="h-3.5 w-3.5" strokeWidth={2.5} /> : <Eye className="h-3.5 w-3.5" strokeWidth={2.5} />}
          {showDetails ? 'Ẩn pinyin & nghĩa' : 'Hiện pinyin & nghĩa'}
        </button>
      </div>

      {dialogue.lines.map((line) => {
        const isCurrent = line.id === currentLineId
        const color = line.speaker_zh ? speakerColors.get(line.speaker_zh) : undefined

        return (
          <div key={line.id} className="flex items-start gap-3">
            {line.speaker_zh && color && (
              <span
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[11px] font-bold leading-none ${color.bg} ${color.text}`}
                title={line.speaker_zh}
              >
                {line.speaker_zh}
              </span>
            )}

            <button
              type="button"
              onClick={() => playLine(line.id, line.audio_url)}
              disabled={!line.audio_url}
              className={`flex flex-1 items-start justify-between gap-3 rounded-card rounded-tl-md border p-4 text-left shadow-sm transition-all ${
                isCurrent ? 'border-brand-red/30 bg-white' : 'border-card-border bg-white/60'
              } ${line.audio_url ? 'cursor-pointer hover:-translate-y-0.5 hover:shadow-md' : 'cursor-default opacity-70'}`}
            >
              <span className="flex min-w-0 flex-1 flex-col gap-1">
                {showDetails && line.pinyin && (
                  <span className="text-xs font-semibold tracking-wide text-ink-pinyin">{line.pinyin}</span>
                )}
                <span className="font-han-title text-2xl font-medium leading-snug text-ink">{line.text_zh}</span>
                {showDetails && line.translation_vi && (
                  <span className="mt-1 text-sm font-semibold text-ink-muted">{line.translation_vi}</span>
                )}
              </span>

              <span
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full shadow-sm transition-colors ${
                  line.audio_url ? 'bg-brand-red text-white' : 'bg-card-border text-ink-faint'
                }`}
              >
                {isCurrent ? (
                  <span className="flex h-4 items-center gap-[3px]" aria-hidden="true">
                    <span className="h-full w-[3px] animate-pulse rounded-full bg-current" />
                    <span className="h-full w-[3px] animate-pulse rounded-full bg-current [animation-delay:150ms]" />
                    <span className="h-full w-[3px] animate-pulse rounded-full bg-current [animation-delay:300ms]" />
                  </span>
                ) : (
                  <Play className="h-4 w-4" strokeWidth={2.5} />
                )}
              </span>
            </button>
          </div>
        )
      })}
    </div>
  )
}
