# Task 1 Report: Grading timeout in `useSpeechRecognition`

## Summary

Implemented the 10-second grading timeout fallback exactly per
`docs/superpowers/plans/2026-08-08-shadowing-timeout-sandhi.md` Task 1, steps 1-9.
Followed TDD: wrote the failing tests first, verified they failed for the
expected reason, implemented, verified all pass, ran the full suite +
typecheck, then committed.

## Files changed

- `lib/shadowing/useSpeechRecognition.ts` — added `GRADING_TIMEOUT_MS = 10_000`,
  a `timeoutRef`, a `clearGradingTimeout()` helper, a new optional third
  `onTimeout?: () => void` constructor argument (via `onTimeoutRef`), and
  `stop()` now arms a 10s `setTimeout` that (if it fires) calls
  `onTimeoutRef.current?.()` then `onEndRef.current?.()`. The real
  `recognition.onend` handler calls `clearGradingTimeout()` before its
  existing behavior, so the timeout never fires once `onend` arrives
  normally. Matches the plan's Step 3 code verbatim.
- `tests/lib/shadowing/useSpeechRecognition.test.ts` — added a new
  `describe('useSpeechRecognition timeout', ...)` block with
  `vi.useFakeTimers()`/`vi.useRealTimers()` in `beforeEach`/`afterEach`, and
  two tests:
  - "calls onTimeout and onEnd if recognition.onend never fires within 10
    seconds of stop()" — taken verbatim from the plan.
  - "does not call onTimeout if recognition.onend fires before the 10-second
    deadline" — the plan intentionally left this test's body unwritten,
    instructing me to first check how the existing file triggers a real
    `onend` on the mock. Found the established pattern used by the
    pre-existing "invokes onEnd when recognition.onend fires" test:
    `lastInstance?.onend?.()`. Reused that exact pattern before advancing
    fake timers by 10s, then asserted `onTimeout` was never called and
    `onEnd` was called exactly once (from the real event, not the timeout).
- `app/(protected)/books/[bookId]/lessons/[lessonId]/dialogue/[dialogueId]/ShadowingScreen.tsx` —
  added `gradingTimedOut` state + `gradingTimedOutRef`, passed a third
  `onTimeout` argument to `useSpeechRecognition` that sets
  `gradingTimedOut(true)`, guarded the existing `onEnd` grading callback
  with `if (gradingTimedOutRef.current) return` so a stale/truncated
  transcript is never graded after a timeout, reset `gradingTimedOut` to
  `false` in `startRecording`'s per-attempt reset block, and rendered a
  Vietnamese error message ("Không nhận diện được, vui lòng thử lại.")
  ahead of (and mutually exclusive with, via `!gradingTimedOut`) the normal
  result card. All per the plan's Step 5 code verbatim.
- `tests/components/dialogue/ShadowingScreen.test.tsx` — added the plan's
  Step 6 test verbatim: starts recording, clicks stop, confirms the
  "Đang xử lý" processing button appears, advances fake timers by 10s
  without ever firing `lastRecognition.onend`, then asserts the timeout
  error text appears, the processing button is gone, and the normal "Ghi
  âm" button has returned.

## Verification

- `npx vitest run tests/lib/shadowing/useSpeechRecognition.test.ts` —
  before implementation: 1 failed (the new "calls onTimeout and onEnd..."
  test), 7 passed, confirming the tests actually exercise new behavior.
  After implementation: all 8 passed.
- `npx vitest run tests/components/dialogue/ShadowingScreen.test.tsx` — all
  25 passed (24 pre-existing + 1 new), no regressions.
- `npm test` (runs `tsc --noEmit` then `vitest run` across the whole repo) —
  PASS: 36 test files, 215 tests, 0 failures, typecheck clean.
- Confirmed no Task 2 files (`lib/shadowing/pinyinGrading.ts`,
  `tests/lib/shadowing/pinyinGrading.test.ts`) were touched — `git status`
  before staging showed only the 4 Task 1 files modified.
- Confirmed the normal-path event ordering guarantee is preserved: `onEnd`
  is still only invoked from the real `recognition.onend` in the normal
  case; the timeout path is purely a fallback that also clears via the same
  `onEnd` callback, matching the plan's explicit constraint.

## Commit

`eb12af3` — "feat: add 10s grading timeout so Shadowing never hangs on Đang xử lý"
(4 files changed, 127 insertions(+), 12 deletions(-))

## Concerns

None. Manual browser verification (plan's Step 7 equivalent doesn't exist
for Task 1 — that's Task 2's manual step) was not separately run since
Task 1's component test already exercises the full ShadowingScreen flow
under fake timers; this is consistent with how the rest of the codebase's
UI logic is verified (via RTL tests, not manual browser runs) per the
existing test suite conventions.

---

