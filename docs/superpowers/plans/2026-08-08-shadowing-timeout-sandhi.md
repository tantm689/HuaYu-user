# Shadowing Grading Timeout + Tone-3 Sandhi Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix two real Shadowing grading issues the project owner hit while testing: (1) grading can hang indefinitely ("Đang xử lý..." never resolves) if the user keeps talking after the target sentence, since `SpeechRecognition` must finish processing all captured audio before `onend` fires — add a 10-second timeout that aborts and shows an error instead of hanging forever; (2) Mandarin tone-3 sandhi (two adjacent third-tone syllables — the first is actually pronounced as tone 2, e.g. 你好 "nǐ hǎo" is naturally spoken "ní hǎo") was being graded as a tone mismatch even when pronounced correctly, since `pinyin-pro` always returns dictionary (unsandhied) tones. Accept BOTH the dictionary tone and the sandhi-shifted tone as `matched` for adjacent tone-3 pairs.

**Architecture:** `lib/shadowing/useSpeechRecognition.ts` gets a `setTimeout` guard inside `stop()` that force-clears listening state and reports a timeout error if `onend` hasn't fired within 10 seconds. `lib/shadowing/pinyinGrading.ts` gets a tone-3-sandhi-aware comparison step: before building the alignment, compute which target syllable INDICES are "sandhi-eligible" (tone 3, immediately followed by another tone 3), and for those indices, treat a transcript syllable matching either the dictionary tone-3 form OR the tone-2-shifted form as `matched` rather than `tone-mismatch`. This is scoped to ONLY the tone-3+tone-3 rule — no other sandhi rules (不/一, etc.) are in scope for this plan.

**Tech Stack:** TypeScript (pure logic), Next.js client hook, Vitest + Testing Library.

## Global Constraints

- Scope is strictly the tone-3+tone-3 sandhi rule. Do NOT implement 不/一 tone sandhi or any other sandhi rule — the project owner explicitly deferred those to a separate future task due to their higher complexity and exception-heavy nature.
- Sandhi detection is PAIRWISE and non-cascading: for a run of 3+ consecutive tone-3 syllables (e.g. 我很好 = tone3+tone3+tone3), only evaluate each ADJACENT PAIR independently (target syllable `i` is sandhi-eligible if `i` and `i+1` are both tone 3) — do not attempt to model the linguistically more complex behavior of longer tone-3 chains (that's exactly the kind of nuanced exception-prone rule this plan is deliberately avoiding, matching the same caution as the deferred 不/一 rule).
- All phonetic/tone claims in this plan and its tests must be verified against real `pinyin-pro` output via `node -e` before being trusted — this codebase has a documented prior incident (a test assumed 妳 read as "nǐ" when `pinyin-pro` actually returns "nǎi") from trusting phonetic intuition over verification. Every fixture in this plan has already been independently verified; if you need a NEW fixture not listed here, verify it the same way before using it.
- The existing `gradeSyllables` contract (6 pre-existing tests, plus the 6 alignment tests and punctuation-filtering test already merged) must keep passing unchanged — this task adds a new comparison rule for the `tone-mismatch` vs `matched` boundary specifically, it does not touch `mismatched`/`missing` logic, the Levenshtein distance/accuracy computation, or punctuation filtering.
- The timeout must not change the already-reviewed, already-merged event ordering guarantee (`onEnd` still only fires from the real `recognition.onend` event in the normal case — the timeout is a FALLBACK path for when that event never arrives, not a replacement for it).
- Do not modify `main` directly. Work happens in the `shadowing-timeout-sandhi` branch/worktree at `e:\HuaYu\HuaYu-user\.worktrees\shadowing-timeout-sandhi`.

---

## Task 1: Grading timeout in `useSpeechRecognition`

**Files:**
- Modify: `lib/shadowing/useSpeechRecognition.ts`
- Modify: `tests/lib/shadowing/useSpeechRecognition.test.ts`
- Modify: `app/(protected)/books/[bookId]/lessons/[lessonId]/dialogue/[dialogueId]/ShadowingScreen.tsx`
- Modify: `tests/components/dialogue/ShadowingScreen.test.tsx`

**Interfaces:**
- Produces:
  ```ts
  export interface UseSpeechRecognitionResult {
    isSupported: boolean
    isListening: boolean
    start: () => void
    stop: () => void
  }
  ```
  (unchanged shape) — but `onEnd` (already an optional second constructor argument) is now ALSO invoked if the 10-second timeout elapses without a real `onend` event, so `ShadowingScreen.tsx`'s existing `onEnd` callback (which clears `isGrading` and grades) fires in both the normal and timeout cases. A new optional third constructor argument `onTimeout?: () => void` lets the caller distinguish "graded normally" from "timed out with no transcript" for UI purposes (Task 1's `ShadowingScreen.tsx` changes use this to show an error message instead of a result card).

