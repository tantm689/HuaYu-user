'use client'

import type { DueVocabularyCard } from '@/lib/db/getDueVocabularyCards'
import FlashcardReviewer from '@/components/FlashcardReviewer'

export default function ReviewSession({ cards }: { cards: DueVocabularyCard[] }) {
  return <FlashcardReviewer cards={cards} storageKey="due-review-session" />
}
