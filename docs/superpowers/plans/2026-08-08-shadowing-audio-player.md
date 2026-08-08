# Shadowing Audio Player + Auto-Pause Toggle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a sample-audio player with an "Tự động dừng" (auto-pause) toggle to `ShadowingScreen`, matching `easy-chinese`'s two playback modes: auto-pause after each line (grading stays as-is) vs. continuous playback through the whole dialogue (grading is disabled, recording is still available for self-listening only).

**Architecture:** Extend the existing `ShadowingScreen.tsx` client component in place — add `isAutoPause`/`isPlaying` state and an `<audio>` element wired to the current line's `audio_url`, with an `onended` handler that branches on `isAutoPause`. Gate the grading call (`gradeSyllables`/`setResult`) behind `isAutoPause` so continuous mode never grades. No new files, no new routes, no schema changes.

**Tech Stack:** Next.js client component (existing), TypeScript, Tailwind 4 theme tokens, Vitest + Testing Library.

## Global Constraints

- This is an addendum to the already-merged Shadowing feature (`main` at `95c5386`). Do not touch `ListenTab.tsx`, `useSpeechRecognition.ts`, or `pinyinGrading.ts` — this plan only modifies `ShadowingScreen.tsx` and its test file.
- Default state of "Tự động dừng" is **ON** (`isAutoPause: true`) — this preserves the exact behavior already shipped and tested (grade-on-stop) as the default experience; nothing about the already-merged grading flow changes when the toggle is on.
- When `isAutoPause` is `false` (continuous playback): recording (`startRecording`/`stopRecording`) and playback-of-own-recording (`playRecorded`) remain fully functional, but `gradeSyllables` must never be called and the result card must never render. This was an explicit, deliberate simplification the project owner chose over synchronizing audio timestamps with recording windows — do not "improve" this by adding timestamp-based grading.
- Follow existing UI conventions: Tailwind theme tokens only (`brand-red`, `brand-gold`, `ink`, `ink-faint`, `ink-muted`, `card-border`, `rounded-card`, `rounded-btn`, `rounded-pill`) — no hardcoded hex. Toggle switch styling should match the pattern already used elsewhere in this codebase (check `DialogueDetailPage.tsx`'s tab buttons or similar for the established interactive-control look) or approximate `easy-chinese`'s toggle (`bg-[#C1272D]` → use `bg-brand-red` instead) translated to theme tokens.
- A line with `audio_url: null` must not crash the player — the Play button must be disabled for such a line, matching the exact pattern already used in `ListenTab.tsx` (`disabled={!line.audio_url}`).
- Do not modify `main` directly. Work happens in the `shadowing-audio-player` branch/worktree at `e:\HuaYu\HuaYu-user\.worktrees\shadowing-audio-player`.

---

## Task 1: Add audio player + auto-pause toggle to ShadowingScreen

**Files:**
- Modify: `app/(protected)/books/[bookId]/lessons/[lessonId]/dialogue/[dialogueId]/ShadowingScreen.tsx`
- Modify: `tests/components/dialogue/ShadowingScreen.test.tsx`

**Interfaces:**
- Consumes: `Dialogue`/`DialogueLine` types (unchanged), `gradeSyllables`, `useSpeechRecognition` (unchanged, already merged).
- Produces: nothing consumed by other files — this is the leaf UI component, no downstream interface changes.

- [ ] **Step 1: Write the failing tests**

Add these test cases to `tests/components/dialogue/ShadowingScreen.test.tsx`. First, update the shared `dialogue` fixture at the top of the file to give both lines real `audio_url` values so playback can be exercised, and add a `MockAudio` stub (mirroring the pattern already used in `tests/components/typing/SentenceTypingTab.test.tsx` and `tests/components/dialogue/ListenTab.test.tsx` — check those files for the exact established shape before writing this one, to stay consistent):

```tsx
// Replace the existing `dialogue` fixture with:
const dialogue: Dialogue = {
  id: 'd1',
  order: 1,
  kind: 'dialogue',
  audio_url: null,
  lines: [
    { id: 'l1', order: 1, speaker_zh: null, text_zh: '你好嗎', pinyin: 'nǐ hǎo ma', translation_vi: 'bạn khỏe không', audio_url: 'l1.mp3' },
    { id: 'l2', order: 2, speaker_zh: null, text_zh: '我很好', pinyin: 'wǒ hěn hǎo', translation_vi: 'tôi khỏe', audio_url: 'l2.mp3' },
  ],
}

// Add near the top, alongside the other mocks:
const playMock = vi.fn().mockResolvedValue(undefined)
const pauseMock = vi.fn()
const audioInstances: MockAudio[] = []

class MockAudio {
  currentTime = 0
  onended: (() => void) | null = null
  constructor(public src: string) {
    audioInstances.push(this)
  }
  play = playMock
  pause = pauseMock
}
vi.stubGlobal('Audio', MockAudio)
```

Add `audioInstances.length = 0; playMock.mockClear(); pauseMock.mockClear()` to the existing `beforeEach`.

Then add these test cases inside the `describe('ShadowingScreen', ...)` block:

```tsx
it('shows the "Tự động dừng" toggle, defaulting to ON', () => {
  render(<ShadowingScreen dialogue={dialogue} />)
  const toggle = screen.getByRole('switch', { name: /Tự động dừng/i })
  expect(toggle).toHaveAttribute('aria-checked', 'true')
})

it('plays the current line\'s audio when the play button is clicked', () => {
  render(<ShadowingScreen dialogue={dialogue} />)
  fireEvent.click(screen.getByRole('button', { name: /^Nghe mẫu$/i }))
  expect(playMock).toHaveBeenCalled()
  expect(audioInstances[0].src).toBe('l1.mp3')
})

it('does not advance to the next line when auto-pause is ON and playback ends', () => {
  render(<ShadowingScreen dialogue={dialogue} />)
  fireEvent.click(screen.getByRole('button', { name: /^Nghe mẫu$/i }))
  act(() => {
    audioInstances[0].onended?.()
  })
  expect(screen.getByText('你好嗎')).toBeInTheDocument()
  expect(screen.queryByText('我很好')).not.toBeInTheDocument()
})

it('advances to the next line and keeps playing when auto-pause is OFF and playback ends', () => {
  render(<ShadowingScreen dialogue={dialogue} />)
  fireEvent.click(screen.getByRole('switch', { name: /Tự động dừng/i }))
  fireEvent.click(screen.getByRole('button', { name: /^Nghe mẫu$/i }))
  act(() => {
    audioInstances[0].onended?.()
  })
  expect(screen.getByText('我很好')).toBeInTheDocument()
  expect(audioInstances[1]?.src).toBe('l2.mp3')
})

it('does not grade or show a result when auto-pause is OFF, even after recording stops with a transcript', async () => {
  render(<ShadowingScreen dialogue={dialogue} />)
  fireEvent.click(screen.getByRole('switch', { name: /Tự động dừng/i }))

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

  expect(screen.queryByText(/Phát âm chính xác/i)).not.toBeInTheDocument()
  expect(screen.queryByText(/Chưa chính xác/i)).not.toBeInTheDocument()
  expect(screen.queryByText(/không nghe rõ/i)).not.toBeInTheDocument()
  // Recording itself still works: replay button is enabled once stopped.
  expect(screen.getByRole('button', { name: /Phát lại ghi âm/i })).toBeEnabled()
})

it('still grades normally when auto-pause is ON (unchanged default behavior)', async () => {
  render(<ShadowingScreen dialogue={dialogue} />)
  // Toggle defaults to ON - do not click it.
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
  expect(screen.getByText(/Phát âm chính xác/i)).toBeInTheDocument()
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/components/dialogue/ShadowingScreen.test.tsx`
Expected: FAIL — `getByRole('switch', ...)` and `getByRole('button', { name: /^Nghe mẫu$/i })` not found; the pre-existing tests should still pass since they don't touch new behavior (they use `audio_url: null` — wait, this step updates the fixture to have real audio_url, so re-check: the pre-existing tests only assert on ghi-âm/grading text, not on the play button, so they remain valid regardless of `audio_url` values).

- [ ] **Step 3: Implement the audio player and toggle in `ShadowingScreen.tsx`**

Replace `app/(protected)/books/[bookId]/lessons/[lessonId]/dialogue/[dialogueId]/ShadowingScreen.tsx` with:

```tsx
'use client'

import { useRef, useState } from 'react'
import { Mic, Pause, Play, Square } from 'lucide-react'
import type { Dialogue } from '@/lib/db/types'
import { gradeSyllables, type GradeResult } from '@/lib/shadowing/pinyinGrading'
import { useSpeechRecognition } from '@/lib/shadowing/useSpeechRecognition'

export default function ShadowingScreen({ dialogue }: { dialogue: Dialogue }) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isRecording, setIsRecording] = useState(false)
  const [recordedUrl, setRecordedUrl] = useState<string | null>(null)
  const [result, setResult] = useState<GradeResult | null>(null)
  const [permissionError, setPermissionError] = useState(false)
  const [isAutoPause, setIsAutoPause] = useState(true)
  const [isPlaying, setIsPlaying] = useState(false)

  const currentIndexRef = useRef(currentIndex)
  currentIndexRef.current = currentIndex
  const isAutoPauseRef = useRef(isAutoPause)
  isAutoPauseRef.current = isAutoPause

  const currentLine = dialogue.lines[currentIndex]

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const transcriptRef = useRef<string>('')
  const recordedAudioRef = useRef<HTMLAudioElement | null>(null)
  const sampleAudioRef = useRef<HTMLAudioElement | null>(null)

  // Grading must wait for SpeechRecognition to genuinely finish, not for
  // MediaRecorder.onstop (which fires the instant the user clicks "stop").
  // `onresult` is asynchronous and often arrives after that click in real
  // browsers, so grading here - triggered by `onend`, which the Web Speech
  // API spec guarantees always fires after `onresult`/`onerror` - is what
  // guarantees we grade the final, settled transcript instead of a stale
  // or empty one.
  //
  // Grading only ever applies to a single, unambiguous line: when
  // continuous playback ("Tự động dừng" OFF) is active, there is no
  // reliable way to know which line the user was practicing when they
  // hit record, so grading is skipped entirely rather than guessed at.
  const speech = useSpeechRecognition(
    (transcript) => {
      transcriptRef.current = transcript
    },
    () => {
      if (!isAutoPauseRef.current) return
      setResult(gradeSyllables(currentLine.text_zh, transcriptRef.current))
    }
  )

  function playSample() {
    if (!currentLine.audio_url) return
    sampleAudioRef.current?.pause()
    const audio = new Audio(currentLine.audio_url)
    sampleAudioRef.current = audio
    setIsPlaying(true)

    audio.onended = () => {
      if (isAutoPauseRef.current) {
        setIsPlaying(false)
        return
      }
      const nextIndex = currentIndexRef.current + 1
      if (nextIndex < dialogue.lines.length) {
        setCurrentIndex(nextIndex)
        setResult(null)
        setRecordedUrl(null)
        const nextLine = dialogue.lines[nextIndex]
        if (nextLine.audio_url) {
          const nextAudio = new Audio(nextLine.audio_url)
          sampleAudioRef.current = nextAudio
          nextAudio.onended = audio.onended
          nextAudio.play()
        } else {
          setIsPlaying(false)
        }
      } else {
        setIsPlaying(false)
      }
    }

    audio.play()
  }

  function pauseSample() {
    sampleAudioRef.current?.pause()
    setIsPlaying(false)
  }

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      setPermissionError(false)
      setResult(null)
      transcriptRef.current = ''
      chunksRef.current = []

      const recorder = new MediaRecorder(stream)
      mediaRecorderRef.current = recorder

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
        setRecordedUrl(URL.createObjectURL(blob))
        stream.getTracks().forEach((track) => track.stop())
      }

      // Start together: SpeechRecognition needs a live microphone stream,
      // so it must start alongside the recorder, not after it stops (the
      // prior implementation attempt started recognition post-stop and it
      // silently produced no transcript).
      recorder.start()
      speech.start()
      setIsRecording(true)
    } catch {
      setPermissionError(true)
    }
  }

  function stopRecording() {
    mediaRecorderRef.current?.stop()
    speech.stop()
    setIsRecording(false)
  }

  function playRecorded() {
    if (!recordedUrl) return
    const audio = new Audio(recordedUrl)
    recordedAudioRef.current = audio
    audio.play()
  }

  function selectLine(index: number) {
    sampleAudioRef.current?.pause()
    setIsPlaying(false)
    setCurrentIndex(index)
    setResult(null)
    setRecordedUrl(null)
  }

  return (
    <div className="flex flex-col gap-6">
      {permissionError && (
        <div className="rounded-card-sm border border-error-border bg-error-bg p-4 text-center text-sm font-medium text-error-text">
          Không thể truy cập Micro. Vui lòng cấp quyền sử dụng Micro trong cài đặt trình duyệt.
        </div>
      )}

      <div className="flex items-center justify-between rounded-card-sm border border-card-border bg-white px-4 py-3 shadow-sm">
        <button
          type="button"
          onClick={isPlaying ? pauseSample : playSample}
          disabled={!currentLine.audio_url}
          className={`flex items-center justify-center gap-2 rounded-btn px-4 py-2 text-sm font-bold transition-all ${
            currentLine.audio_url
              ? 'bg-brand-red text-white hover:bg-brand-red-dark'
              : 'cursor-not-allowed bg-card-border text-ink-faint'
          }`}
        >
          {isPlaying ? <Pause className="h-4 w-4" strokeWidth={2.5} /> : <Play className="h-4 w-4" strokeWidth={2.5} />}
          {isPlaying ? 'Tạm dừng' : 'Nghe mẫu'}
        </button>

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

      <div className="rounded-card border border-card-border bg-white p-6 text-center shadow-sm">
        {currentLine.speaker_zh && (
          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-ink-faint">{currentLine.speaker_zh}</p>
        )}
        <h2 className="font-han-title text-3xl font-bold text-ink">{currentLine.text_zh}</h2>
        {currentLine.pinyin && <p className="mt-3 text-xl font-medium tracking-wide text-brand-gold">{currentLine.pinyin}</p>}
        {currentLine.translation_vi && <p className="mt-3 text-ink-muted">{currentLine.translation_vi}</p>}
      </div>

      <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
        <button
          type="button"
          onClick={playRecorded}
          disabled={!recordedUrl}
          className={`flex items-center justify-center gap-2 rounded-btn border-2 px-6 py-3 text-sm font-bold tracking-wide transition-all ${
            recordedUrl
              ? 'border-brand-gold text-brand-gold hover:bg-brand-gold/5'
              : 'cursor-not-allowed border-card-border text-ink-faint'
          }`}
        >
          <Play className="h-4 w-4" strokeWidth={2.5} />
          Phát lại ghi âm
        </button>

        {isRecording ? (
          <button
            type="button"
            onClick={stopRecording}
            className="flex animate-pulse items-center justify-center gap-2 rounded-btn bg-brand-red px-8 py-3 text-sm font-bold tracking-wide text-white transition-all hover:bg-brand-red-dark"
          >
            <Square className="h-4 w-4" strokeWidth={2.5} />
            Dừng ghi âm
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
      </div>

      {!speech.isSupported && (
        <p className="text-center text-sm text-ink-faint">
          Trình duyệt không hỗ trợ nhận diện giọng nói. Vui lòng dùng Chrome hoặc Edge.
        </p>
      )}

      {!isAutoPause && (
        <p className="text-center text-sm text-ink-faint">
          Bật &quot;Tự động dừng&quot; để được chấm điểm phát âm theo từng câu.
        </p>
      )}

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
          <div className="flex flex-col gap-1 text-sm">
            <p>
              <span className="font-bold text-ink-faint">Mẫu: </span>
              {result.targetSyllablesToned.join(' ')}
            </p>
            <p>
              <span className="font-bold text-ink-faint">Bạn đọc: </span>
              {result.transcriptSyllablesToned.join(' ') || '(không nghe rõ)'}
            </p>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-3">
        {dialogue.lines.map((line, index) => {
          if (index === currentIndex) return null
          return (
            <button
              key={line.id}
              type="button"
              onClick={() => selectLine(index)}
              className="rounded-card-sm border border-card-border bg-white/60 px-5 py-4 text-left opacity-70 shadow-sm transition-all hover:opacity-100"
            >
              <span className="font-han-title text-lg font-bold text-ink">{line.text_zh}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
```

Notes on the implementation:
- `currentIndexRef`/`isAutoPauseRef` are synced every render and read inside the `audio.onended` closure to avoid the stale-closure bug this codebase has hit twice before (see `useSpeechRecognition.ts`'s `onResultRef` for the established pattern) — `onended` is assigned once per `Audio` instance at creation time, so it must read fresh values via refs, not closed-over state.
- The auto-advance chain in `playSample`'s `onended` handler manually constructs and plays the next `Audio` rather than calling `playSample()` recursively, because `playSample` reads `currentLine` from render-time state (stale during the callback) — this local advancement is simpler than restructuring `playSample` to accept an explicit index. If this feels awkward during implementation, an acceptable alternative is extracting a `playLineAt(index: number)` helper that both `playSample` and the auto-advance branch call — use whichever reads more clearly, the test assertions only care about observable behavior (which line's audio plays next), not the internal call shape.
- `isAutoPause && result` in the render gates the whole result card on the toggle, not just on having a `result` value — combined with the `onEnd` callback's own `if (!isAutoPauseRef.current) return` guard, this double-guards against ever showing a stale result if the user toggles modes mid-flow.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/components/dialogue/ShadowingScreen.test.tsx`
Expected: PASS (10 tests: the 4 pre-existing + 6 new)

- [ ] **Step 5: Run the full test suite and typecheck**

Run: `npm test`
Expected: PASS — all test files pass, no regressions in `ListenTab`, `DialogueDetailPage`, or any other test.

- [ ] **Step 6: Manual verification**

Run: `npm run dev`, open a dialogue's Shadowing tab in Chrome with a lesson that has real per-line `audio_url` values. Confirm:
- "Tự động dừng" toggle is ON by default, "Nghe mẫu" plays the current line and stops at its end.
- Toggling OFF and clicking "Nghe mẫu" auto-advances through all lines continuously.
- With the toggle OFF, recording + "Phát lại ghi âm" still work, but no grading result appears.
- Toggling back ON and recording again shows the grading result as before.

- [ ] **Step 7: Commit**

```bash
git add "app/(protected)/books/[bookId]/lessons/[lessonId]/dialogue/[dialogueId]/ShadowingScreen.tsx" tests/components/dialogue/ShadowingScreen.test.tsx docs/superpowers/specs/2026-08-08-dialogue-shadowing-design.md docs/superpowers/plans/2026-08-08-shadowing-audio-player.md
git commit -m "feat: add sample audio player with auto-pause toggle to ShadowingScreen"
```
