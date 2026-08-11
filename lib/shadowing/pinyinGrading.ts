import { pinyin } from 'pinyin-pro'

export type GradeStatus = 'correct' | 'almost' | 'incorrect'
export type SyllableAlignmentStatus = 'matched' | 'tone-mismatch' | 'mismatched' | 'missing'

export interface SyllableAlignment {
  status: SyllableAlignmentStatus
  targetSyllable: string
  targetSyllableToned: string
  transcriptSyllable: string | null
  transcriptSyllableToned: string | null
}

export interface GradeResult {
  status: GradeStatus
  accuracy: number
  targetSyllables: string[]
  transcriptSyllables: string[]
  targetSyllablesToned: string[]
  transcriptSyllablesToned: string[]
  alignment: SyllableAlignment[]
}

const ALMOST_THRESHOLD = 0.7

// pinyin-pro echoes non-Hanzi input (Chinese/Latin punctuation, whitespace)
// back verbatim as a fake "syllable" instead of omitting it - a pinyin
// syllable is always plain Latin letters (toneType: 'none') or Latin letters
// plus precomposed toned vowels (toneType: 'symbol', e.g. ā á ǎ à, ü/ǖ ǘ ǚ ǜ),
// so anything else in the array is punctuation that leaked through and must
// never count toward alignment or accuracy.
const PINYIN_SYLLABLE_PATTERN = /^[a-zāáǎàēéěèīíǐìōóǒòūúǔùüǖǘǚǜ]+$/i

function toSyllables(text: string, toneType: 'none' | 'symbol'): string[] {
  if (!text) return []
  return pinyin(text, { toneType, type: 'array' }).filter((s) => PINYIN_SYLLABLE_PATTERN.test(s))
}

interface BacktraceCell {
  cost: number
  from: 'match' | 'substitute' | 'delete-target' | 'insert-transcript' | null
}

// Levenshtein distance over syllable arrays (not characters) so a single
// mispronounced multi-letter syllable like "zhuang" costs exactly 1, the
// same as a single mispronounced short syllable like "a" - grading by raw
// Latin characters would unfairly penalize longer syllables. The backtrace
// pointers let us recover WHICH target syllables were matched, substituted,
// or dropped, instead of only the total edit distance.
function syllableAlignment(target: string[], transcript: string[]): BacktraceCell[][] {
  const rows = target.length + 1
  const cols = transcript.length + 1
  const grid: BacktraceCell[][] = Array.from({ length: rows }, () => new Array(cols).fill(null))

  for (let i = 0; i < rows; i++) grid[i][0] = { cost: i, from: i === 0 ? null : 'delete-target' }
  for (let j = 0; j < cols; j++) grid[0][j] = { cost: j, from: j === 0 ? null : 'insert-transcript' }

  for (let i = 1; i < rows; i++) {
    for (let j = 1; j < cols; j++) {
      const isMatch = target[i - 1] === transcript[j - 1]
      const matchOrSubCost = grid[i - 1][j - 1].cost + (isMatch ? 0 : 1)
      const deleteCost = grid[i - 1][j].cost + 1
      const insertCost = grid[i][j - 1].cost + 1

      const min = Math.min(matchOrSubCost, deleteCost, insertCost)
      grid[i][j] =
        min === matchOrSubCost
          ? { cost: min, from: isMatch ? 'match' : 'substitute' }
          : min === deleteCost
            ? { cost: min, from: 'delete-target' }
            : { cost: min, from: 'insert-transcript' }
    }
  }

  return grid
}

function buildAlignment(
  targetSyllables: string[],
  transcriptSyllables: string[],
  targetSyllablesToned: string[],
  transcriptSyllablesToned: string[]
): SyllableAlignment[] {
  const grid = syllableAlignment(targetSyllables, transcriptSyllables)
  const steps: SyllableAlignment[] = []

  let i = targetSyllables.length
  let j = transcriptSyllables.length

  while (i > 0 || j > 0) {
    const cell = grid[i][j]
    if (cell.from === 'match' || cell.from === 'substitute') {
      const targetIdx = i - 1
      const transcriptIdx = j - 1
      const toneless = targetSyllables[targetIdx] === transcriptSyllables[transcriptIdx]
      const toned = targetSyllablesToned[targetIdx] === transcriptSyllablesToned[transcriptIdx]
      steps.push({
        status: !toneless ? 'mismatched' : toned ? 'matched' : 'tone-mismatch',
        targetSyllable: targetSyllables[targetIdx],
        targetSyllableToned: targetSyllablesToned[targetIdx],
        transcriptSyllable: transcriptSyllables[transcriptIdx],
        transcriptSyllableToned: transcriptSyllablesToned[transcriptIdx],
      })
      i -= 1
      j -= 1
    } else if (cell.from === 'delete-target') {
      const targetIdx = i - 1
      steps.push({
        status: 'missing',
        targetSyllable: targetSyllables[targetIdx],
        targetSyllableToned: targetSyllablesToned[targetIdx],
        transcriptSyllable: null,
        transcriptSyllableToned: null,
      })
      i -= 1
    } else {
      // insert-transcript: an extra spoken syllable with no target
      // counterpart - not represented as a tile (the grid always has
      // exactly targetSyllables.length tiles), simply skip it.
      j -= 1
    }
  }

  return steps.reverse()
}

export function gradeSyllables(target: string, transcript: string): GradeResult {
  const targetSyllables = toSyllables(target, 'none')
  const transcriptSyllables = toSyllables(transcript, 'none')
  const targetSyllablesToned = toSyllables(target, 'symbol')
  const transcriptSyllablesToned = toSyllables(transcript, 'symbol')

  const grid = syllableAlignment(targetSyllables, transcriptSyllables)
  const distance = grid[targetSyllables.length]?.[transcriptSyllables.length]?.cost ?? 0
  const maxLen = Math.max(targetSyllables.length, transcriptSyllables.length)
  const accuracy = maxLen === 0 ? 0 : (maxLen - distance) / maxLen

  const status: GradeStatus =
    accuracy === 1 ? 'correct' : accuracy >= ALMOST_THRESHOLD ? 'almost' : 'incorrect'

  const alignment = buildAlignment(
    targetSyllables,
    transcriptSyllables,
    targetSyllablesToned,
    transcriptSyllablesToned
  )

  return {
    status,
    accuracy,
    targetSyllables,
    transcriptSyllables,
    targetSyllablesToned,
    transcriptSyllablesToned,
    alignment,
  }
}
