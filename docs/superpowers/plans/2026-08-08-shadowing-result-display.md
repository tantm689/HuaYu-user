# Shadowing Per-Syllable Result Display Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Shadowing result card's plain "Mẫu: ... / Bạn đọc: ..." pinyin text dump with a per-character grid — one tile per Hanzi of the target sentence, showing that character + its pinyin, colored green (matched)/yellow (right syllable, wrong tone)/red (mismatched or not heard) — plus a "Đang xử lý..." loading state on the record button between stopping the recording and the graded result appearing.

**Architecture:** `lib/shadowing/pinyinGrading.ts` gains an alignment step: a Levenshtein backtrace over the (punctuation-filtered) syllable arrays produces a per-target-syllable verdict (`matched` / `tone-mismatch` / `mismatched` / `missing`), returned as a new `alignment` field on `GradeResult` — `gradeSyllables`'s existing `status`/`accuracy` contract is unchanged, this is purely additive. `ShadowingScreen.tsx` renders that alignment as a tile grid instead of the two text lines, and adds an `isGrading` boolean state set between `stopRecording()` and the `onEnd` callback resolving.

**Tech Stack:** TypeScript (pure logic in `pinyinGrading.ts`), Next.js client component, Tailwind 4 theme tokens, lucide-react icons, Vitest + Testing Library.

## Global Constraints

- `gradeSyllables`'s existing return fields (`status`, `accuracy`, `targetSyllables`, `transcriptSyllables`, `targetSyllablesToned`, `transcriptSyllablesToned`) and their values must not change for any of the 6 already-passing test cases in `tests/lib/shadowing/pinyinGrading.test.ts` — this task only ADDS a new `alignment` field, it does not change grading math.
- Punctuation characters (Chinese full-width punctuation like `。，！？「」（）：；`) must never appear as a syllable in `targetSyllables`, `transcriptSyllables`, or the new `alignment` array — `pinyin-pro` currently echoes them back verbatim (confirmed: `pinyin('是的。', {toneType:'none', type:'array'})` → `['shi', 'de', '。']`), which the existing code already silently included in Levenshtein distance and accuracy. Filtering them out is a genuine bug fix, not just a display change — it affects `accuracy` for any sentence containing punctuation, so the 6 existing tests must still pass with punctuation-free target text (none of them currently use punctuation) and new tests must cover a punctuated sentence explicitly.
- Alignment must use real Levenshtein backtracking (not positional/index-based comparison) — a missing syllable in the MIDDLE of a sentence must not cascade into false mismatches for every syllable after it. Reuse the existing `syllableLevenshtein` distance-computation logic's matrix, extended to support backtrace, rather than writing a second independent algorithm.
- Per-syllable status: for an aligned (target, transcript) pair — `matched` if toneless syllables are equal AND toned syllables are equal; `tone-mismatch` if toneless syllables are equal but toned syllables differ; `mismatched` if toneless syllables differ. A target syllable with no aligned transcript syllable (deletion in the alignment) is `missing`.
- The result grid always shows one tile per `targetSyllables` entry (after punctuation filtering) — this is the "always show the target sentence's shape" requirement, never fewer tiles just because the user under-spoke.
- Follow existing UI conventions: Tailwind theme tokens only (`success-bg`/`success-border`/`success-text`, `accent-bg`/`brand-gold`/`ink-gold-text`, `error-bg`/`error-border`/`error-text`, `card-border`, `ink-faint`, `rounded-card-sm`) — no hardcoded hex.
- The "Đang xử lý..." (processing) state is purely a UI affordance during the gap between `stopRecording()` firing and the `onEnd`-triggered grading callback resolving — it does not change the grading/timing logic already reviewed and merged (recognition still resolves via `onEnd`, not `onstop`).
- Do not modify `main` directly. Work happens in the `shadowing-result-display` branch/worktree at `e:\HuaYu\HuaYu-user\.worktrees\shadowing-result-display`.

---

## Task 1: Per-syllable alignment in `gradeSyllables`

**Files:**
- Modify: `lib/shadowing/pinyinGrading.ts`
- Modify: `tests/lib/shadowing/pinyinGrading.test.ts`

