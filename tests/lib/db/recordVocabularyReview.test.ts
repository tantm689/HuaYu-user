import { describe, it, expect, vi } from 'vitest'
import { recordVocabularyReview } from '@/lib/db/recordVocabularyReview'

describe('recordVocabularyReview', () => {
  it('updates the progress row with the computed next state and last_reviewed_at', async () => {
    const eqFn = vi.fn().mockResolvedValue({ error: null })
    const update = vi.fn().mockReturnValue({ eq: eqFn })
    const fakeClient = { from: vi.fn().mockReturnValue({ update }) }

    await recordVocabularyReview(fakeClient as never, 'progress-1', {
      box: 1,
      learning_streak: 3,
      due_at: '2026-08-03T00:00:00.000Z',
    })

    expect(fakeClient.from).toHaveBeenCalledWith('vocabulary_progress')
    expect(update).toHaveBeenCalledWith({
      box: 1,
      learning_streak: 3,
      due_at: '2026-08-03T00:00:00.000Z',
      last_reviewed_at: expect.any(String),
    })
    expect(eqFn).toHaveBeenCalledWith('id', 'progress-1')
  })

  it('throws when Supabase returns an error', async () => {
    const eqFn = vi.fn().mockResolvedValue({ error: { message: 'db error' } })
    const update = vi.fn().mockReturnValue({ eq: eqFn })
    const fakeClient = { from: vi.fn().mockReturnValue({ update }) }

    await expect(
      recordVocabularyReview(fakeClient as never, 'progress-1', {
        box: 1,
        learning_streak: 0,
        due_at: '2026-08-03T00:00:00.000Z',
      })
    ).rejects.toThrow('db error')
  })
})
