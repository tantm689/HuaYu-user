'use client'

import { useState } from 'react'
import type { Vocabulary, DialogueLineForTyping } from '@/lib/db/types'
import VocabTypingTab from './VocabTypingTab'
import SentenceTypingTab from './SentenceTypingTab'

type Tab = 'vocab' | 'sentence'

export default function TypingPage({
  vocabulary,
  lines,
}: {
  vocabulary: Vocabulary[]
  lines: DialogueLineForTyping[]
}) {
  const [tab, setTab] = useState<Tab>('vocab')

  return (
    <div className="flex flex-col gap-5">
      <div className="flex gap-2 rounded-pill bg-accent-bg p-1">
        <button
          type="button"
          onClick={() => setTab('vocab')}
          className={`flex-1 rounded-pill px-4 py-2 text-sm font-semibold transition-colors ${
            tab === 'vocab' ? 'bg-white text-brand-red shadow-sm' : 'text-ink-faint'
          }`}
        >
          Gõ từ
        </button>
        <button
          type="button"
          onClick={() => setTab('sentence')}
          className={`flex-1 rounded-pill px-4 py-2 text-sm font-semibold transition-colors ${
            tab === 'sentence' ? 'bg-white text-brand-red shadow-sm' : 'text-ink-faint'
          }`}
        >
          Gõ câu
        </button>
      </div>

      {tab === 'vocab' ? (
        <VocabTypingTab vocabulary={vocabulary} />
      ) : (
        <SentenceTypingTab key="sentence-tab" lines={lines} />
      )}
    </div>
  )
}