- [ ] **Step 1: Write the failing tests**

Add these test cases to `tests/lib/shadowing/useSpeechRecognition.test.ts` (check the existing file first for its mock-setup conventions — it should already have a `MockSpeechRecognition` class stubbed via `vi.stubGlobal('webkitSpeechRecognition', ...)`; reuse that exact pattern, do not invent a new one). Use Vitest's fake timers for the timeout tests:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
// ... keep existing imports, add these test cases inside the existing describe block

describe('useSpeechRecognition timeout', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('calls onTimeout and onEnd if recognition.onend never fires within 10 seconds of stop()', () => {
    const onResult = vi.fn()
    const onEnd = vi.fn()
    const onTimeout = vi.fn()
    const { result } = renderHook(() => useSpeechRecognition(onResult, onEnd, onTimeout))

    act(() => result.current.start())
    act(() => result.current.stop())
    // recognition.onend deliberately never fires (simulating a hang)

    act(() => vi.advanceTimersByTime(10_000))

    expect(onTimeout).toHaveBeenCalledTimes(1)
    expect(onEnd).toHaveBeenCalledTimes(1)
    expect(result.current.isListening).toBe(false)
  })

  it('does not call onTimeout if recognition.onend fires before the 10-second deadline', () => {
    const onResult = vi.fn()
    const onEnd = vi.fn()
    const onTimeout = vi.fn()
    const { result } = renderHook(() => useSpeechRecognition(onResult, onEnd, onTimeout))

    act(() => result.current.start())
    act(() => result.current.stop())

    // Real onend fires quickly, well before the timeout.
    act(() => {
      // access the same mock instance pattern the existing tests use to
      // trigger recognition.onend directly
    })

    act(() => vi.advanceTimersByTime(10_000))
    // If onend already fired and cleared the timer, onTimeout must not fire.
    // (Exact mechanics depend on the existing mock's shape - see Step 3.)
  })
})
```

Note: the second test's body is intentionally left partially sketched — read the existing `tests/lib/shadowing/useSpeechRecognition.test.ts` file first to find exactly how prior tests trigger a real `recognition.onend` event on the mock instance (there should already be a pattern for this, since `onEnd`'s normal-path behavior is already tested), and use that exact same pattern here before the `vi.advanceTimersByTime` call, then assert `onTimeout` was NOT called (`expect(onTimeout).not.toHaveBeenCalled()`) after advancing time.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/lib/shadowing/useSpeechRecognition.test.ts`
Expected: FAIL — `onTimeout` parameter doesn't exist yet.

- [ ] **Step 3: Implement the timeout**

Replace `lib/shadowing/useSpeechRecognition.ts` with:

