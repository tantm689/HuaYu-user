import { describe, it, expect, vi } from 'vitest'
import { gradeChoiceAnswer, gradeSentenceOrder, gradeMatching, shuffleWithIndexMap } from '@/lib/quiz/grading'

describe('gradeChoiceAnswer', () => {
  it('returns true when selectedIndex matches correctIndex', () => {
    expect(gradeChoiceAnswer({ correctIndex: 2 }, 2)).toBe(true)
  })

  it('returns false when selectedIndex does not match correctIndex', () => {
    expect(gradeChoiceAnswer({ correctIndex: 2 }, 0)).toBe(false)
  })
})

describe('gradeSentenceOrder', () => {
  it('returns true when selectedOrder exactly matches correctOrder', () => {
    const payload = { words: ['đi', 'trường', 'tôi'], correctOrder: [2, 0, 1] }
    expect(gradeSentenceOrder(payload, [2, 0, 1])).toBe(true)
  })

  it('returns false when order differs even with the same set of indices', () => {
    const payload = { words: ['đi', 'trường', 'tôi'], correctOrder: [2, 0, 1] }
    expect(gradeSentenceOrder(payload, [0, 2, 1])).toBe(false)
  })

  it('returns false when lengths differ', () => {
    const payload = { words: ['đi', 'trường', 'tôi'], correctOrder: [2, 0, 1] }
    expect(gradeSentenceOrder(payload, [2, 0])).toBe(false)
  })
})

describe('gradeMatching', () => {
  it('returns true when all pairs are matched regardless of wrong attempt count', () => {
    expect(gradeMatching(5, 0)).toBe(true)
    expect(gradeMatching(5, 2)).toBe(true)
  })
})

describe('shuffleWithIndexMap', () => {
  it('preserves original indices alongside shuffled items', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0)
    const result = shuffleWithIndexMap(['a', 'b', 'c'])
    expect(result).toHaveLength(3)
    expect(result.map((r) => r.item).sort()).toEqual(['a', 'b', 'c'])
    result.forEach((r) => {
      expect(['a', 'b', 'c'][r.originalIndex]).toBe(r.item)
    })
    vi.restoreAllMocks()
  })

  it('does not mutate the input array', () => {
    const input = ['a', 'b', 'c']
    shuffleWithIndexMap(input)
    expect(input).toEqual(['a', 'b', 'c'])
  })
})
