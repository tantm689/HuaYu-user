import { describe, it, expect, vi } from 'vitest'
import { getDialogueLines } from '@/lib/db/getDialogueLines'

function makeSupabaseMock(data: unknown, error: unknown = null) {
  return {
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({ data, error }),
        }),
      }),
    }),
  }
}

describe('getDialogueLines', () => {
  it('flattens dialogue_lines across dialogues, sorted by dialogue order then line order', async () => {
    const rows = [
      {
        id: 'd2',
        order: 2,
        dialogue_lines: [
          { id: 'l3', order: 1, text_zh: '再見', translation_vi: 'tạm biệt', audio_url: null },
        ],
      },
      {
        id: 'd1',
        order: 1,
        dialogue_lines: [
          { id: 'l2', order: 2, text_zh: '你好嗎', translation_vi: 'bạn khỏe không', audio_url: 'a2.mp3' },
          { id: 'l1', order: 1, text_zh: '你好', translation_vi: 'xin chào', audio_url: 'a1.mp3' },
        ],
      },
    ]
    const supabase = makeSupabaseMock(rows)

    const result = await getDialogueLines(supabase as any, 'lesson-1')

    expect(result.map((r) => r.id)).toEqual(['l1', 'l2', 'l3'])
    expect(result[0]).toEqual({ id: 'l1', text_zh: '你好', translation_vi: 'xin chào', audio_url: 'a1.mp3' })
  })

  it('throws when the query errors', async () => {
    const supabase = makeSupabaseMock(null, { message: 'boom' })
    await expect(getDialogueLines(supabase as any, 'lesson-1')).rejects.toThrow('boom')
  })

  it('returns an empty array when a lesson has no dialogue lines', async () => {
    const supabase = makeSupabaseMock([{ id: 'd1', order: 1, dialogue_lines: [] }])
    const result = await getDialogueLines(supabase as any, 'lesson-1')
    expect(result).toEqual([])
  })
})