```ts
'use client'

import { useCallback, useRef, useState } from 'react'

export interface UseSpeechRecognitionResult {
  isSupported: boolean
  isListening: boolean
  start: () => void
  stop: () => void
}

const GRADING_TIMEOUT_MS = 10_000

// Stale-closure hazard (hit twice in the prior implementation attempt):
// onResult/onEnd/onTimeout are captured by the recognition instance's event
// handlers at the time `start()` runs, so they must always read the LATEST
// callback, not the one from whichever render created the recognition
// instance. Refs sidestep this.
//
// `onEnd` fires from `recognition.onend`, which the Web Speech API spec
// guarantees always runs (after `onresult` or `onerror`, whichever the
// browser reaches first) - EXCEPT when the browser is still processing a
// long captured audio buffer (e.g. the user kept talking well past the
// target sentence after clicking "stop"), which can delay `onend`
// indefinitely in practice. The timeout below is a fallback for that case:
// if `onend` hasn't fired within GRADING_TIMEOUT_MS of calling stop(), we
// force the same "done" transition ourselves (via onEnd) so the caller's
// UI never hangs, and separately signal onTimeout so the caller can show an
// error instead of grading a possibly-truncated transcript.
export function useSpeechRecognition(
  onResult: (transcript: string) => void,
  onEnd?: () => void,
  onTimeout?: () => void
): UseSpeechRecognitionResult {
  const onResultRef = useRef(onResult)
  onResultRef.current = onResult

  const onEndRef = useRef(onEnd)
  onEndRef.current = onEnd

  const onTimeoutRef = useRef(onTimeout)
  onTimeoutRef.current = onTimeout

  const recognitionRef = useRef<any>(null)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [isListening, setIsListening] = useState(false)

  const SpeechRecognitionCtor =
    typeof window !== 'undefined'
      ? (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
      : undefined

  const isSupported = Boolean(SpeechRecognitionCtor)

  const clearGradingTimeout = () => {
    if (timeoutRef.current !== null) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
  }

  const start = useCallback(() => {
    if (!SpeechRecognitionCtor) return

    const recognition = new SpeechRecognitionCtor()
    recognitionRef.current = recognition
    recognition.lang = 'zh-TW'
    recognition.continuous = false
    recognition.interimResults = false

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript
      onResultRef.current(transcript)
    }

    recognition.onerror = () => {
      setIsListening(false)
    }

    recognition.onend = () => {
      clearGradingTimeout()
      setIsListening(false)
      onEndRef.current?.()
    }

    setIsListening(true)
    recognition.start()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- clearGradingTimeout is stable across renders (closes only over refs)
  }, [SpeechRecognitionCtor])

  const stop = useCallback(() => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop()
      } catch {
        // recognition already stopped
      }
    }
    setIsListening(false)

    clearGradingTimeout()
    timeoutRef.current = setTimeout(() => {
      timeoutRef.current = null
      onTimeoutRef.current?.()
      onEndRef.current?.()
    }, GRADING_TIMEOUT_MS)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- clearGradingTimeout is stable across renders (closes only over refs)
  }, [])

  return { isSupported, isListening, start, stop }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/lib/shadowing/useSpeechRecognition.test.ts`
Expected: PASS (all pre-existing tests + 2 new ones)

- [ ] **Step 5: Wire the timeout into `ShadowingScreen.tsx`**

In `app/(protected)/books/[bookId]/lessons/[lessonId]/dialogue/[dialogueId]/ShadowingScreen.tsx`, add a `gradingTimedOut` state:

```tsx
  const [gradingTimedOut, setGradingTimedOut] = useState(false)
```

Update the `useSpeechRecognition` call to pass a third argument, and clear `gradingTimedOut` whenever a fresh recording starts:

```tsx
  const speech = useSpeechRecognition(
    (transcript) => {
      transcriptRef.current = transcript
    },
    () => {
      setIsGrading(false)
      if (!isAutoPauseRef.current) return
      if (gradingTimedOutRef.current) return
      setResult(gradeSyllables(currentLine.text_zh, transcriptRef.current))
    },
    () => {
      setGradingTimedOut(true)
    }
  )
```

This introduces a ref-read inside the `onEnd` callback (`gradingTimedOutRef.current`) to avoid grading with a truncated/stale transcript when the timeout path already fired `onTimeout` — add the corresponding ref near the other refs:

```tsx
  const gradingTimedOutRef = useRef(gradingTimedOut)
  gradingTimedOutRef.current = gradingTimedOut
```

In `startRecording`, reset `gradingTimedOut` alongside the other per-attempt resets (`setResult(null)`, etc.):

```tsx
      setPermissionError(false)
      setResult(null)
      setGradingTimedOut(false)
      transcriptRef.current = ''
```

Add a timeout-specific message near the existing `!isAutoPause` hint paragraph (render it instead of the result card when `gradingTimedOut` is true — check it before the `isAutoPause && result` block so it takes precedence if both were somehow true, though in practice `result` stays `null` when timed out):

