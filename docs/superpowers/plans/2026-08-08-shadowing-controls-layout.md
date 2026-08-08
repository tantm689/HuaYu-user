# Shadowing Player Controls Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Regroup `ShadowingScreen`'s player controls into one clear row of four circular buttons — Câu trước (prev) / Reset (replay whole dialogue from the start) / Play-Pause / Câu sau (next) — placed directly beside the "Tự động dừng" toggle, replacing the current layout where the play button sits on its own row above the seek bar and prev/next sit far apart from the toggle on a separate row below.

**Architecture:** Pure UI reorganization inside `ShadowingScreen.tsx` — no new state beyond a `resetAndPlay` handler that reuses the existing `playLineAt`. Time display and seek bar stay on their own row exactly as before; only the button row and toggle are regrouped and a Reset button is added.

**Tech Stack:** Next.js client component (existing), TypeScript, Tailwind 4 theme tokens, lucide-react icons, Vitest + Testing Library.

## Global Constraints

- This is a layout-only addendum to the already-merged Shadowing feature. Do not touch `ListenTab.tsx`, `useSpeechRecognition.ts`, `pinyinGrading.ts`, or any file besides `ShadowingScreen.tsx` and its test file.
- Preserve every already-shipped, already-reviewed behavior exactly: cumulative time/seek bar computation, prev/next auto-play semantics (`goToLine`), the double-gated grading logic, pausing sample audio when recording starts, `audio_url: null` safety, playback-speed cycling, and the ref-based stale-closure-avoidance pattern (`currentIndexRef`, `isAutoPauseRef`, `playbackRateRef`).
- New "Reset" button: jumps to line index 0 and auto-plays it (same semantics as clicking a "Câu trước" all the way back to the start, but done in one action) — reuse `goToLine(0)`, do not write new playback logic for this.
- All four control buttons (prev / reset / play-pause / next) must be visually consistent circular icon buttons of the same size, matching the reference screenshot's grouped-pill look, using only this app's existing theme tokens (`brand-red`, `brand-red-dark`, `card-border`, `ink-faint`, `rounded-pill`) — no hardcoded hex.
- Do not modify `main` directly. Work happens in the `shadowing-controls-layout` branch/worktree at `e:\HuaYu\HuaYu-user\.worktrees\shadowing-controls-layout`.

---

## Task 1: Regroup player controls and add Reset button

**Files:**
- Modify: `app/(protected)/books/[bookId]/lessons/[lessonId]/dialogue/[dialogueId]/ShadowingScreen.tsx`
- Modify: `tests/components/dialogue/ShadowingScreen.test.tsx`

**Interfaces:**
- Consumes: nothing new — `goToLine`, `playLineAt`, `isAutoPause`, `isPlaying` all already exist in this file.
- Produces: nothing consumed elsewhere — leaf UI component.

- [ ] **Step 1: Write the failing tests**

