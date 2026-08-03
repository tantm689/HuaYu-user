import { describe, it, expect, vi } from 'vitest'
import { upsertTypingProgress } from '@/lib/db/typingProgress'

describe('upsertTypingProgress', () => {
  it('upserts with streak incremented on a correct attempt', async () => {
    const upsert = vi.fn().mockResolvedValue({ error: null })
    const supabase = { from: vi.fn().mockReturnValue({ upsert }) }

    await upsertTypingProgress(supabase as any, 'vocabulary', 'v1', true, 2)

    expect(supabase.from).toHaveBeenCalledWith('typing_progress')
    expect(upsert).toHaveBeenCalledWith(
      { kind: 'vocabulary', target_id: 'v1', is_correct: true, streak: 3, last_attempted_at: expect.any(String) },
      { onConflict: 'user_id,kind,target_id' }
    )
  })

  it('resets streak to 0 on an incorrect attempt regardless of prevStreak', async () => {
    const upsert = vi.fn().mockResolvedValue({ error: null })
    const supabase = { from: vi.fn().mockReturnValue({ upsert }) }

    await upsertTypingProgress(supabase as any, 'dialogue_line', 'l1', false, 5)

    expect(upsert).toHaveBeenCalledWith(
      { kind: 'dialogue_line', target_id: 'l1', is_correct: false, streak: 0, last_attempted_at: expect.any(String) },
      { onConflict: 'user_id,kind,target_id' }
    )
  })

  it('throws when the upsert errors', async () => {
    const upsert = vi.fn().mockResolvedValue({ error: { message: 'boom' } })
    const supabase = { from: vi.fn().mockReturnValue({ upsert }) }

    await expect(upsertTypingProgress(supabase as any, 'vocabulary', 'v1', true, 0)).rejects.toThrow('boom')
  })
})