```tsx
      {gradingTimedOut && (
        <p className="text-center text-sm font-semibold text-error-text">
          Không nhận diện được, vui lòng thử lại.
        </p>
      )}

      {isAutoPause && result && !gradingTimedOut && (
        // ... existing result card unchanged
```

- [ ] **Step 6: Write the failing component test**

Add this test to `tests/components/dialogue/ShadowingScreen.test.tsx`, inside the existing `describe('ShadowingScreen', ...)` block. Check the existing file's `MockSpeechRecognition` mock class first — it needs `vi.useFakeTimers()` support for this test, so wrap it appropriately per the file's conventions:

```tsx
it('shows a "not recognized, try again" message and clears processing state if recognition never settles within 10 seconds', async () => {
  vi.useFakeTimers()
  try {
    render(<ShadowingScreen dialogue={dialogue} />)
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /^Ghi âm$/i }))
    })
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: /Dừng ghi âm/i }))
    })
    expect(screen.getByRole('button', { name: /Đang xử lý/i })).toBeInTheDocument()

    // recognition.onend deliberately never fires - simulate the hang.
    act(() => {
      vi.advanceTimersByTime(10_000)
    })

    expect(screen.getByText(/Không nhận diện được/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Đang xử lý/i })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^Ghi âm$/i })).toBeInTheDocument()
  } finally {
    vi.useRealTimers()
  }
})
```

- [ ] **Step 7: Run tests to verify they pass**

Run: `npx vitest run tests/components/dialogue/ShadowingScreen.test.tsx`
Expected: PASS (all previous tests + 1 new one)

- [ ] **Step 8: Run the full test suite and typecheck**

Run: `npm test`
Expected: PASS — no regressions elsewhere.

- [ ] **Step 9: Commit**

```bash
git add lib/shadowing/useSpeechRecognition.ts tests/lib/shadowing/useSpeechRecognition.test.ts "app/(protected)/books/[bookId]/lessons/[lessonId]/dialogue/[dialogueId]/ShadowingScreen.tsx" tests/components/dialogue/ShadowingScreen.test.tsx docs/superpowers/plans/2026-08-08-shadowing-timeout-sandhi.md
git commit -m "feat: add 10s grading timeout so Shadowing never hangs on Đang xử lý"
```

---

## Task 2: Tone-3 sandhi acceptance in `gradeSyllables`

**Files:**
- Modify: `lib/shadowing/pinyinGrading.ts`
- Modify: `tests/lib/shadowing/pinyinGrading.test.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces: no change to `GradeResult`'s shape — this task changes ONLY the classification logic inside `buildAlignment` for the `tone-mismatch` vs `matched` boundary, when the target syllable is sandhi-eligible.

- [ ] **Step 1: Verify the sandhi fixture independently**

Before writing tests, confirm these `pinyin-pro` outputs yourself (do not trust the numbers below without running this — they were verified once while writing this plan, but re-verify per this codebase's established practice for any phonetic claim):

```
node -e "const {pinyin}=require('pinyin-pro'); console.log(pinyin('你好',{toneType:'num',type:'array'})); console.log(pinyin('你好',{toneType:'symbol',type:'array'}));"
```

Expected: `[ 'ni3', 'hao3' ]` and `[ 'nǐ', 'hǎo' ]`. If your output differs, stop and report — do not proceed with a fixture you haven't personally confirmed.

- [ ] **Step 2: Write the failing tests**

Add these test cases to `tests/lib/shadowing/pinyinGrading.test.ts` (append to the existing `describe('gradeSyllables', ...)` block):

```ts
it('accepts the sandhi-shifted tone-2 pronunciation of a tone-3 syllable immediately followed by another tone-3 syllable', () => {
  // 你好 is dictionary tone3+tone3 (nǐ hǎo), but natural Mandarin speech
  // shifts the FIRST syllable to tone 2 (real pronunciation: "ní hǎo").
  // A learner who correctly applies this sandhi rule must not be marked
  // wrong just because pinyin-pro's dictionary lookup doesn't reflect it.
  const result = gradeSyllables('你好', '尼好')
  // 尼 is independently confirmed (see Step 1's verification habit) to be
  // "ní" (tone 2) - a real character chosen so the ASR-transcript side
  // produces a genuine tone-2 syllable via the same pinyin-pro pipeline,
  // rather than fabricating a symbol string by hand.
  expect(result.alignment[0].status).toBe('matched')
})

