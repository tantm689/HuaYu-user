'use client'

import { useState } from 'react'
import { GraduationCap } from 'lucide-react'
import type { Vocabulary, VocabularyProgress } from '@/lib/db/types'
import HanziStrokeOrder from '@/components/HanziStrokeOrder'
import FlashcardReviewer from '@/components/FlashcardReviewer'

export default function VocabularyFlashcards({
  words,
  progress,
}: {
  words: Vocabulary[]
  progress: VocabularyProgress[]
}) {
  const [activeIndex, setActiveIndex] = useState(0)
  const [charIndex, setCharIndex] = useState(0)
  const [reviewing, setReviewing] = useState(false)

  const word = words[activeIndex]
  const characters = [...word.word_zh]
  const activeChar = characters[Math.min(charIndex, characters.length - 1)]

  function selectWord(index: number) {
    setActiveIndex(index)
    setCharIndex(0)
  }

  if (reviewing) {
    const progressByVocabId = new Map(progress.map((p) => [p.vocabulary_id, p]))
    const cards = words
      .filter((w) => progressByVocabId.has(w.id))
      .map((w) => ({ vocabulary: w, progress: progressByVocabId.get(w.id)! }))

    return (
      <div className="flex flex-col gap-4">
        <button
          type="button"
          onClick={() => setReviewing(false)}
          className="self-start text-sm font-semibold text-ink-faint hover:text-brand-red"
        >
          &larr; Quay lại danh sách từ
        </button>
        <FlashcardReviewer cards={cards} />
      </div>
    )
  }

  return (
    <div className="rounded-card border border-card-border bg-white p-6 shadow-sm">
      <div className="mb-6 flex items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {words.map((w, index) => (
            <button
              key={w.id}
              type="button"
              onClick={() => selectWord(index)}
              className={
                index === activeIndex
                  ? 'rounded-btn bg-[#1e2a5e] px-4 py-2 font-han-body text-lg font-semibold text-white shadow-sm'
                  : 'rounded-btn bg-accent-bg px-4 py-2 font-han-body text-lg font-semibold text-ink transition-colors hover:bg-amber-100'
              }
            >
              {w.word_zh}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setReviewing(true)}
          className="flex shrink-0 items-center gap-1.5 rounded-btn bg-brand-red px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-red-dark"
        >
          <GraduationCap className="h-4 w-4" strokeWidth={2.25} />
          Ôn từ vựng
        </button>
      </div>

      <div className="flex flex-col items-center gap-4">
        <HanziStrokeOrder key={activeChar} character={activeChar} />

        {characters.length > 1 && (
          <div className="flex gap-2">
            {characters.map((char, index) => (
              <button
                key={index}
                type="button"
                onClick={() => setCharIndex(index)}
                className={
                  index === charIndex
                    ? 'flex h-9 w-9 items-center justify-center rounded-full bg-brand-red font-han-body text-base font-semibold text-white'
                    : 'flex h-9 w-9 items-center justify-center rounded-full bg-accent-bg font-han-body text-base font-semibold text-ink-faint transition-colors hover:bg-amber-100'
                }
              >
                {char}
              </button>
            ))}
          </div>
        )}

        <div className="text-center">
          {word.pinyin && <p className="text-lg font-semibold text-ink-pinyin">{word.pinyin}</p>}
          {word.meaning_vi && <p className="mt-1 font-bold text-ink">{word.meaning_vi}</p>}
        </div>
      </div>
    </div>
  )
}
