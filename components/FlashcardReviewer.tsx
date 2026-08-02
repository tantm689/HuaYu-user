'use client'

import { useState } from 'react'
import { Volume2 } from 'lucide-react'
import type { Vocabulary, VocabularyProgress } from '@/lib/db/types'
import { computeNextReview } from '@/lib/srs/leitner'
import { recordVocabularyReview } from '@/lib/db/recordVocabularyReview'
import { createBrowserSupabase } from '@/lib/supabase/browser'
import HanziStrokeOrder from '@/components/HanziStrokeOrder'

interface FlashcardCard {
  vocabulary: Vocabulary
  progress: VocabularyProgress
}

interface FlashcardReviewerProps {
  cards: FlashcardCard[]
  onCardReviewed?: (vocabularyId: string) => void
}

export default function FlashcardReviewer({ cards, onCardReviewed }: FlashcardReviewerProps) {
  const [index, setIndex] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const [showStrokeOrder, setShowStrokeOrder] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  if (index >= cards.length) {
    return (
      <div className="rounded-card border border-card-border bg-white p-8 text-center shadow-sm">
        <p className="font-han-title text-xl font-bold text-ink">Đã ôn xong!</p>
        <p className="mt-1 text-sm font-medium text-ink-faint">Quay lại sau khi có thẻ mới đến hạn.</p>
      </div>
    )
  }

  const { vocabulary, progress } = cards[index]
  const characters = [...vocabulary.word_zh]

  function goToNext(vocabularyId: string) {
    setFlipped(false)
    setShowStrokeOrder(false)
    setSaveError(null)
    setIndex((i) => i + 1)
    onCardReviewed?.(vocabularyId)
  }

  async function handleAnswer(correct: boolean) {
    setSaving(true)
    setSaveError(null)
    const next = computeNextReview({ box: progress.box, learning_streak: progress.learning_streak }, correct)

    try {
      const supabase = createBrowserSupabase()
      await recordVocabularyReview(supabase, progress.id, next)
      goToNext(vocabulary.id)
    } catch {
      setSaveError('Không lưu được, kiểm tra kết nối mạng.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="rounded-card border border-card-border bg-white p-8 shadow-sm">
      <div className="flex flex-col items-center gap-4">
        <p className="font-han-title text-4xl font-bold text-ink">{vocabulary.word_zh}</p>

        {!flipped && (
          <button
            type="button"
            onClick={() => setFlipped(true)}
            className="rounded-btn bg-[#1e2a5e] px-6 py-2.5 font-semibold text-white shadow-sm transition-colors hover:bg-[#28377a]"
          >
            Lật thẻ
          </button>
        )}

        {flipped && (
          <>
            <div className="text-center">
              {vocabulary.pinyin && <p className="text-lg font-semibold text-ink-pinyin">{vocabulary.pinyin}</p>}
              {vocabulary.meaning_vi && <p className="mt-1 font-bold text-ink">{vocabulary.meaning_vi}</p>}
            </div>

            {vocabulary.audio_url && (
              <button
                type="button"
                onClick={() => new Audio(vocabulary.audio_url!).play()}
                aria-label="Phát âm thanh"
                className="flex h-10 w-10 items-center justify-center rounded-full bg-accent-bg text-brand-red transition-colors hover:bg-amber-100"
              >
                <Volume2 className="h-5 w-5" strokeWidth={2} />
              </button>
            )}

            {!showStrokeOrder && (
              <button
                type="button"
                onClick={() => setShowStrokeOrder(true)}
                className="text-sm font-semibold text-brand-red underline-offset-2 hover:underline"
              >
                Xem cách viết
              </button>
            )}

            {showStrokeOrder && (
              <div className="flex flex-wrap justify-center gap-3">
                {characters.map((char, i) => (
                  <HanziStrokeOrder key={`${char}-${i}`} character={char} size={140} />
                ))}
              </div>
            )}

            {saveError && <p className="text-sm font-semibold text-error-text">{saveError}</p>}

            <div className="flex gap-3">
              <button
                type="button"
                disabled={saving}
                onClick={() => handleAnswer(false)}
                className="rounded-btn border border-error-border bg-error-bg px-6 py-2.5 font-semibold text-error-text shadow-sm transition-colors hover:bg-red-100 disabled:opacity-50"
              >
                Sai
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => handleAnswer(true)}
                className="rounded-btn border border-success-border bg-success-bg px-6 py-2.5 font-semibold text-success-text shadow-sm transition-colors hover:bg-green-100 disabled:opacity-50"
              >
                Đúng
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
