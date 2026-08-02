import { describe, it, expect, vi } from 'vitest'
import { ensureVocabularyProgress } from '@/lib/db/ensureVocabularyProgress'

describe('ensureVocabularyProgress', () => {
  it('upserts progress rows for every vocabulary id with box=0, ignoring conflicts', async () => {
    const upsert = vi.fn().mockResolvedValue({ error: null })
    const fakeClient = {
      from: vi.fn().mockReturnValue({ upsert }),
    }

    await ensureVocabularyProgress(fakeClient as never, ['v1', 'v2'])

    expect(fakeClient.from).toHaveBeenCalledWith('vocabulary_progress')
    expect(upsert).toHaveBeenCalledWith(
      [
        { vocabulary_id: 'v1', box: 0, learning_streak: 0, due_at: expect.any(String) },
        { vocabulary_id: 'v2', box: 0, learning_streak: 0, due_at: expect.any(String) },
      ],
      { onConflict: 'user_id,vocabulary_id', ignoreDuplicates: true }
    )
  })

  it('does nothing when the vocabulary id list is empty', async () => {
    const upsert = vi.fn()
    const fakeClient = { from: vi.fn().mockReturnValue({ upsert }) }

    await ensureVocabularyProgress(fakeClient as never, [])

    expect(fakeClient.from).not.toHaveBeenCalled()
  })

  it('throws when Supabase returns an error', async () => {
    const upsert = vi.fn().mockResolvedValue({ error: { message: 'db error' } })
    const fakeClient = { from: vi.fn().mockReturnValue({ upsert }) }

    await expect(ensureVocabularyProgress(fakeClient as never, ['v1'])).rejects.toThrow('db error')
  })
})
