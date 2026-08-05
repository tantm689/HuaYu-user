import { describe, it, expect, vi } from 'vitest'
import { getQuizQuestions } from '@/lib/db/quiz'

describe('getQuizQuestions', () => {
  it('fetches questions for a lesson+part ordered by `order` ascending', async () => {
    const rows = [
      { id: 'q2', lesson_id: 'lesson-1', part: 1, type: 'pinyin_choice', order: 2, payload: { prompt: 'X', choices: ['a', 'b', 'c', 'd'], correctIndex: 0 } },
      { id: 'q1', lesson_id: 'lesson-1', part: 1, type: 'pinyin_choice', order: 1, payload: { prompt: 'Y', choices: ['a', 'b', 'c', 'd'], correctIndex: 1 } },
    ]
    const order = vi.fn().mockResolvedValue({ data: rows, error: null })
    const eqPart = vi.fn().mockReturnValue({ order })
    const eqLesson = vi.fn().mockReturnValue({ eq: eqPart })
    const select = vi.fn().mockReturnValue({ eq: eqLesson })
    const fakeClient = { from: vi.fn().mockReturnValue({ select }) }

    const result = await getQuizQuestions(fakeClient as never, 'lesson-1', 1)

    expect(fakeClient.from).toHaveBeenCalledWith('quiz_questions')
    expect(eqLesson).toHaveBeenCalledWith('lesson_id', 'lesson-1')
    expect(eqPart).toHaveBeenCalledWith('part', 1)
    expect(order).toHaveBeenCalledWith('order', { ascending: true })
    expect(result).toEqual(rows)
  })

  it('throws when Supabase returns an error', async () => {
    const order = vi.fn().mockResolvedValue({ data: null, error: { message: 'db error' } })
    const eqPart = vi.fn().mockReturnValue({ order })
    const eqLesson = vi.fn().mockReturnValue({ eq: eqPart })
    const select = vi.fn().mockReturnValue({ eq: eqLesson })
    const fakeClient = { from: vi.fn().mockReturnValue({ select }) }

    await expect(getQuizQuestions(fakeClient as never, 'lesson-1', 1)).rejects.toThrow('db error')
  })
})