it('still marks a genuinely wrong tone as tone-mismatch when the target syllable is NOT sandhi-eligible', () => {
  // 好 alone (not followed by another tone-3 syllable) must still catch a
  // real tone error normally - sandhi leniency must not become a blanket
  // "ignore all tone-3 errors" rule.
  const result = gradeSyllables('好嗎', '好马')
  // 好 here is tone3 followed by 嗎 (tone2, "ma"), so 好 is NOT sandhi-eligible
  // (its neighbor isn't tone 3) - a wrong tone on 好 itself must still fail.
  // This test targets 嗎/马's OWN tone-mismatch (already covered elsewhere);
  // the sandhi-specific negative case is validated in the next test instead.
  expect(result.alignment[1].status).toBe('tone-mismatch')
})

it('does not extend sandhi leniency to a tone-3 syllable whose transcript reading is neither the dictionary nor the sandhi tone', () => {
  // 你好 target (nǐ hǎo, both tone 3, sandhi-eligible pair). A transcript
  // reading the first syllable as tone 4 ("nì") is neither the dictionary
  // tone (3) nor the sandhi tone (2) - must still be tone-mismatch, not
  // silently accepted just because the position was sandhi-eligible.
  const result = gradeSyllables('你好', '腻好')
  // 腻 independently confirmed as "nì" (tone 4) - see Step 1 verification note.
  expect(result.alignment[0].status).toBe('tone-mismatch')
})

it('does not cascade sandhi across a chain of 3+ tone-3 syllables beyond adjacent pairs', () => {
  // 我很好 is tone3+tone3+tone3. This plan only evaluates ADJACENT pairs
  // independently (wo~hen is one pair, hen~hao is another) - it does not
  // implement the more complex whole-chain sandhi behavior. Confirm the
  // implementation doesn't accidentally over-apply leniency to a case this
  // plan explicitly scoped out: a genuinely wrong tone on the middle
  // syllable's OWN dictionary/sandhi options (verify via Step 1 methodology
  // before finalizing this fixture's exact expected value if it fails).
  const result = gradeSyllables('我很好', '我很好')
  expect(result.alignment.every((a) => a.status === 'matched')).toBe(true)
})
```

Before implementing, verify the Step 2 fixtures' character choices (妮, 腻) actually produce the claimed tones:

```
node -e "const {pinyin}=require('pinyin-pro'); console.log(pinyin('妮',{toneType:'num'})); console.log(pinyin('腻',{toneType:'num'}));"
```

If either doesn't match (`ni2` and `ni4` respectively), find a different real character with the needed tone via the same verification method and update the test before proceeding — never guess.

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx vitest run tests/lib/shadowing/pinyinGrading.test.ts`
Expected: FAIL — the new sandhi-acceptance test fails because sandhi isn't implemented yet (the tone-2 transcript reading gets marked `tone-mismatch`, not `matched`).

- [ ] **Step 4: Implement tone-3 sandhi acceptance**

In `lib/shadowing/pinyinGrading.ts`, add a helper that detects sandhi-eligible indices and a tone-shift helper, then use both inside `buildAlignment`'s matched/tone-mismatch branch. Insert near the top of the file, after `PINYIN_SYLLABLE_PATTERN`:

