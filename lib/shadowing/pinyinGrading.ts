import { pinyin } from 'pinyin-pro'

export type GradeStatus = 'correct' | 'almost' | 'incorrect'

export interface GradeResult {
  status: GradeStatus
  accuracy: number
  targetSyllables: string[]
  transcriptSyllables: string[]
  targetSyllablesToned: string[]
  transcriptSyllablesToned: string[]
}

const ALMOST_THRESHOLD = 0.7

function toSyllables(text: string, toneType: 'none' | 'symbol'): string[] {
  if (!text) return []
  return pinyin(text, { toneType, type: 'array' })
}

// Levenshtein distance over syllable arrays (not characters) so a single
// mispronounced multi-letter syllable like "zhuang" costs exactly 1, the
// same as a single mispronounced short syllable like "a" — grading by raw
// Latin characters would unfairly penalize longer syllables.
function syllableLevenshtein(a: string[], b: string[]): number {
  const rows = a.length + 1
  const cols = b.length + 1
  const matrix: number[][] = Array.from({ length: rows }, () => new Array(cols).fill(0))

  for (let i = 0; i < rows; i++) matrix[i][0] = i
  for (let j = 0; j < cols; j++) matrix[0][j] = j

  for (let i = 1; i < rows; i++) {
    for (let j = 1; j < cols; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      )
    }
  }

  return matrix[a.length][b.length]
}

export function gradeSyllables(target: string, transcript: string): GradeResult {
  const targetSyllables = toSyllables(target, 'none')
  const transcriptSyllables = toSyllables(transcript, 'none')
  const targetSyllablesToned = toSyllables(target, 'symbol')
  const transcriptSyllablesToned = toSyllables(transcript, 'symbol')

  const maxLen = Math.max(targetSyllables.length, transcriptSyllables.length)
  const accuracy = maxLen === 0 ? 0 : (maxLen - syllableLevenshtein(targetSyllables, transcriptSyllables)) / maxLen

  const status: GradeStatus =
    accuracy === 1 ? 'correct' : accuracy >= ALMOST_THRESHOLD ? 'almost' : 'incorrect'

  return {
    status,
    accuracy,
    targetSyllables,
    transcriptSyllables,
    targetSyllablesToned,
    transcriptSyllablesToned,
  }
}