**Interfaces:**
- Consumes: `pinyin` from `pinyin-pro` (unchanged usage).
- Produces:
  ```ts
  export type SyllableAlignmentStatus = 'matched' | 'tone-mismatch' | 'mismatched' | 'missing'

  export interface SyllableAlignment {
    status: SyllableAlignmentStatus
    targetSyllable: string       // toneless, e.g. 'jie'
    targetSyllableToned: string  // toned, e.g. 'jiē'
    transcriptSyllable: string | null       // toneless; null when status === 'missing'
    transcriptSyllableToned: string | null  // toned; null when status === 'missing'
  }

  export interface GradeResult {
    status: GradeStatus
    accuracy: number
    targetSyllables: string[]
    transcriptSyllables: string[]
    targetSyllablesToned: string[]
    transcriptSyllablesToned: string[]
    alignment: SyllableAlignment[]   // NEW — one entry per target syllable, in order
  }
  ```
  `ShadowingScreen.tsx` (Task 2) renders `result.alignment` as the tile grid, and also needs to pair each `alignment[i]` with the corresponding Hanzi character from `currentLine.text_zh` — see Task 2 for how the Hanzi-to-syllable pairing is derived.

- [ ] **Step 1: Write the failing tests**

Add these test cases to `tests/lib/shadowing/pinyinGrading.test.ts` (append to the existing `describe('gradeSyllables', ...)` block — do not remove or modify the 6 existing tests):

```ts
it('filters Chinese punctuation out of syllable arrays and accuracy entirely', () => {
  // Confirmed via pinyin-pro directly: punctuation like 。 is echoed back
  // verbatim as a fake "syllable" unless filtered — it must never affect
  // accuracy or appear in any syllable array.
  const result = gradeSyllables('是的。', '是的')
  expect(result.targetSyllables).toEqual(['shi', 'de'])
  expect(result.status).toBe('correct')
  expect(result.accuracy).toBe(1)
})

it('produces one alignment entry per target syllable, all matched for a correct reading', () => {
  const result = gradeSyllables('你好', '你好')
  expect(result.alignment).toHaveLength(2)
  expect(result.alignment[0]).toEqual({
    status: 'matched',
    targetSyllable: 'ni',
    targetSyllableToned: 'nǐ',
    transcriptSyllable: 'ni',
    transcriptSyllableToned: 'nǐ',
  })
  expect(result.alignment[1]).toEqual({
    status: 'matched',
    targetSyllable: 'hao',
    targetSyllableToned: 'hǎo',
    transcriptSyllable: 'hao',
    transcriptSyllableToned: 'hǎo',
  })
})

it('marks a syllable as tone-mismatch when the base syllable matches but the tone differs', () => {
  // Verified directly: 你好嗎 tones are nǐ/hǎo/má, 你好马 (a different but
  // toneless-identical reading) would need real verification - instead use
  // a constructed transcript with the same toneless syllables but swap in
  // pinyin-pro's OWN toned output for a different tone on the same base by
  // using a target/transcript pair independently confirmed to share toneless
  // syllables but differ in tone. Confirmed via pinyin-pro:
  // 你好嗎 toned: ['nǐ', 'hǎo', 'má']; 你好马 toned: ['nǐ', 'hǎo', 'mǎ']
  // (马 mǎ vs 嗎 má - same toneless "ma", different tone).
  const result = gradeSyllables('你好嗎', '你好马')
  expect(result.alignment[2].status).toBe('tone-mismatch')
  expect(result.alignment[2].targetSyllable).toBe('ma')
  expect(result.alignment[2].transcriptSyllable).toBe('ma')
  expect(result.alignment[2].targetSyllableToned).toBe('má')
  expect(result.alignment[2].transcriptSyllableToned).toBe('mǎ')
})

it('marks a syllable as mismatched when the toneless base syllable differs', () => {
  const result = gradeSyllables('早安', '晚安')
  expect(result.alignment).toHaveLength(2)
  expect(result.alignment[0].status).toBe('mismatched')
  expect(result.alignment[0].targetSyllable).toBe('zao')
  expect(result.alignment[0].transcriptSyllable).toBe('wan')
  expect(result.alignment[1].status).toBe('matched')
})

it('marks a target syllable as missing (null transcript fields) when the transcript is empty', () => {
  const result = gradeSyllables('你好', '')
  expect(result.alignment).toHaveLength(2)
  expect(result.alignment[0]).toEqual({
    status: 'missing',
    targetSyllable: 'ni',
    targetSyllableToned: 'nǐ',
    transcriptSyllable: null,
    transcriptSyllableToned: null,
  })
})

it('aligns a syllable missing from the MIDDLE of the transcript without cascading mismatches after it', () => {
  // Target: 我很喜歡你 (wo hen xi huan ni). Transcript omits "hen" entirely:
  // 我喜歡你 (wo xi huan ni). A correct aligner recognizes "hen" as the one
  // missing syllable and still matches "xi", "huan", "ni" against their
  // true counterparts - a naive positional comparison would instead see
  // transcript[1]='xi' against target[1]='hen' and falsely mark everything
  // after the gap as mismatched.
  const result = gradeSyllables('我很喜歡你', '我喜歡你')
  expect(result.alignment).toHaveLength(5)
  expect(result.alignment[0].status).toBe('matched') // wo
  expect(result.alignment[1].status).toBe('missing') // hen - the actual gap
  expect(result.alignment[1].transcriptSyllable).toBeNull()
  expect(result.alignment[2].status).toBe('matched') // xi - NOT mismatched
  expect(result.alignment[3].status).toBe('matched') // huan
  expect(result.alignment[4].status).toBe('matched') // ni
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/lib/shadowing/pinyinGrading.test.ts`
Expected: FAIL — `result.alignment` is `undefined`; the punctuation test fails because `targetSyllables` currently includes `'。'`.