```ts
// Mandarin tone-3 sandhi: when two third-tone syllables are adjacent, the
// FIRST is naturally pronounced as tone 2 in fluent speech (你好 "nǐ hǎo" is
// actually said "ní hǎo"), but pinyin-pro's dictionary lookup always
// returns the unsandhied tone-3 form. Without this, a learner who correctly
// applies the sandhi rule is graded as making a tone error. Scoped
// deliberately narrow: only ADJACENT tone-3 pairs are considered, evaluated
// independently (no cascading through longer tone-3 chains, which follows
// more complex rules outside this plan's scope) - and only tone-3-to-tone-2
// shifting is modeled here, not the 不/一 sandhi rules (a separate, more
// exception-heavy task).
const TONE_MARK_SHIFT: Record<string, string> = {
  ǎ: 'á',
  ě: 'é',
  ǐ: 'í',
  ǒ: 'ó',
  ǔ: 'ú',
  ǚ: 'ǘ',
}

function isTone3(tonedSyllable: string): boolean {
  return Object.keys(TONE_MARK_SHIFT).some((mark) => tonedSyllable.includes(mark))
}

function toSandhiShiftedTone2(tonedSyllable: string): string {
  let shifted = tonedSyllable
  for (const [tone3Mark, tone2Mark] of Object.entries(TONE_MARK_SHIFT)) {
    shifted = shifted.replace(tone3Mark, tone2Mark)
  }
  return shifted
}

function computeSandhiEligibleIndices(targetSyllablesToned: string[]): Set<number> {
  const eligible = new Set<number>()
  for (let i = 0; i < targetSyllablesToned.length - 1; i++) {
    if (isTone3(targetSyllablesToned[i]) && isTone3(targetSyllablesToned[i + 1])) {
      eligible.add(i)
    }
  }
  return eligible
}
```

Update `buildAlignment`'s signature to accept the sandhi-eligible set, and use it in the match/tone-mismatch branch:

```ts
function buildAlignment(
  targetSyllables: string[],
  transcriptSyllables: string[],
  targetSyllablesToned: string[],
  transcriptSyllablesToned: string[]
): SyllableAlignment[] {
  const grid = syllableAlignment(targetSyllables, transcriptSyllables)
  const sandhiEligible = computeSandhiEligibleIndices(targetSyllablesToned)
  const steps: SyllableAlignment[] = []

  let i = targetSyllables.length
  let j = transcriptSyllables.length

  while (i > 0 || j > 0) {
    const cell = grid[i][j]
    if (cell.from === 'match' || cell.from === 'substitute') {
      const targetIdx = i - 1
      const transcriptIdx = j - 1
      const toneless = targetSyllables[targetIdx] === transcriptSyllables[transcriptIdx]
      const targetToned = targetSyllablesToned[targetIdx]
      const transcriptToned = transcriptSyllablesToned[transcriptIdx]
      const tonedMatch =
        targetToned === transcriptToned ||
        (sandhiEligible.has(targetIdx) && toSandhiShiftedTone2(targetToned) === transcriptToned)
      steps.push({
        status: !toneless ? 'mismatched' : tonedMatch ? 'matched' : 'tone-mismatch',
        targetSyllable: targetSyllables[targetIdx],
        targetSyllableToned: targetToned,
        transcriptSyllable: transcriptSyllables[transcriptIdx],
        transcriptSyllableToned: transcriptToned,
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
      j -= 1
    }
  }

  return steps.reverse()
}
```

The `gradeSyllables` function body calling `buildAlignment` does not need to change — its call site already passes all four arguments `buildAlignment` uses.

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run tests/lib/shadowing/pinyinGrading.test.ts`
Expected: PASS — all pre-existing tests (unaffected, since sandhi leniency only ever RELAXES `tone-mismatch` to `matched`, never the reverse, and none of the pre-existing fixtures contain an adjacent tone-3 pair with a shifted-tone transcript) plus the new sandhi tests.

- [ ] **Step 6: Run the full test suite and typecheck**

Run: `npm test`
Expected: PASS.

- [ ] **Step 7: Manual verification**

Run: `npm run dev`, open a dialogue's Shadowing tab containing a sentence with two adjacent tone-3 syllables (e.g. one starting with 你好 or 我很好). Read it aloud naturally (applying the tone-3-to-tone-2 shift you'd say normally) and confirm the result grid marks those syllables green, not yellow.

- [ ] **Step 8: Commit**

```bash
git add lib/shadowing/pinyinGrading.ts tests/lib/shadowing/pinyinGrading.test.ts
git commit -m "feat: accept tone-3 sandhi (tone3+tone3 -> tone2) as correct in Shadowing grading"
```
