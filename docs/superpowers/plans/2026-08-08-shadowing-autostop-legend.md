# Shadowing Auto-Stop-on-Silence + Color Legend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix a real bug the project owner hit: `SpeechRecognition` (with `continuous = false`) auto-stops itself and fires `onend` as soon as the browser detects silence, even if the user hasn't clicked "Dừng ghi âm" yet — the graded result appeared while `MediaRecorder` (used for "Phát lại ghi âm") and `isRecording` were still running, and clicking "Dừng ghi âm" afterward hit a broken second attempt on an already-stopped recognizer, producing a spurious "Không nhận diện được" error. Fix: when recognition ends on its own (not via the user clicking stop), automatically stop the recording too and show the result, exactly as if the user had clicked stop. Also add a fixed color legend under the result tile grid explaining green/yellow/red, per a reference screenshot the project owner provided.

**Architecture:** `ShadowingScreen.tsx`'s `onEnd` callback (passed to `useSpeechRecognition`) currently assumes it only ever fires after `stopRecording()` already ran. It now needs to also handle the case where recognition ends BEFORE the user clicked stop — detected via a new `isRecordingRef` check — and in that case call the same recording-stop logic (`mediaRecorderRef.current?.stop()`, `setIsRecording(false)`) itself before grading. No changes to `useSpeechRecognition.ts`'s timeout/stop mechanics (already reviewed and merged) are needed — this is purely about `ShadowingScreen.tsx` reacting correctly to an `onEnd` that arrives unprompted.

**Tech Stack:** Next.js client component, TypeScript, Tailwind 4 theme tokens, Vitest + Testing Library.

## Global Constraints

- Do not modify `lib/shadowing/useSpeechRecognition.ts` or `lib/shadowing/pinyinGrading.ts` — this plan is scoped entirely to `ShadowingScreen.tsx` and its test file.
- The existing "user clicks Dừng ghi âm" path must behave EXACTLY as before this change (no regression to the already-reviewed timeout/grading-ordering logic) — this plan only adds handling for the previously-unhandled case where `onEnd` arrives while `isRecording` is still `true`.
- Follow existing UI conventions: Tailwind theme tokens only (`success-text`/`ink-gold-text`/`error-text` already used for the three status colors elsewhere in this file — reuse the exact same tokens for the legend, don't introduce new ones) — no hardcoded hex.
- The color legend's three labels must use the exact wording already established elsewhere in this file for consistency: "Chính xác" (matches `result.status === 'correct'`'s green), "Gần đúng — sai nhẹ" (matches `tone-mismatch`'s yellow), "Thử lại" (matches `mismatched`/`missing`'s red) — per the reference screenshot's own wording, adapted to fit this codebase's tone.
- Do not modify `main` directly. Work happens in the `shadowing-autostop-legend` branch/worktree at `e:\HuaYu\HuaYu-user\.worktrees\shadowing-autostop-legend`.

---

## Task 1: Auto-stop recording when SpeechRecognition ends on its own

**Files:**
- Modify: `app/(protected)/books/[bookId]/lessons/[lessonId]/dialogue/[dialogueId]/ShadowingScreen.tsx`
- Modify: `tests/components/dialogue/ShadowingScreen.test.tsx`

**Interfaces:**
- Consumes: `useSpeechRecognition`'s existing `onEnd` callback signature (unchanged).
- Produces: nothing consumed elsewhere — leaf UI component.

- [ ] **Step 1: Write the failing test**

Add this test to `tests/components/dialogue/ShadowingScreen.test.tsx`, inside the existing `describe('ShadowingScreen', ...)` block. Check the file's existing `MockMediaRecorder`/`MockSpeechRecognition` mocks first (they're already in the file — reuse them exactly, don't redefine):

