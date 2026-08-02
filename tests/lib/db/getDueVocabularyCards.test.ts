import { describe, it, expect, vi } from 'vitest'
import { getDueVocabularyCards } from '@/lib/db/getDueVocabularyCards'

describe('getDueVocabularyCards', () => {
  it('queries vocabulary_progress joined with vocabulary, filtered by due_at <= now, ordered by due_at', async () => {
    const mockRows = [
      {
        id: 'p1',
        user_id: 'u1',
        vocabulary_id: 'v1',
        box: 1,
        learning_streak: 3,
        due_at: '2026-08-01T00:00:00Z',
        last_reviewed_at: '2026-07-31T00:00:00Z',
        created_at: '2026-07-30T00:00:00Z',
        vocabulary: {
          id: 'v1',
          dialogue_id: 'd1',
          order: 1,
          word_zh: '你好',
          pinyin: 'nǐ hǎo',
          meaning_vi: 'xin chào',
          audio_url: null,
        },
      },
    ]
    const order = vi.fn().mockResolvedValue({ data: mockRows, error: null })
    const lte = vi.fn().mockReturnValue({ order })
    const fakeClient = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({ lte }),
      }),
    }

    const result = await getDueVocabularyCards(fakeClient as never)

    expect(result).toEqual([
      {
        progress: {
          id: 'p1',
          user_id: 'u1',
          vocabulary_id: 'v1',
          box: 1,
          learning_streak: 3,
          due_at: '2026-08-01T00:00:00Z',
          last_reviewed_at: '2026-07-31T00:00:00Z',
          created_at: '2026-07-30T00:00:00Z',
        },
        vocabulary: mockRows[0].vocabulary,
      },
    ])
    expect(lte).toHaveBeenCalledWith('due_at', expect.any(String))
    expect(order).toHaveBeenCalledWith('due_at', { ascending: true })
  })

  it('throws when Supabase returns an error', async () => {
    const order = vi.fn().mockResolvedValue({ data: null, error: { message: 'db error' } })
    const lte = vi.fn().mockReturnValue({ order })
    const fakeClient = { from: vi.fn().mockReturnValue({ select: vi.fn().mockReturnValue({ lte }) }) }

    await expect(getDueVocabularyCards(fakeClient as never)).rejects.toThrow('db error')
  })
})
