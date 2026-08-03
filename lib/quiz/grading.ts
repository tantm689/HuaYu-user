import type { SentenceOrderPayload } from '@/lib/db/types'

export function gradeChoiceAnswer(payload: { correctIndex: number }, selectedIndex: number): boolean {
  return selectedIndex === payload.correctIndex
}

export function gradeSentenceOrder(payload: SentenceOrderPayload, selectedOrder: number[]): boolean {
  if (selectedOrder.length !== payload.correctOrder.length) return false
  return selectedOrder.every((index, i) => index === payload.correctOrder[i])
}

export function gradeMatching(pairCount: number, wrongAttemptsCount: number): boolean {
  return wrongAttemptsCount === 0
}

export function shuffleWithIndexMap<T>(items: T[]): { item: T; originalIndex: number }[] {
  const indexed = items.map((item, originalIndex) => ({ item, originalIndex }))
  const result = [...indexed]
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  return result
}
