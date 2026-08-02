import { describe, it, expect } from 'vitest'
import type { VocabularyProgress, QuizAttempt, TypingProgress, TypingKind } from '@/lib/db/types'

describe('progress table types', () => {
  it('VocabularyProgress accepts the exact migration column shape', () => {
    const row: VocabularyProgress = {
      id: 'a',
      user_id: 'u',
      vocabulary_id: 'v',
      box: 0,
      learning_streak: 0,
      due_at: '2026-01-01T00:00:00Z',
      last_reviewed_at: null,
      created_at: '2026-01-01T00:00:00Z',
    }
    expect(row.box).toBe(0)
  })

  it('QuizAttempt accepts the exact migration column shape', () => {
    const row: QuizAttempt = {
      id: 'a',
      user_id: 'u',
      lesson_id: 'l',
      part: 1,
      score: 10,
      total: 15,
      created_at: '2026-01-01T00:00:00Z',
    }
    expect(row.part).toBe(1)
  })

  it('TypingProgress accepts the exact migration column shape', () => {
    const kind: TypingKind = 'vocabulary'
    const row: TypingProgress = {
      id: 'a',
      user_id: 'u',
      kind,
      target_id: 't',
      is_correct: true,
      streak: 3,
      last_attempted_at: '2026-01-01T00:00:00Z',
    }
    expect(row.streak).toBe(3)
  })
})