- [ ] **Step 3: Verify the tone-mismatch fixture independently**

Before implementing, confirm the `你好嗎` vs `你好马` fixture used in Step 1's tone-mismatch test actually produces the claimed pinyin, since this codebase's history includes a prior incident (妳 read as "nǎi" instead of "nǐ") where an unverified phonetic assumption broke a test:

```
node -e "const {pinyin}=require('pinyin-pro'); console.log(pinyin('你好嗎',{toneType:'symbol',type:'array'})); console.log(pinyin('你好马',{toneType:'symbol',type:'array'}));"
```

Expected output: `[ 'nǐ', 'hǎo', 'má' ]` and `[ 'nǐ', 'hǎo', 'mǎ' ]`. If the actual output differs, replace the test fixture in Step 1 with a pair you've verified this same way — do not guess.

- [ ] **Step 4: Implement punctuation filtering and alignment**

Replace `lib/shadowing/pinyinGrading.ts` with:

```ts
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
// syllable is always [a-zü] letters optionally followed by a combining tone
// mark, so anything else in the array is punctuation that leaked through
// and must never count toward alignment or accuracy.
const PINYIN_SYLLABLE_PATTERN = /^[a-zü]+$/i

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
```

Note: this replaces the old standalone `syllableLevenshtein` (distance-only) with `syllableAlignment` (full backtrace grid), reusing the same grid for both the distance/accuracy computation and the alignment reconstruction — no duplicate algorithm.

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run tests/lib/shadowing/pinyinGrading.test.ts`
Expected: PASS — all 6 pre-existing tests (unaffected by the additive `alignment` field) plus the 6 new tests from Step 1.

- [ ] **Step 6: Commit**

```bash
git add lib/shadowing/pinyinGrading.ts tests/lib/shadowing/pinyinGrading.test.ts
git commit -m "feat: add per-syllable alignment and punctuation filtering to pinyin grading"
```

---

## Task 2: Per-character result grid and "Đang xử lý..." loading state

**Files:**
- Modify: `app/(protected)/books/[bookId]/lessons/[lessonId]/dialogue/[dialogueId]/ShadowingScreen.tsx`
- Modify: `tests/components/dialogue/ShadowingScreen.test.tsx`

**Interfaces:**
- Consumes: `GradeResult.alignment` (Task 1), `SyllableAlignment`, `SyllableAlignmentStatus` from `lib/shadowing/pinyinGrading.ts`.
- Produces: nothing consumed elsewhere — leaf UI component.

Pairing each `alignment[i]` with its Hanzi character: `currentLine.text_zh` may itself contain punctuation that `pinyin-pro` strips from the syllable arrays (Task 1's filtering happens on the pinyin side, not on `text_zh`). To keep the tile grid's Hanzi characters aligned 1:1 with `alignment` entries, derive the punctuation-filtered Hanzi list the same way: strip any character from `text_zh` that is Chinese/Latin punctuation before zipping it with `alignment`. Since `alignment.length` always equals the punctuation-filtered target syllable count (per Task 1), and each Hanzi character maps 1:1 to one syllable in Mandarin, filtering `text_zh` down to only Hanzi characters (excluding punctuation) before zipping is safe.

- [ ] **Step 1: Write the failing tests**

Add these test cases to `tests/components/dialogue/ShadowingScreen.test.tsx`, inside the existing `describe('ShadowingScreen', ...)` block. First, update the shared `dialogue` fixture's first line to use a sentence containing punctuation, so the punctuation-filtering behavior is exercised end-to-end (check the existing fixture's exact shape before editing — this plan assumes it currently has `l1` with `text_zh: '你好嗎'`; change ONLY the punctuation-related test's local fixture if editing the shared one risks breaking unrelated tests, per your judgment reading the file):

```tsx
it('shows a Đang xử lý (processing) state on the record button between stopping and the graded result', async () => {
  render(<ShadowingScreen dialogue={dialogue} />)
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: /^Ghi âm$/i }))
  })
  act(() => {
    fireEvent.click(screen.getByRole('button', { name: /Dừng ghi âm/i }))
  })
  // Recognition hasn't settled yet (onend not fired) - button should show processing.
  expect(screen.getByRole('button', { name: /Đang xử lý/i })).toBeInTheDocument()

  act(() => {
    lastRecognition.onresult({ results: [[{ transcript: '你好嗎' }]] })
  })
  act(() => {
    lastRecognition.onend()
  })
  // Once graded, processing state clears and the normal record button returns.
  expect(screen.queryByRole('button', { name: /Đang xử lý/i })).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: /^Ghi âm$/i })).toBeInTheDocument()
})

