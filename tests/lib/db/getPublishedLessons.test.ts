import { describe, it, expect, vi } from 'vitest'
import { getPublishedLessons } from '@/lib/db/getPublishedLessons'

describe('getPublishedLessons', () => {
  it('returns only published lessons for the given book, ordered by lesson_no', async () => {
    const mockLessons = [
      {
        id: 'l1',
        book_id: 'b1',
        lesson_no: 1,
        title_zh: '第一課',
        title_vi: 'Bài 1',
        theme: null,
        status: 'published',
        created_at: '2026-01-01',
      },
    ]

    const eqStatus = vi.fn().mockReturnValue({
      order: vi.fn().mockResolvedValue({ data: mockLessons, error: null }),
    })
    const eqBookId = vi.fn().mockReturnValue({ eq: eqStatus })
    const fakeClient = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({ eq: eqBookId }),
      }),
    }

    const result = await getPublishedLessons(fakeClient as never, 'b1')

    expect(result).toEqual(mockLessons)
    expect(eqBookId).toHaveBeenCalledWith('book_id', 'b1')
    expect(eqStatus).toHaveBeenCalledWith('status', 'published')
  })

  it('throws when Supabase returns an error', async () => {
    const eqStatus = vi.fn().mockReturnValue({
      order: vi.fn().mockResolvedValue({ data: null, error: { message: 'db error' } }),
    })
    const eqBookId = vi.fn().mockReturnValue({ eq: eqStatus })
    const fakeClient = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({ eq: eqBookId }),
      }),
    }

    await expect(getPublishedLessons(fakeClient as never, 'b1')).rejects.toThrow('db error')
  })
})
