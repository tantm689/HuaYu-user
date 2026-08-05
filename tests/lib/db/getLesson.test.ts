import { describe, it, expect, vi } from 'vitest'
import { getLesson } from '@/lib/db/getLesson'

describe('getLesson', () => {
  it('selects grammar_markdown along with the existing lesson fields', async () => {
    const mockLesson = {
      id: 'l1',
      book_id: 'b1',
      lesson_no: 1,
      title_zh: '你好',
      title_vi: 'Xin chào',
      theme: null,
      status: 'published',
      created_at: '2026-08-02T00:00:00Z',
      grammar_markdown: '## Ngữ pháp 1: Test\n\nNội dung.',
    }
    const maybeSingle = vi.fn().mockResolvedValue({ data: mockLesson, error: null })
    const eqStatus = vi.fn().mockReturnValue({ maybeSingle })
    const eqId = vi.fn().mockReturnValue({ eq: eqStatus })
    const select = vi.fn().mockReturnValue({ eq: eqId })
    const fakeClient = { from: vi.fn().mockReturnValue({ select }) }

    const result = await getLesson(fakeClient as never, 'l1')

    expect(result).toEqual(mockLesson)
    expect(select).toHaveBeenCalledWith(
      expect.stringContaining('grammar_markdown')
    )
  })

  it('returns null when no matching published lesson exists', async () => {
    const maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null })
    const eqStatus = vi.fn().mockReturnValue({ maybeSingle })
    const eqId = vi.fn().mockReturnValue({ eq: eqStatus })
    const select = vi.fn().mockReturnValue({ eq: eqId })
    const fakeClient = { from: vi.fn().mockReturnValue({ select }) }

    const result = await getLesson(fakeClient as never, 'missing')

    expect(result).toBeNull()
  })

  it('throws when Supabase returns an error', async () => {
    const maybeSingle = vi.fn().mockResolvedValue({ data: null, error: { message: 'db error' } })
    const eqStatus = vi.fn().mockReturnValue({ maybeSingle })
    const eqId = vi.fn().mockReturnValue({ eq: eqStatus })
    const select = vi.fn().mockReturnValue({ eq: eqId })
    const fakeClient = { from: vi.fn().mockReturnValue({ select }) }

    await expect(getLesson(fakeClient as never, 'l1')).rejects.toThrow('db error')
  })
})