```tsx
it('auto-stops recording and grades the result when SpeechRecognition ends on its own before the user clicks "Dừng ghi âm"', async () => {
  render(<ShadowingScreen dialogue={dialogue} />)
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: /^Ghi âm$/i }))
  })

  // Browser detected silence and auto-stopped recognition - the user never
  // clicked "Dừng ghi âm". This must behave exactly as if they had.
  act(() => {
    lastRecognition.onresult({ results: [[{ transcript: '你好嗎' }]] })
  })
  act(() => {
    lastRecognition.onend()
  })

  // Recording itself must have been stopped (MediaRecorder.stop() called),
  // not left running - otherwise a later manual stop would hit a broken
  // second attempt on an already-ended recognizer.
  expect(recorderInstances[0].state).toBe('inactive')
  expect(screen.getByRole('button', { name: /^Ghi âm$/i })).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /Dừng ghi âm/i })).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /Đang xử lý/i })).not.toBeInTheDocument()

  // Result must be graded and shown, same as the manual-stop path.
  expect(screen.getByText(/Phát âm chính xác/i)).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /Phát lại ghi âm/i })).toBeEnabled()
})

it('still works normally when the user manually clicks "Dừng ghi âm" before recognition ends (no double-stop)', async () => {
  render(<ShadowingScreen dialogue={dialogue} />)
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: /^Ghi âm$/i }))
  })
  act(() => {
    lastRecognition.onresult({ results: [[{ transcript: '你好嗎' }]] })
  })
  act(() => {
    fireEvent.click(screen.getByRole('button', { name: /Dừng ghi âm/i }))
  })
  act(() => {
    lastRecognition.onend()
  })

  expect(recorderInstances[0].state).toBe('inactive')
  expect(screen.getByText(/Phát âm chính xác/i)).toBeInTheDocument()
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/components/dialogue/ShadowingScreen.test.tsx`
Expected: FAIL on the first new test — recording stays `'recording'`, and `isRecording`/`isGrading` UI states get stuck since nothing calls `mediaRecorderRef.current?.stop()`/`setIsRecording(false)` when `onEnd` arrives unprompted.

- [ ] **Step 3: Implement auto-stop**