it('renders one tile per target syllable with the correct match/tone-mismatch/mismatch/missing color', async () => {
  render(<ShadowingScreen dialogue={dialogue} />)
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: /^Ghi âm$/i }))
  })
  act(() => {
    // Target is 你好嗎 (nǐ hǎo má) - transcript omits the last syllable entirely.
    lastRecognition.onresult({ results: [[{ transcript: '你好' }]] })
  })
  act(() => {
    fireEvent.click(screen.getByRole('button', { name: /Dừng ghi âm/i }))
  })
  act(() => {
    lastRecognition.onend()
  })

  // Three tiles for the three-syllable target, regardless of the shorter transcript.
  const tiles = screen.getAllByTestId('syllable-tile')
  expect(tiles).toHaveLength(3)
  expect(tiles[0]).toHaveTextContent('你')
  expect(tiles[0]).toHaveTextContent('nǐ')
  expect(tiles[2]).toHaveTextContent('嗎')
  // The third tile has no matching transcript syllable - must render without
  // throwing and must be visually distinguished (checked via class name
  // containing the error/missing token used for that state).
  expect(tiles[2].className).toMatch(/error|missing/i)
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/components/dialogue/ShadowingScreen.test.tsx`
Expected: FAIL — no "Đang xử lý" button text exists yet; no elements with `data-testid="syllable-tile"` exist yet.

- [ ] **Step 3: Implement the processing state and tile grid**

In `app/(protected)/books/[bookId]/lessons/[lessonId]/dialogue/[dialogueId]/ShadowingScreen.tsx`:

Add an `isGrading` state near the other `useState` declarations:

```tsx
  const [isGrading, setIsGrading] = useState(false)
```

Update the `useSpeechRecognition` `onEnd` callback to clear `isGrading` once grading resolves (whether or not it actually grades, e.g. when `isAutoPause` is off):

```tsx
  const speech = useSpeechRecognition(
    (transcript) => {
      transcriptRef.current = transcript
    },
    () => {
      setIsGrading(false)
      if (!isAutoPauseRef.current) return
      setResult(gradeSyllables(currentLine.text_zh, transcriptRef.current))
    }
  )
```

Update `stopRecording` to set `isGrading` true immediately (only meaningful when auto-pause is on, but harmless either way since the UI only reads `isGrading` inside the `isAutoPause` branch):

```tsx
  function stopRecording() {
    mediaRecorderRef.current?.stop()
    speech.stop()
    setIsRecording(false)
    if (isAutoPauseRef.current) setIsGrading(true)
  }
```

Replace the record button's `else` branch (the non-recording state) to show a disabled "Đang xử lý..." state when `isGrading` is true:

```tsx
        {isRecording ? (
          <button
            type="button"
            onClick={stopRecording}
            className="flex animate-pulse items-center justify-center gap-2 rounded-btn bg-brand-red px-8 py-3 text-sm font-bold tracking-wide text-white transition-all hover:bg-brand-red-dark"
          >
            <Square className="h-4 w-4" strokeWidth={2.5} />
            Dừng ghi âm
          </button>
        ) : isGrading ? (
          <button
            type="button"
            disabled
            aria-label="Đang xử lý"
            className="flex cursor-not-allowed items-center justify-center gap-2 rounded-btn bg-card-border px-8 py-3 text-sm font-bold tracking-wide text-ink-faint"
          >
            <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2.5} />
            Đang xử lý...
          </button>
        ) : (
          <button
            type="button"
            onClick={startRecording}
            disabled={!speech.isSupported}
            className="flex items-center justify-center gap-2 rounded-btn bg-brand-gold px-8 py-3 text-sm font-bold tracking-wide text-white transition-all hover:-translate-y-0.5"
          >
            <Mic className="h-4 w-4" strokeWidth={2.5} />
            Ghi âm
          </button>
        )}
