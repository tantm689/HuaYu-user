const BOX_INTERVALS_DAYS: Record<number, number> = {
  1: 1,
  2: 3,
  3: 7,
  4: 14,
  5: 30,
}

const LEARNING_STREAK_TO_GRADUATE = 3

export interface LeitnerState {
  box: number
  learning_streak: number
}

export interface LeitnerResult {
  box: number
  learning_streak: number
  due_at: string
}

function addDays(days: number): string {
  const due = new Date()
  due.setDate(due.getDate() + days)
  return due.toISOString()
}

export function computeNextReview(current: LeitnerState, correct: boolean): LeitnerResult {
  if (current.box === 0) {
    if (!correct) {
      return { box: 0, learning_streak: 0, due_at: new Date().toISOString() }
    }

    const nextStreak = current.learning_streak + 1
    if (nextStreak >= LEARNING_STREAK_TO_GRADUATE) {
      return { box: 1, learning_streak: nextStreak, due_at: addDays(BOX_INTERVALS_DAYS[1]) }
    }
    return { box: 0, learning_streak: nextStreak, due_at: new Date().toISOString() }
  }

  if (!correct) {
    return { box: 1, learning_streak: 0, due_at: addDays(BOX_INTERVALS_DAYS[1]) }
  }

  const nextBox = Math.min(current.box + 1, 5)
  return { box: nextBox, learning_streak: current.learning_streak, due_at: addDays(BOX_INTERVALS_DAYS[nextBox]) }
}
