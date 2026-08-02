import { describe, it, expect, vi } from 'vitest'
import { getVocabularyProgressForLesson } from '@/lib/db/getVocabularyProgressForLesson'

describe('getVocabularyProgressForLesson', () => {
  it('returns progress rows filtered by the given vocabulary ids', async () => {
    const mockRows = [
      {
        id: 'p1',
        user_id: 'u1',
        vocabulary_id: 'v1',
        box: 0,
        learning_streak: 0,
        due_at: '2026-08-02T00:00:00Z',
        last_reviewed_at: null,
        created_at: '2026-08-02T00:00:00Z',
      },
    ]
    const inFn = vi.fn().mockResolvedValue({ data: mockRows, error: null })
    const fakeClient = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({ in: inFn }),
      }),
    }

    const result = await getVocabularyProgressForLesson(fakeClient as never, ['v1'])

    expect(result).toEqual(mockRows)
    expect(inFn).toHaveBeenCalledWith('vocabulary_id', ['v1'])
  })

  it('returns empty array without querying when vocabularyIds is empty', async () => {
    const fakeClient = { from: vi.fn() }

    const result = await getVocabularyProgressForLesson(fakeClient as never, [])

    expect(result).toEqual([])
    expect(fakeClient.from).not.toHaveBeenCalled()
  })

  it('throws when Supabase returns an error', async () => {
    const inFn = vi.fn().mockResolvedValue({ data: null, error: { message: 'db error' } })
    const fakeClient = {
      from: vi.fn().mockReturnValue({ select: vi.fn().mockReturnValue({ in: inFn }) }),
    }

    await expect(getVocabularyProgressForLesson(fakeClient as never, ['v1'])).rejects.toThrow('db error')
  })
})
