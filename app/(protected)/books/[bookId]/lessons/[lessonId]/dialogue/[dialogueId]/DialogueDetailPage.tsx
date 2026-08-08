'use client'

import { useState } from 'react'
import { Headphones, Mic } from 'lucide-react'
import BackButton from '@/components/BackButton'
import type { Dialogue } from '@/lib/db/types'
import ListenTab from './ListenTab'
import ShadowingScreen from './ShadowingScreen'

type Tab = 'listen' | 'shadowing'

export default function DialogueDetailPage({
  dialogue,
  displayName,
  bookId,
  lessonId,
}: {
  dialogue: Dialogue
  displayName: string
  bookId: string
  lessonId: string
}) {
  const [tab, setTab] = useState<Tab>('listen')

  return (
    <div className="mx-auto max-w-[660px] px-5 py-6">
      <BackButton fallbackHref={`/books/${bookId}/lessons/${lessonId}/dialogue`} />
      <h1 className="mb-5 font-han-title text-2xl font-bold text-ink">{displayName}</h1>

      <div role="tablist" className="mb-5 flex gap-2 rounded-pill bg-accent-bg p-1">
        <button
          role="tab"
          type="button"
          aria-selected={tab === 'listen'}
          onClick={() => setTab('listen')}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-pill py-2 text-sm font-bold transition-colors ${
            tab === 'listen' ? 'bg-white text-brand-red shadow-sm' : 'text-ink-faint'
          }`}
        >
          <Headphones className="h-4 w-4" strokeWidth={2.5} />
          Nghe hội thoại
        </button>
        <button
          role="tab"
          type="button"
          aria-selected={tab === 'shadowing'}
          onClick={() => setTab('shadowing')}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-pill py-2 text-sm font-bold transition-colors ${
            tab === 'shadowing' ? 'bg-white text-brand-red shadow-sm' : 'text-ink-faint'
          }`}
        >
          <Mic className="h-4 w-4" strokeWidth={2.5} />
          Shadowing
        </button>
      </div>

      {tab === 'listen' ? <ListenTab dialogue={dialogue} /> : <ShadowingScreen dialogue={dialogue} />}
    </div>
  )
}
