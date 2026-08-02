import { describe, it, expect } from 'vitest'
import { computeNextReview } from '@/lib/srs/leitner'

describe('computeNextReview', () => {
  it('box 0 đúng lần 1: streak tăng lên 1, vẫn ở box 0, due ngay (ôn lại trong phiên)', () => {
    const result = computeNextReview({ box: 0, learning_streak: 0 }, true)
    expect(result.box).toBe(0)
    expect(result.learning_streak).toBe(1)
  })

  it('box 0 đúng lần 2: streak tăng lên 2, vẫn ở box 0', () => {
    const result = computeNextReview({ box: 0, learning_streak: 1 }, true)
    expect(result.box).toBe(0)
    expect(result.learning_streak).toBe(2)
  })

  it('box 0 đúng lần 3 liên tiếp: tốt nghiệp lên box 1, due sau 1 ngày', () => {
    const before = Date.now()
    const result = computeNextReview({ box: 0, learning_streak: 2 }, true)
    expect(result.box).toBe(1)
    expect(result.learning_streak).toBe(3)
    const dueMs = new Date(result.due_at).getTime()
    const oneDayMs = 24 * 60 * 60 * 1000
    expect(dueMs).toBeGreaterThanOrEqual(before + oneDayMs - 5000)
    expect(dueMs).toBeLessThanOrEqual(before + oneDayMs + 5000)
  })

  it('box 0 sai: streak reset về 0, due ngay lập tức (lặp lại trong phiên)', () => {
    const before = Date.now()
    const result = computeNextReview({ box: 0, learning_streak: 2 }, false)
    expect(result.box).toBe(0)
    expect(result.learning_streak).toBe(0)
    const dueMs = new Date(result.due_at).getTime()
    expect(dueMs).toBeLessThanOrEqual(before + 5000)
  })

  it('box 1 đúng: lên box 2, due sau 3 ngày', () => {
    const before = Date.now()
    const result = computeNextReview({ box: 1, learning_streak: 3 }, true)
    expect(result.box).toBe(2)
    const dueMs = new Date(result.due_at).getTime()
    const threeDaysMs = 3 * 24 * 60 * 60 * 1000
    expect(dueMs).toBeGreaterThanOrEqual(before + threeDaysMs - 5000)
    expect(dueMs).toBeLessThanOrEqual(before + threeDaysMs + 5000)
  })

  it('box 5 đúng: giữ nguyên box 5 (đã max), due sau 30 ngày', () => {
    const before = Date.now()
    const result = computeNextReview({ box: 5, learning_streak: 3 }, true)
    expect(result.box).toBe(5)
    const dueMs = new Date(result.due_at).getTime()
    const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000
    expect(dueMs).toBeGreaterThanOrEqual(before + thirtyDaysMs - 5000)
    expect(dueMs).toBeLessThanOrEqual(before + thirtyDaysMs + 5000)
  })

  it('box 3 sai: về thẳng box 1, due ngày mai', () => {
    const before = Date.now()
    const result = computeNextReview({ box: 3, learning_streak: 0 }, false)
    expect(result.box).toBe(1)
    const dueMs = new Date(result.due_at).getTime()
    const oneDayMs = 24 * 60 * 60 * 1000
    expect(dueMs).toBeGreaterThanOrEqual(before + oneDayMs - 5000)
    expect(dueMs).toBeLessThanOrEqual(before + oneDayMs + 5000)
  })
})