In `app/(protected)/books/[bookId]/lessons/[lessonId]/dialogue/[dialogueId]/ShadowingScreen.tsx`, add an `isRecordingRef` near the other refs (following the file's existing ref-sync pattern):

```tsx
  const isRecordingRef = useRef(isRecording)
  isRecordingRef.current = isRecording
```

Extract the recording-stop side effects (currently only in `stopRecording`) into a small helper both `stopRecording` and the auto-stop path can call, and update the `onEnd` callback to detect and handle the unprompted case. Replace the `speech` declaration and `stopRecording` function with:

```tsx
  function stopMediaRecording() {
    mediaRecorderRef.current?.stop()
    setIsRecording(false)
  }

  const speech = useSpeechRecognition(
    (transcript) => {
      transcriptRef.current = transcript
    },
    () => {
      // SpeechRecognition can end on its own (browser detected silence)
      // before the user clicks "Dừng ghi âm" - continuous=false means the
      // recognizer doesn't wait indefinitely. When that happens, the
      // recording (MediaRecorder) and isRecording state are still running
      // and must be stopped here too, exactly as stopRecording() would -
      // otherwise a later manual click hits an already-ended recognizer and
      // produces a spurious second failure.
      if (isRecordingRef.current) {
        stopMediaRecording()
        if (isAutoPauseRef.current) setIsGrading(true)
      }
      setIsGrading(false)
      if (!isAutoPauseRef.current) return
      if (gradingTimedOutRef.current) return
      setResult(gradeSyllables(currentLine.text_zh, transcriptRef.current))
    },
    () => {
      // Set the ref synchronously here - do NOT rely solely on the render-
      // derived `gradingTimedOutRef.current = gradingTimedOut` sync below.
      // onTimeout and onEnd fire back-to-back inside the same native
      // setTimeout callback in useSpeechRecognition's stop(), with no React
      // render able to run in between, so a ref that's only ever populated
      // by a render would still read stale (false) when onEnd checks it.
      gradingTimedOutRef.current = true
      setGradingTimedOut(true)
    }
  )

  function stopRecording() {
    stopMediaRecording()
    speech.stop()
    if (isAutoPauseRef.current) setIsGrading(true)
  }
```

Note the deliberate `setIsGrading(true)` immediately followed by `setIsGrading(false)` in the auto-stop branch within the same `onEnd` call: this keeps the visible state transitions consistent with the manual-stop path (briefly "grading", then immediately resolved) rather than skipping straight from "Ghi âm" recording UI to the result with no transition — React batches these into one render, so no flicker occurs, but the logic stays symmetric with `stopRecording()`'s existing `setIsGrading(true)` call. If tracing through this feels like unnecessary complexity once you're in the code, an equally correct simpler alternative is to skip setting `isGrading` true at all in the auto-stop branch (since grading resolves synchronously within the same callback) — use your judgment, but keep the test assertions (`isGrading`'s button never visibly appears in the final rendered output) passing either way.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/components/dialogue/ShadowingScreen.test.tsx`
Expected: PASS (all previous tests + 2 new ones)

- [ ] **Step 5: Run the full test suite and typecheck**

Run: `npm test`
Expected: PASS — no regressions elsewhere.

- [ ] **Step 6: Manual verification**

Run: `npm run dev`, open a dialogue's Shadowing tab in Chrome. Record a short reading, pause noticeably after speaking (don't click "Dừng ghi âm" yourself) and confirm the recording auto-stops and grades once the browser detects silence, with no need to click stop, and no error afterward.

- [ ] **Step 7: Commit**

```bash
git add "app/(protected)/books/[bookId]/lessons/[lessonId]/dialogue/[dialogueId]/ShadowingScreen.tsx" tests/components/dialogue/ShadowingScreen.test.tsx docs/superpowers/plans/2026-08-08-shadowing-autostop-legend.md
git commit -m "fix: auto-stop recording when SpeechRecognition ends before user clicks stop"
```

---

## Task 2: Color legend under the result tile grid

**Files:**
- Modify: `app/(protected)/books/[bookId]/lessons/[lessonId]/dialogue/[dialogueId]/ShadowingScreen.tsx`
- Modify: `tests/components/dialogue/ShadowingScreen.test.tsx`

**Interfaces:**
- Consumes: nothing new.
- Produces: nothing consumed elsewhere.

- [ ] **Step 1: Write the failing test**

Add this test to `tests/components/dialogue/ShadowingScreen.test.tsx`:

```tsx
it('shows a fixed color legend under the result tile grid explaining green/yellow/red', async () => {
  render(<ShadowingScreen dialogue={dialogue} />)
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: /^Ghi âm$/i }))
  })
  act(() => {
    lastRecognition.onresult({ results: [[{ transcript: '你好嗎' }]] })
  })
  act(() => {
    fireEvent.click(screen.getByRole('button', { name: /Dừng ghi âm/i }))
  })
  act(() => {
    lastRecognition.onend()
  })

  expect(screen.getByText('Chính xác')).toBeInTheDocument()
  expect(screen.getByText(/Gần đúng.*sai nhẹ/i)).toBeInTheDocument()
  expect(screen.getByText('Thử lại')).toBeInTheDocument()
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/components/dialogue/ShadowingScreen.test.tsx`
Expected: FAIL — legend text doesn't exist yet.

- [ ] **Step 3: Implement the legend**

In `app/(protected)/books/[bookId]/lessons/[lessonId]/dialogue/[dialogueId]/ShadowingScreen.tsx`, add the legend row immediately after the tile grid's closing `</div>` (the `flex flex-wrap gap-2` container holding the `result.alignment.map(...)` tiles), still inside the `isAutoPause && result && !gradingTimedOut` conditional block:

```tsx
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-card-border pt-3 text-xs font-semibold text-ink-faint">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-success-text" />
              Chính xác
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-ink-gold-text" />
              Gần đúng — sai nhẹ
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-error-text" />
              Thử lại
            </span>
          </div>
```

This sits as a sibling immediately after the tile-grid `<div>`, both inside the same outer result-card `<div>` that already has the status heading (`result.status === 'correct' && 'Phát âm chính xác!'`, etc.) above the tile grid — so the final order top-to-bottom is: status heading, tile grid, legend.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/components/dialogue/ShadowingScreen.test.tsx`
Expected: PASS (all previous tests + 1 new one)

- [ ] **Step 5: Run the full test suite and typecheck**

Run: `npm test`
Expected: PASS.

- [ ] **Step 6: Manual verification**

Run: `npm run dev`, record a Shadowing attempt and confirm the legend row (small colored dots + labels) appears under the tile grid every time a result is shown, matching the reference screenshot's intent (adapted wording).

- [ ] **Step 7: Commit**

```bash
git add "app/(protected)/books/[bookId]/lessons/[lessonId]/dialogue/[dialogueId]/ShadowingScreen.tsx" tests/components/dialogue/ShadowingScreen.test.tsx docs/superpowers/plans/2026-08-08-shadowing-autostop-legend.md
git commit -m "feat: add color legend under Shadowing result tile grid"
```
