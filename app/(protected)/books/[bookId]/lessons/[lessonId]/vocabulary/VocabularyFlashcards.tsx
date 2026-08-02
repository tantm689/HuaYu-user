'use client'

import { useState } from 'react'
import type { Vocabulary } from '@/lib/db/types'
import HanziStrokeOrder from '@/components/HanziStrokeOrder'

export default function VocabularyFlashcards({ words }: { words: Vocabulary[] }) {
  const [activeIndex, setActiveIndex] = useState(0)
  const [charIndex, setCharIndex] = useState(0)

  const word = words[activeIndex]
  const characters = [...word.word_zh]
  const activeChar = characters[Math.min(charIndex, characters.length - 1)]

  function selectWord(index: number) {
    setActiveIndex(index)
    setCharIndex(0)
  }

  return (
    <div className="rounded-card border border-card-border bg-white p-6 shadow-sm">
      <div className="mb-6 flex flex-wrap gap-2">
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
