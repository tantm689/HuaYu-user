# Shadowing Cumulative Audio Player Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace `ShadowingScreen`'s single round "Nghe mẫu" button with a full player bar — play/pause, cumulative time display (0:14 / 1:52 across the whole dialogue), a draggable seek bar, prev/next-line buttons (auto-playing on click), and a playback-speed toggle (1x/1.25x/0.75x) — porting the interaction pattern from `easy-chinese`'s `ShadowingClient.tsx` cumulative player onto this app's Tailwind theme tokens.

**Architecture:** All changes are contained in `ShadowingScreen.tsx`. Preload every line's audio duration once (via throwaway `Audio` objects, same technique as the reference project) to compute per-line durations and total duration. Track playback with `audioProgress` (seconds into the current line) and derive `globalCurrentTime` as the sum of durations of all lines before the current one plus `audioProgress`. Seeking maps a global timestamp back to a `(lineIndex, localTime)` pair. The existing recording/grading/auto-pause-toggle logic is untouched — only the sample-playback UI and its underlying `playSample`/`pauseSample` functions are replaced/extended.

**Tech Stack:** Next.js client component (existing), TypeScript, Tailwind 4 theme tokens, lucide-react icons, Vitest + Testing Library.

## Global Constraints

- This is an addendum to the already-merged Shadowing feature. Do not touch `ListenTab.tsx`, `useSpeechRecognition.ts`, `pinyinGrading.ts`, or any file besides `ShadowingScreen.tsx` and its test file.
- Preserve every already-shipped, already-reviewed behavior exactly: the "Tự động dừng" toggle's effect on auto-advance-after-line-ends, the double-gated grading logic (`isAutoPauseRef` in the `onEnd` callback + `isAutoPause && result` in the render), pausing sample audio when recording starts, `audio_url: null` safety, and the ref-based stale-closure-avoidance pattern already used for `currentIndexRef`/`isAutoPauseRef`.
- Follow existing UI conventions: Tailwind theme tokens only (`brand-red`, `brand-red-dark`, `brand-gold`, `ink`, `ink-faint`, `ink-muted`, `card-border`, `rounded-card-sm`, `rounded-btn`, `rounded-pill`) — no hardcoded hex, no arbitrary-value hex classes.
- A line with `audio_url: null` must not crash duration preloading or playback — skip it gracefully (treat its duration as 0, matching the reference project's `if (!s.audio_url) return resolve(0)` pattern).
- Do not modify `main` directly. Work happens in the `shadowing-player-upgrade` branch/worktree at `e:\HuaYu\HuaYu-user\.worktrees\shadowing-player-upgrade`.

---

## Task 1: Cumulative player bar (time, seek, prev/next, speed)

**Files:**
- Modify: `app/(protected)/books/[bookId]/lessons/[lessonId]/dialogue/[dialogueId]/ShadowingScreen.tsx`
- Modify: `tests/components/dialogue/ShadowingScreen.test.tsx`

**Interfaces:**
- Consumes: `Dialogue`/`DialogueLine` types (unchanged), `gradeSyllables`, `useSpeechRecognition` (unchanged).
- Produces: nothing consumed elsewhere — leaf UI component, no downstream interface changes.

- [ ] **Step 1: Write the failing tests**

Update the shared test fixture and mocks at the top of `tests/components/dialogue/ShadowingScreen.test.tsx`. The existing `MockAudio` class needs a `duration`/`onloadedmetadata` so duration-preloading can be exercised, and a `currentTime` setter that real code can assign to for seeking:

```tsx
// Replace the existing MockAudio class with:
class MockAudio {
  currentTime = 0
  duration = 5
  onended: (() => void) | null = null
  onloadedmetadata: (() => void) | null = null
  onerror: (() => void) | null = null
  constructor(public src: string) {
    audioInstances.push(this)
    // Simulate metadata loading synchronously so tests don't need extra
    // act() wrapping around a real async load event.
    queueMicrotask(() => this.onloadedmetadata?.())
  }
  play = playMock
  pause = pauseMock
}
```

(Keep `playMock`/`pauseMock`/`audioInstances` as they already are; only the class body changes.)

Update the `dialogue` fixture to three lines so prev/next has somewhere to go:

```tsx
const dialogue: Dialogue = {
  id: 'd1',
  order: 1,
  kind: 'dialogue',
  audio_url: null,
  lines: [
    { id: 'l1', order: 1, speaker_zh: null, text_zh: '你好嗎', pinyin: 'nǐ hǎo ma', translation_vi: 'bạn khỏe không', audio_url: 'l1.mp3' },
    { id: 'l2', order: 2, speaker_zh: null, text_zh: '我很好', pinyin: 'wǒ hěn hǎo', translation_vi: 'tôi khỏe', audio_url: 'l2.mp3' },
    { id: 'l3', order: 3, speaker_zh: null, text_zh: '謝謝', pinyin: 'xiè xiè', translation_vi: 'cảm ơn', audio_url: 'l3.mp3' },
  ],
}
```

This 3-line fixture change affects existing tests that reference `我很好` as "the other line" — check each existing test still makes sense (it should; `l2`'s role as "not currently selected" is unchanged, `l3` is simply new and unreferenced by old tests).

Add these new test cases inside the `describe('ShadowingScreen', ...)` block:

```tsx
it('shows a play/pause button, elapsed/total time, and a seek bar', async () => {
  render(<ShadowingScreen dialogue={dialogue} />)
  await act(async () => {
    await Promise.resolve()
  })
  expect(screen.getByRole('button', { name: /Phát|Nghe mẫu/i })).toBeInTheDocument()
  expect(screen.getByText(/0:00/)).toBeInTheDocument()
  expect(screen.getByRole('slider')).toBeInTheDocument()
})

it('shows prev/next line buttons, with prev disabled on the first line', async () => {
  render(<ShadowingScreen dialogue={dialogue} />)
  await act(async () => {
    await Promise.resolve()
  })
  expect(screen.getByRole('button', { name: /Câu trước/i })).toBeDisabled()
  expect(screen.getByRole('button', { name: /Câu sau/i })).toBeEnabled()
})

it('advances to the next line and plays it when "Câu sau" is clicked', async () => {
  render(<ShadowingScreen dialogue={dialogue} />)
  await act(async () => {
    await Promise.resolve()
  })
  fireEvent.click(screen.getByRole('button', { name: /Câu sau/i }))
  expect(screen.getByText('我很好')).toBeInTheDocument()
  expect(playMock).toHaveBeenCalled()
})

it('goes back to the previous line and plays it when "Câu trước" is clicked', async () => {
  render(<ShadowingScreen dialogue={dialogue} />)
  await act(async () => {
    await Promise.resolve()
  })
  fireEvent.click(screen.getByRole('button', { name: /Câu sau/i }))
  playMock.mockClear()
  fireEvent.click(screen.getByRole('button', { name: /Câu trước/i }))
  expect(screen.getByText('你好嗎')).toBeInTheDocument()
  expect(playMock).toHaveBeenCalled()
})

it('cycles playback speed through 1x -> 1.25x -> 0.75x -> 1x when the speed button is clicked', async () => {
  render(<ShadowingScreen dialogue={dialogue} />)
  await act(async () => {
    await Promise.resolve()
  })
  const speedButton = screen.getByRole('button', { name: /1x/i })
  fireEvent.click(speedButton)
  expect(screen.getByRole('button', { name: /1\.25x/i })).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: /1\.25x/i }))
  expect(screen.getByRole('button', { name: /0\.75x/i })).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: /0\.75x/i }))
  expect(screen.getByRole('button', { name: /^1x$/i })).toBeInTheDocument()
})

it('does not crash when a line has no audio_url (duration treated as 0, play disabled for it)', async () => {
  const dialogueWithGap: Dialogue = {
    ...dialogue,
    lines: [
      dialogue.lines[0],
      { ...dialogue.lines[1], audio_url: null },
      dialogue.lines[2],
    ],
  }
  render(<ShadowingScreen dialogue={dialogueWithGap} />)
  await act(async () => {
    await Promise.resolve()
  })
  fireEvent.click(screen.getByRole('button', { name: /Câu sau/i }))
  expect(screen.getByText('我很好')).toBeInTheDocument()
  // No crash, and the play/pause button should be disabled on this line.
  expect(screen.getByRole('button', { name: /Nghe mẫu/i })).toBeDisabled()
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/components/dialogue/ShadowingScreen.test.tsx`
Expected: FAIL — `role: 'slider'`, "Câu trước"/"Câu sau" buttons, speed button not found.

- [ ] **Step 3: Implement the cumulative player**

Replace `app/(protected)/books/[bookId]/lessons/[lessonId]/dialogue/[dialogueId]/ShadowingScreen.tsx` with:

```tsx
'use client'

import { useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, Mic, Pause, Play, Square } from 'lucide-react'
import type { Dialogue } from '@/lib/db/types'
import { gradeSyllables, type GradeResult } from '@/lib/shadowing/pinyinGrading'
import { useSpeechRecognition } from '@/lib/shadowing/useSpeechRecognition'

const SPEED_STEPS = [1, 1.25, 0.75] as const

function formatTime(time: number): string {
  if (!Number.isFinite(time) || Number.isNaN(time)) return '0:00'
  const m = Math.floor(time / 60)
  const s = Math.floor(time % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

export default function ShadowingScreen({ dialogue }: { dialogue: Dialogue }) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isRecording, setIsRecording] = useState(false)
  const [recordedUrl, setRecordedUrl] = useState<string | null>(null)
  const [result, setResult] = useState<GradeResult | null>(null)
  const [permissionError, setPermissionError] = useState(false)
  const [isAutoPause, setIsAutoPause] = useState(true)
  const [isPlaying, setIsPlaying] = useState(false)
  const [playbackRate, setPlaybackRate] = useState<(typeof SPEED_STEPS)[number]>(1)
  const [audioProgress, setAudioProgress] = useState(0)
  const [durations, setDurations] = useState<number[]>(() => dialogue.lines.map(() => 0))

  const currentIndexRef = useRef(currentIndex)
  currentIndexRef.current = currentIndex
  const isAutoPauseRef = useRef(isAutoPause)
  isAutoPauseRef.current = isAutoPause
  const playbackRateRef = useRef(playbackRate)
  playbackRateRef.current = playbackRate

  const currentLine = dialogue.lines[currentIndex]
  const totalDuration = durations.reduce((a, b) => a + b, 0)
  const globalCurrentTime = durations.slice(0, currentIndex).reduce((a, b) => a + b, 0) + audioProgress

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const transcriptRef = useRef<string>('')
  const recordedAudioRef = useRef<HTMLAudioElement | null>(null)
  const sampleAudioRef = useRef<HTMLAudioElement | null>(null)

  // Preload every line's duration once (mirrors easy-chinese's approach) so
  // the cumulative time display and seek bar can span the whole dialogue
  // without waiting for each line's audio to load on demand. A line with no
  // audio_url contributes 0 to the total rather than blocking the others.
  useEffect(() => {
    let cancelled = false
    Promise.all(
      dialogue.lines.map(
        (line) =>
          new Promise<number>((resolve) => {
            if (!line.audio_url) {
              resolve(0)
              return
            }
            const probe = new Audio(line.audio_url)
            probe.onloadedmetadata = () => resolve(probe.duration)
            probe.onerror = () => resolve(0)
          })
      )
    ).then((durs) => {
      if (!cancelled) setDurations(durs)
    })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- dialogue.lines identity is stable per mount
  }, [dialogue.lines])

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

  function playLineAt(index: number) {
    const line = dialogue.lines[index]
    if (!line.audio_url) {
      setIsPlaying(false)
      return
    }
    sampleAudioRef.current?.pause()
    const audio = new Audio(line.audio_url)
    audio.playbackRate = playbackRateRef.current
    sampleAudioRef.current = audio
    setAudioProgress(0)
    setIsPlaying(true)

    audio.ontimeupdate = () => setAudioProgress(audio.currentTime)

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
        playLineAt(nextIndex)
      } else {
        setIsPlaying(false)
      }
    }

    audio.play()
  }

  function playSample() {
    playLineAt(currentIndexRef.current)
  }

  function pauseSample() {
    sampleAudioRef.current?.pause()
    setIsPlaying(false)
  }

  function goToLine(index: number) {
    if (index < 0 || index >= dialogue.lines.length) return
    setCurrentIndex(index)
    setResult(null)
    setRecordedUrl(null)
    playLineAt(index)
  }

  function handleSeek(e: React.ChangeEvent<HTMLInputElement>) {
    const targetGlobalTime = Number(e.target.value)
    let accumulated = 0
    let targetIndex = dialogue.lines.length - 1
    let localTime = 0

    for (let i = 0; i < durations.length; i++) {
      if (accumulated + durations[i] >= targetGlobalTime) {
        targetIndex = i
        localTime = targetGlobalTime - accumulated
        break
      }
      accumulated += durations[i]
    }

    if (targetIndex === currentIndex) {
      if (sampleAudioRef.current) {
        sampleAudioRef.current.currentTime = localTime
        setAudioProgress(localTime)
      }
      return
    }

    sampleAudioRef.current?.pause()
    const line = dialogue.lines[targetIndex]
    setCurrentIndex(targetIndex)
    setResult(null)
    setRecordedUrl(null)
    setAudioProgress(localTime)
    if (!line.audio_url) {
      setIsPlaying(false)
      return
    }
    const audio = new Audio(line.audio_url)
    audio.playbackRate = playbackRateRef.current
    audio.currentTime = localTime
    sampleAudioRef.current = audio
    audio.ontimeupdate = () => setAudioProgress(audio.currentTime)
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
        playLineAt(nextIndex)
      } else {
        setIsPlaying(false)
      }
    }
    if (isPlaying) audio.play()
  }

  function toggleSpeed() {
    const currentPos = SPEED_STEPS.indexOf(playbackRate)
    const next = SPEED_STEPS[(currentPos + 1) % SPEED_STEPS.length]
    setPlaybackRate(next)
    if (sampleAudioRef.current) sampleAudioRef.current.playbackRate = next
  }

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      sampleAudioRef.current?.pause()
      setIsPlaying(false)
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

      <div className="flex flex-col gap-3 rounded-card-sm border border-card-border bg-white px-4 py-3 shadow-sm">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => (currentLine.audio_url ? (isPlaying ? pauseSample() : playSample()) : undefined)}
            disabled={!currentLine.audio_url}
            aria-label={isPlaying ? 'Tạm dừng' : 'Nghe mẫu'}
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-pill transition-all ${
              currentLine.audio_url
                ? 'bg-brand-red text-white hover:bg-brand-red-dark'
                : 'cursor-not-allowed bg-card-border text-ink-faint'
            }`}
          >
            {isPlaying ? <Pause className="h-4 w-4" strokeWidth={2.5} /> : <Play className="h-4 w-4" strokeWidth={2.5} />}
          </button>

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
          <span className="text-sm font-semibold text-ink-faint">Tự động dừng</span>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => goToLine(currentIndex - 1)}
              disabled={currentIndex === 0}
              aria-label="Câu trước"
              className="text-ink-faint transition-colors hover:text-brand-red disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:text-ink-faint"
            >
              <ChevronLeft className="h-5 w-5" strokeWidth={2.5} />
            </button>
            <button
              type="button"
              onClick={() => goToLine(currentIndex + 1)}
              disabled={currentIndex === dialogue.lines.length - 1}
              aria-label="Câu sau"
              className="text-ink-faint transition-colors hover:text-brand-red disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:text-ink-faint"
            >
              <ChevronRight className="h-5 w-5" strokeWidth={2.5} />
            </button>
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
- `playLineAt(index)` replaces the old `playSample`'s inline logic and is the single place that constructs and starts an `Audio` for a given line index — `playSample()`, `goToLine()`, and the auto-advance branch in `onended` all funnel through it (or a duplicated inline version for the seek case, since seeking needs to additionally set `currentTime` before playing — see `handleSeek`). This satisfies the earlier plan's suggested `playLineAt(index)` extraction that the previous task's implementer chose not to need at the time; it's needed now because prev/next/seek all need to jump to an arbitrary line, not just auto-advance to `currentIndex + 1`.
- `handleSeek` duplicates a chunk of `playLineAt`'s audio-construction logic instead of calling it, because seeking needs to set `audio.currentTime = localTime` before calling `play()`, and only continues playing if playback was already in progress (`if (isPlaying) audio.play()`) — matching `easy-chinese`'s `handleGlobalSeek` intent (seeking while paused shouldn't start playback). If this duplication feels avoidable during implementation, a small optional refactor (e.g. `playLineAt(index, { startAt, autoPlay })`) is acceptable as long as all six new tests still pass — the tests only check observable behavior.
- `formatTime` is copied from the reference project's helper, adapted with a `Number.isFinite` guard so `Infinity`/`NaN` durations (e.g. before metadata loads) render as `0:00` instead of `NaN:NaN`.
- The old standalone "Nghe mẫu" pill button is gone, replaced by a compact play/pause circle inside the player bar — accessible name switches between "Nghe mẫu" and "Tạm dừng" via `aria-label`, matching what the existing tests already query for.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/components/dialogue/ShadowingScreen.test.tsx`
Expected: PASS (all previous tests + 6 new ones)

- [ ] **Step 5: Run the full test suite and typecheck**

Run: `npm test`
Expected: PASS — no regressions elsewhere.

- [ ] **Step 6: Manual verification**

Run: `npm run dev`, open a dialogue's Shadowing tab in Chrome with a lesson that has real per-line `audio_url` values. Confirm:
- Player bar shows play/pause, "0:00 / total" time, a draggable seek bar, prev/next chevrons, and a speed button cycling 1x → 1.25x → 0.75x → 1x.
- Prev/next buttons disable at the first/last line respectively and auto-play the target line.
- Dragging the seek bar jumps across line boundaries correctly (test with a dialogue with 3+ lines).
- Recording, replay, and the "Tự động dừng" toggle's effect on grading all still behave exactly as before this change.

- [ ] **Step 7: Commit**

```bash
git add "app/(protected)/books/[bookId]/lessons/[lessonId]/dialogue/[dialogueId]/ShadowingScreen.tsx" tests/components/dialogue/ShadowingScreen.test.tsx docs/superpowers/plans/2026-08-08-shadowing-cumulative-player.md
git commit -m "feat: add cumulative audio player bar to ShadowingScreen (seek, prev/next, speed)"
```
