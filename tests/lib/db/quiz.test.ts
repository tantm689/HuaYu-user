import { describe, it, expect, vi } from 'vitest'
import { getQuizQuestions, getBestQuizScores, recordQuizAttempt } from '@/lib/db/quiz'

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

describe('getBestQuizScores', () => {
  it('returns the max score per part, null when no attempts exist', async () => {
    const rows = [
      { part: 1, score: 10 },
      { part: 1, score: 14 },
      { part: 2, score: 8 },
    ]
    const eqLesson = vi.fn().mockResolvedValue({ data: rows, error: null })
    const select = vi.fn().mockReturnValue({ eq: eqLesson })
    const fakeClient = { from: vi.fn().mockReturnValue({ select }) }

    const result = await getBestQuizScores(fakeClient as never, 'lesson-1')

    expect(fakeClient.from).toHaveBeenCalledWith('quiz_attempts')
    expect(eqLesson).toHaveBeenCalledWith('lesson_id', 'lesson-1')
    expect(result).toEqual({ part1: 14, part2: 8 })
  })

  it('returns null for a part with no recorded attempts', async () => {
    const eqLesson = vi.fn().mockResolvedValue({ data: [], error: null })
    const select = vi.fn().mockReturnValue({ eq: eqLesson })
    const fakeClient = { from: vi.fn().mockReturnValue({ select }) }

    const result = await getBestQuizScores(fakeClient as never, 'lesson-1')

    expect(result).toEqual({ part1: null, part2: null })
  })

  it('throws when Supabase returns an error', async () => {
    const eqLesson = vi.fn().mockResolvedValue({ data: null, error: { message: 'db error' } })
    const select = vi.fn().mockReturnValue({ eq: eqLesson })
    const fakeClient = { from: vi.fn().mockReturnValue({ select }) }

    await expect(getBestQuizScores(fakeClient as never, 'lesson-1')).rejects.toThrow('db error')
  })
})

describe('recordQuizAttempt', () => {
  it('inserts one row with lesson_id, part, score, total', async () => {
    const insert = vi.fn().mockResolvedValue({ error: null })
    const fakeClient = { from: vi.fn().mockReturnValue({ insert }) }

    await recordQuizAttempt(fakeClient as never, 'lesson-1', 1, 12, 15)

    expect(fakeClient.from).toHaveBeenCalledWith('quiz_attempts')
    expect(insert).toHaveBeenCalledWith({ lesson_id: 'lesson-1', part: 1, score: 12, total: 15 })
  })

  it('throws when Supabase returns an error', async () => {
    const insert = vi.fn().mockResolvedValue({ error: { message: 'db error' } })
    const fakeClient = { from: vi.fn().mockReturnValue({ insert }) }

    await expect(recordQuizAttempt(fakeClient as never, 'lesson-1', 1, 12, 15)).rejects.toThrow('db error')
  })
})
