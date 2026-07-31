import { describe, it, expect, vi } from 'vitest'
import { getPublishedBooks } from '@/lib/db/getPublishedBooks'

describe('getPublishedBooks', () => {
  it('returns books that have at least one published lesson, ordered by volume', async () => {
    const mockBooks = [
      { id: 'b1', title: 'Đương Đại 1', volume: '1', created_at: '2026-01-01' },
    ]

    const fakeClient = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({ data: mockBooks, error: null }),
        }),
      }),
    }

    const result = await getPublishedBooks(fakeClient as never)

    expect(result).toEqual(mockBooks)
    expect(fakeClient.from).toHaveBeenCalledWith('books')
  })

  it('throws when Supabase returns an error', async () => {
    const fakeClient = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({ data: null, error: { message: 'db error' } }),
        }),
      }),
    }

    await expect(getPublishedBooks(fakeClient as never)).rejects.toThrow('db error')
  })
})