```

Add `Loader2` to the lucide-react import at the top of the file:

```tsx
import { ChevronLeft, ChevronRight, Loader2, Mic, Pause, Play, RotateCcw, Square } from 'lucide-react'
```

Replace the result card's body (the `<div className="flex flex-col gap-1 text-sm">...Mẫu.../Bạn đọc.../...</div>` block inside the `isAutoPause && result` conditional) with a tile grid. Derive the punctuation-filtered Hanzi list once per render, zipped with `result.alignment`:

```tsx
      {isAutoPause && result && (
        <div
          className={`flex flex-col gap-3 rounded-card-sm border p-5 ${
            result.status === 'correct'
              ? 'border-success-border bg-success-bg'
              : result.status === 'almost'
                ? 'border-brand-gold/40 bg-accent-bg'
                : 'border-error-border bg-error-bg'
          }`}
        >
          <p
            className={`font-bold ${
              result.status === 'correct'
                ? 'text-success-text'
                : result.status === 'almost'
                  ? 'text-ink-gold-text'
                  : 'text-error-text'
            }`}
          >
            {result.status === 'correct' && 'Phát âm chính xác!'}
            {result.status === 'almost' && 'Gần đúng rồi, cố lên!'}
            {result.status === 'incorrect' && 'Chưa chính xác, thử lại nhé!'}
          </p>
          <div className="flex flex-wrap gap-2">
            {result.alignment.map((syllable, index) => {
              const hanzi = [...currentLine.text_zh].filter((ch) => /[\u4e00-\u9fff]/.test(ch))[index] ?? ''
              const colorClasses =
                syllable.status === 'matched'
                  ? 'border-success-border bg-white text-success-text'
                  : syllable.status === 'tone-mismatch'
                    ? 'border-brand-gold/50 bg-white text-ink-gold-text'
                    : 'border-error-border bg-white text-error-text'
              return (
                <div
                  key={index}
                  data-testid="syllable-tile"
                  className={`flex flex-col items-center gap-0.5 rounded-card-sm border-2 px-3 py-2 ${colorClasses}`}
                >
                  <span className="font-han-title text-lg font-bold">{hanzi}</span>
                  <span className="text-xs font-semibold">
                    {syllable.status === 'missing' ? '—' : syllable.transcriptSyllableToned}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}
```

Notes:
- The tile's second line shows what the user actually said (`transcriptSyllableToned`), not the target's own pinyin — this mirrors the reference screenshot where each tile's small label reflects the recognized speech, and an em dash (`—`) for `missing` communicates "not heard" without a jarring empty space.
- Punctuation filtering on `text_zh` uses a CJK Unified Ideographs range check (`\u4e00-\u9fff`) rather than an explicit punctuation blocklist, since Hanzi ranges are far more stable to enumerate than the open-ended set of punctuation marks a dialogue line might contain.
- `isGrading` is intentionally NOT reset by `startRecording` — a fresh `setResult(null)` already hides the old result card immediately when recording starts, so there's no window where a stale `isGrading=true` from a previous attempt could show; if this reasoning doesn't hold once you trace the actual state transitions, add an explicit `setIsGrading(false)` at the top of `startRecording` as a safety measure and note it in your report.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/components/dialogue/ShadowingScreen.test.tsx`
Expected: PASS (all previous tests + 2 new ones)

- [ ] **Step 5: Run the full test suite and typecheck**

Run: `npm test`
Expected: PASS — no regressions elsewhere.

- [ ] **Step 6: Manual verification**

Run: `npm run dev`, open a dialogue's Shadowing tab in Chrome. Record a deliberately imperfect reading of a sentence (skip a word, mispronounce a tone). Confirm:
- Immediately after clicking "Dừng ghi âm", the button shows "Đang xử lý..." with a spinning icon, disabled, until the result appears.
- The result grid shows one tile per Hanzi character of the target sentence — green for matched syllables, yellow for right-syllable-wrong-tone, red for mismatched or unheard syllables — instead of the old two-line pinyin text dump.
- A sentence containing Chinese punctuation (e.g. `是的。謝謝你來接我們。`) does not show punctuation as a tile and its accuracy/status isn't dragged down by the punctuation marks.

- [ ] **Step 7: Commit**

```bash
git add "app/(protected)/books/[bookId]/lessons/[lessonId]/dialogue/[dialogueId]/ShadowingScreen.tsx" tests/components/dialogue/ShadowingScreen.test.tsx docs/superpowers/plans/2026-08-08-shadowing-result-display.md
git commit -m "feat: per-syllable result tile grid and processing state in ShadowingScreen"
```
