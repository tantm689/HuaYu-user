import { describe, it, expect } from 'vitest'
import type { VocabularyProgress } from '@/lib/db/types'

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
})
