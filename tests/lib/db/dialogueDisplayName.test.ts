import { describe, it, expect } from 'vitest'
import { dialogueDisplayNames } from '@/lib/db/dialogueDisplayName'

describe('dialogueDisplayNames', () => {
  it('numbers dialogue-kind entries sequentially as "Hội thoại N"', () => {
    const names = dialogueDisplayNames([{ kind: 'dialogue' }, { kind: 'dialogue' }])
    expect(names).toEqual(['Hội thoại 1', 'Hội thoại 2'])
  })

  it('keeps independent counters per kind', () => {
    const names = dialogueDisplayNames([{ kind: 'dialogue' }, { kind: 'passage' }])
    expect(names).toEqual(['Hội thoại 1', 'Đoạn văn 1'])
  })

  it('returns an empty array for no dialogues', () => {
    expect(dialogueDisplayNames([])).toEqual([])
  })
})