# Fix Report: Critical finding — stale `gradingTimedOutRef` bypasses timeout guard

## Bug

`gradingTimedOutRef` was synced from `gradingTimedOut` state only in the
component's render body (`gradingTimedOutRef.current = gradingTimedOut`).
In `lib/shadowing/useSpeechRecognition.ts`'s `stop()`, the 10s fallback
`setTimeout` callback calls `onTimeoutRef.current?.()` (→
`setGradingTimedOut(true)`) and then, on the very next line, synchronously
`onEndRef.current?.()` (→ the `onEnd` callback in `ShadowingScreen.tsx`,
which reads `gradingTimedOutRef.current` to decide whether to call
`gradeSyllables`/`setResult`). Both calls happen inside the same native
`setTimeout` tick — `setGradingTimedOut(true)` only *schedules* a React
re-render; no render can run between the two calls. So when `onEnd` read
the ref, it was still `false` (last set by whatever render preceded the
timeout), the `if (gradingTimedOutRef.current) return` guard did not
trigger, and grading ran on a possibly-truncated/stale transcript anyway.
This was invisible in the UI only because `gradingTimedOut` being `true`
makes the timeout message render instead of the result card (see the
`isAutoPause && result && !gradingTimedOut` condition), masking the fact
that `gradeSyllables`/`setResult` had silently still executed underneath.

Same class of bug as the two prior stale-closure issues documented in this
file's comments, one layer deeper: here the ref itself was populated by a
mechanism (render) that hadn't run yet at read time, rather than the ref
being read inside a stale closure directly.

## Fix

In `ShadowingScreen.tsx`'s `useSpeechRecognition(...)` call, the
`onTimeout` callback now sets `gradingTimedOutRef.current = true`
synchronously, directly, in addition to calling `setGradingTimedOut(true)`:

```tsx
() => {
  gradingTimedOutRef.current = true
  setGradingTimedOut(true)
}
```

This makes the ref authoritative at the exact moment it's set, rather than
depending on a subsequent render to populate it — so by the time `onEnd`
runs synchronously right after, in the same tick, the guard correctly
short-circuits.

Kept the existing render-body sync line
(`gradingTimedOutRef.current = gradingTimedOut`) unchanged — it's still
needed for the normal case where `startRecording` resets `gradingTimedOut`
back to `false` and the ref must reflect that on the next render.

**Checked for reintroduced inconsistency:** could the render-derived sync
ever overwrite the ref back to `false` before `startRecording` explicitly
resets it? No — after `onTimeout` sets the ref to `true` and calls
`setGradingTimedOut(true)`, the resulting re-render runs the sync line with
`gradingTimedOut` now also `true` (React has applied the state update by
then), so the render-body line reaffirms `true`, it does not revert it.
The ref is only ever reset to `false` via `startRecording`'s explicit
`setGradingTimedOut(false)` call (which itself triggers a render that syncs
the ref back to `false` for the next attempt) — that path is intentional
and correct. No new inconsistency was introduced.

## Test

Added a new regression test to
`tests/components/dialogue/ShadowingScreen.test.tsx`:

> "never grades the transcript when the grading timeout fires (onTimeout
> and onEnd run synchronously in the same tick)"

It spies on `gradeSyllables` (imported as `import * as pinyinGrading from
'@/lib/shadowing/pinyinGrading'`, `vi.spyOn(pinyinGrading, 'gradeSyllables')`),
uses `vi.useFakeTimers()`, starts recording, clicks stop, lets
`recognition.onend` never fire (simulating the hang, same pattern as the
existing timeout test just above it), advances fake timers by 10s, then
asserts:
- the timeout message renders,
- `gradeSpy` was never called,
- no `syllable-tile` (result card markup) ever rendered.

**Verified TDD-style per instructions:**
- Ran the new test against the pre-fix code (`onTimeout` only called
  `setGradingTimedOut(true)`, no direct ref set) — it FAILED with
  `expected "gradeSyllables" to not be called at all, but actually been
  called 1 times`, called with `["你好嗎", ""]` — i.e. it graded the empty/
  stale transcript, exactly the bug described.
- Applied the fix, reran — test PASSED.
- Ran the full suite after the fix: 36 test files, 216 tests (215 baseline
  + 1 new), all passed. `npx tsc --noEmit` clean.

## Files changed

- `app/(protected)/books/[bookId]/lessons/[lessonId]/dialogue/[dialogueId]/ShadowingScreen.tsx`
  — `onTimeout` callback now sets `gradingTimedOutRef.current = true`
  synchronously before calling `setGradingTimedOut(true)`.
- `tests/components/dialogue/ShadowingScreen.test.tsx` — added
  `import * as pinyinGrading from '@/lib/shadowing/pinyinGrading'` and the
  new regression test described above.

## Concerns

None.