Add these test cases to `tests/components/dialogue/ShadowingScreen.test.tsx`, inside the existing `describe('ShadowingScreen', ...)` block (the file already has a 3-line `dialogue` fixture and `MockAudio`/`playMock`/`audioInstances` set up from prior tasks — reuse them, don't recreate):

```tsx
it('shows a Reset button alongside prev/next and the auto-pause toggle', async () => {
  render(<ShadowingScreen dialogue={dialogue} />)
  await act(async () => {
    await Promise.resolve()
  })
  expect(screen.getByRole('button', { name: /Phát lại từ đầu/i })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /Câu trước/i })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /Câu sau/i })).toBeInTheDocument()
  expect(screen.getByRole('switch', { name: /Tự động dừng/i })).toBeInTheDocument()
})

it('jumps to the first line and plays it when Reset is clicked from a later line', async () => {
  render(<ShadowingScreen dialogue={dialogue} />)
  await act(async () => {
    await Promise.resolve()
  })
  fireEvent.click(screen.getByRole('button', { name: /Câu sau/i }))
  expect(screen.getByText('我很好')).toBeInTheDocument()
  playMock.mockClear()

  fireEvent.click(screen.getByRole('button', { name: /Phát lại từ đầu/i }))
  expect(screen.getByText('你好嗎')).toBeInTheDocument()
  expect(playMock).toHaveBeenCalled()
})

it('keeps Reset enabled on the first line (unlike "Câu trước", which disables there)', async () => {
  render(<ShadowingScreen dialogue={dialogue} />)
  await act(async () => {
    await Promise.resolve()
  })
  expect(screen.getByRole('button', { name: /Câu trước/i })).toBeDisabled()
  expect(screen.getByRole('button', { name: /Phát lại từ đầu/i })).toBeEnabled()
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/components/dialogue/ShadowingScreen.test.tsx`
Expected: FAIL — no button with accessible name "Phát lại từ đầu" exists yet.

- [ ] **Step 3: Regroup the controls and add Reset**

In `app/(protected)/books/[bookId]/lessons/[lessonId]/dialogue/[dialogueId]/ShadowingScreen.tsx`, add a `RotateCcw` import from `lucide-react` alongside the existing icon imports:

```tsx
import { ChevronLeft, ChevronRight, Mic, Pause, Play, RotateCcw, Square } from 'lucide-react'
```

Add a `resetAndPlay` function near `goToLine` (after it is fine):

```tsx
  function resetAndPlay() {
    goToLine(0)
  }
```

Replace the entire player-bar block (currently the outer `<div className="flex flex-col gap-3 rounded-card-sm border border-card-border bg-white px-4 py-3 shadow-sm">...</div>` containing the time/seek row and the separate prev/next+toggle row) with this restructured version — the time/seek row is unchanged, only the second row is reorganized:

```tsx
      <div className="flex flex-col gap-3 rounded-card-sm border border-card-border bg-white px-4 py-3 shadow-sm">
        <div className="flex items-center gap-3">
          <span className="w-[76px] shrink-0 text-sm font-semibold tabular-nums text-ink-faint">
            {formatTime(globalCurrentTime)} / {formatTime(totalDuration)}
          </span>

          <input
            type="range"
            role="slider"
            min={0}
            max={totalDuration || 100}
            value={globalCurrentTime}
            onChange={handleSeek}
            className="h-1.5 flex-1 cursor-pointer appearance-none rounded-pill bg-card-border accent-brand-red"
          />

          <button
            type="button"
            onClick={toggleSpeed}
            className="w-10 shrink-0 text-center text-sm font-bold text-ink-faint transition-colors hover:text-brand-red"
          >
            {playbackRate}x
          </button>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => goToLine(currentIndex - 1)}
              disabled={currentIndex === 0}
              aria-label="Câu trước"
              className="flex h-9 w-9 items-center justify-center rounded-pill bg-white text-ink-faint shadow-sm ring-1 ring-card-border transition-all hover:text-brand-red disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:text-ink-faint"
            >
              <ChevronLeft className="h-4 w-4" strokeWidth={2.5} />
            </button>
            <button
              type="button"
              onClick={resetAndPlay}
              aria-label="Phát lại từ đầu"
              className="flex h-9 w-9 items-center justify-center rounded-pill bg-white text-ink-faint shadow-sm ring-1 ring-card-border transition-all hover:text-brand-red"
            >
              <RotateCcw className="h-4 w-4" strokeWidth={2.5} />
            </button>
            <button
              type="button"
              onClick={() => (currentLine.audio_url ? (isPlaying ? pauseSample() : playSample()) : undefined)}
              disabled={!currentLine.audio_url}
              aria-label={isPlaying ? 'Tạm dừng' : 'Nghe mẫu'}
              className={`flex h-9 w-9 items-center justify-center rounded-pill transition-all ${
                currentLine.audio_url
                  ? 'bg-brand-red text-white hover:bg-brand-red-dark'
                  : 'cursor-not-allowed bg-card-border text-ink-faint'
              }`}
            >
              {isPlaying ? <Pause className="h-4 w-4" strokeWidth={2.5} /> : <Play className="h-4 w-4" strokeWidth={2.5} />}
            </button>
            <button
              type="button"
              onClick={() => goToLine(currentIndex + 1)}
              disabled={currentIndex === dialogue.lines.length - 1}
              aria-label="Câu sau"
              className="flex h-9 w-9 items-center justify-center rounded-pill bg-white text-ink-faint shadow-sm ring-1 ring-card-border transition-all hover:text-brand-red disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:text-ink-faint"
            >
              <ChevronRight className="h-4 w-4" strokeWidth={2.5} />
            </button>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-ink-faint">Tự động dừng</span>
            <button
              type="button"
              role="switch"
              aria-checked={isAutoPause}
              aria-label="Tự động dừng"
              onClick={() => setIsAutoPause((prev) => !prev)}
              className={`relative inline-flex h-6 w-11 items-center rounded-pill transition-colors ${
                isAutoPause ? 'bg-brand-red' : 'bg-card-border'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  isAutoPause ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
        </div>
      </div>
```

Notes:
- The play/pause button keeps its accessible name toggling between "Nghe mẫu"/"Tạm dừng" exactly as before — only its position moved (from the top row into the four-button group). Existing tests querying `getByRole('button', { name: /Phát|Nghe mẫu/i })` or similar should still find it; re-check any test that relied on the OLD row structure still passes (none should assume DOM position, only accessible name/role, per this file's established testing style).
- Reset (`resetAndPlay`) is intentionally never `disabled` — even on the first line, clicking it still restarts playback from `0:00`, which is meaningfully different from "no-op" (audio might be paused or partway through line 1).
- Speed button (`{playbackRate}x`) and its row stay untouched, still living on the time/seek row — the task only touches the second row's structure.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/components/dialogue/ShadowingScreen.test.tsx`
Expected: PASS (all previous tests + 3 new ones)

- [ ] **Step 5: Run the full test suite and typecheck**

Run: `npm test`
Expected: PASS — no regressions elsewhere.

- [ ] **Step 6: Manual verification**

Run: `npm run dev`, open a dialogue's Shadowing tab in Chrome. Confirm:
- Four circular buttons (prev, reset, play/pause, next) sit in one row, all the same size, matching the reference screenshot's grouped look.
- The "Tự động dừng" toggle sits directly beside that group, in the same row — not on a separate row far away.
- Reset jumps to and plays line 1 from anywhere in the dialogue, and is never disabled (even already on line 1).
- Time display and seek bar row above is unchanged.

- [ ] **Step 7: Commit**

```bash
git add "app/(protected)/books/[bookId]/lessons/[lessonId]/dialogue/[dialogueId]/ShadowingScreen.tsx" tests/components/dialogue/ShadowingScreen.test.tsx docs/superpowers/plans/2026-08-08-shadowing-controls-layout.md
git commit -m "feat: regroup Shadowing player controls into one row with Reset button"
```
