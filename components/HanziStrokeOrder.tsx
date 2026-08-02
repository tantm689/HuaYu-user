'use client'

import { useEffect, useRef } from 'react'
import { RotateCcw } from 'lucide-react'
import HanziWriter from 'hanzi-writer'

export default function HanziStrokeOrder({ character, size = 200 }: { character: string; size?: number }) {
  const targetRef = useRef<HTMLDivElement>(null)
  const writerRef = useRef<InstanceType<typeof HanziWriter> | null>(null)

  useEffect(() => {
    if (!targetRef.current) return

    const writer = HanziWriter.create(targetRef.current, character, {
      width: size,
      height: size,
      padding: 12,
      showOutline: true,
      strokeAnimationSpeed: 1,
      delayBetweenStrokes: 300,
      strokeColor: '#1e2a5e',
      outlineColor: '#e5e0d5',
      radicalColor: '#C1272D',
    })
    writer.animateCharacter()
    writerRef.current = writer

    return () => {
      writerRef.current = null
      if (targetRef.current) targetRef.current.innerHTML = ''
    }
  }, [character, size])

  return (
    <div
      className="relative overflow-hidden rounded-card-sm border border-card-border"
      style={{
        width: size,
        height: size,
        backgroundImage:
          'linear-gradient(to right, #EFE4CE 1px, transparent 1px), linear-gradient(to bottom, #EFE4CE 1px, transparent 1px), linear-gradient(to bottom right, #EFE4CE 1px, transparent 1px), linear-gradient(to bottom left, #EFE4CE 1px, transparent 1px)',
        backgroundSize: '100% 100%, 100% 100%, 141.4% 1px, 141.4% 1px',
        backgroundPosition: 'center, center, center, center',
        backgroundRepeat: 'no-repeat',
        backgroundColor: '#FBF4E4',
      }}
    >
      <div ref={targetRef} />
      <button
        type="button"
        onClick={() => writerRef.current?.animateCharacter()}
        aria-label="Xem lại nét viết"
        className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-white/80 text-ink-faint shadow-sm transition-colors hover:text-brand-red"
      >
        <RotateCcw className="h-4 w-4" strokeWidth={2.25} />
      </button>
    </div>
  )
}
