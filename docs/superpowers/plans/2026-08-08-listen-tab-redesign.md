# ListenTab Chat-Bubble Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign `ListenTab` (the "Nghe hội thoại" tab) into a chat-message layout — per-speaker circular avatar (full `speaker_zh` name, colors alternating by speaker order) beside a chat-bubble card (pinyin/Hanzi/translation) with a round play button showing a sound-wave animation while playing — plus one global toggle that shows/hides pinyin+translation for every line at once.

**Architecture:** All changes are contained in `ListenTab.tsx`. A `speakerColorMap` is computed once (via `useMemo`) from `dialogue.lines`, assigning each distinct `speaker_zh` an alternating brand-red/brand-gold pairing in first-appearance order. A new `showDetails` boolean state (default `true`) gates the pinyin+translation `<span>`s already in the card. The existing `playLine`/`currentLineId` playback logic is untouched — only rendering and one new state are added.

**Tech Stack:** Next.js client component (existing), TypeScript, Tailwind 4 theme tokens, Vitest + Testing Library.

## Global Constraints

- This is a redesign of `ListenTab.tsx` only. Do not touch `ShadowingScreen.tsx`, `DialogueDetailPage.tsx`, or any other file besides `ListenTab.tsx` and its test file.
- Reference mockup (`Buoc1-BaiKhoa.dc.html`, provided by the project owner) is from a DIFFERENT sibling reference project with its own routing/data shape and inline hex styling — port the VISUAL PATTERN only (chat-bubble layout, avatar-beside-bubble, sound-wave play button, colors translated to this app's theme tokens), not its literal markup, inline styles, `<x-dc>` component framework, or Web Speech `speechSynthesis` playback approach (this app already has real per-line `audio_url` files and a working `playLine` function — do not replace that with TTS).
- Avatar shows the speaker's FULL `speaker_zh` name (not an initial/single character) — confirmed explicitly by the project owner. Size the avatar box to fit reasonably (existing `w-10 h-10`-class circular avatars in Vietnamese/Chinese apps commonly show 2-4 characters at a small font size; use your judgment on font sizing so the full name fits without overflowing, following patterns from this codebase if any exist for similar chip/badge text — check `DialoguePickerList.tsx`'s icon treatment for size conventions before inventing new ones).
- Colors alternate by speaker's FIRST-APPEARANCE ORDER in `dialogue.lines`, not by fixed "A/B" positions — e.g., if `speaker_zh` values appear in order 小明, 小美, 小明, 小美, both should map consistently (小明 → color 1, 小美 → color 2) for the whole dialogue. Use `brand-red`/`brand-gold` as the two alternating colors (a third+ distinct speaker cycles back to `brand-red`, matching the two-color alternation already used elsewhere in this codebase's `speakerColors` patterns if any exist — otherwise just alternate red/gold).
- The global show/hide toggle defaults to showing pinyin+translation (matches current behavior — nothing should look different on first load with default settings).
- A line with `audio_url: null` must remain disabled (unclickable/no crash), matching the existing established pattern.
- Follow existing UI conventions: Tailwind theme tokens only (`brand-red`, `brand-gold`, `ink`, `ink-faint`, `ink-muted`, `card-border`, `rounded-card`, `rounded-pill`) — no hardcoded hex, no arbitrary-value hex classes.
- Do not modify `main` directly. Work happens in the `listen-tab-redesign` branch/worktree at `e:\HuaYu\HuaYu-user\.worktrees\listen-tab-redesign`.

---

## Task 1: Chat-bubble ListenTab with avatars and pinyin/translation toggle

**Files:**
- Modify: `app/(protected)/books/[bookId]/lessons/[lessonId]/dialogue/[dialogueId]/ListenTab.tsx`
- Modify: `tests/components/dialogue/ListenTab.test.tsx`

**Interfaces:**
- Consumes: `Dialogue`/`DialogueLine` types (unchanged) — no other file's interface changes.
- Produces: nothing consumed elsewhere — leaf UI component, `{ dialogue: Dialogue }` prop signature is unchanged (still called the same way by `DialogueDetailPage.tsx`, already merged, do not touch its call site).

- [ ] **Step 1: Write the failing tests**

Replace the contents of `tests/components/dialogue/ListenTab.test.tsx` with:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom'
import ListenTab from '@/app/(protected)/books/[bookId]/lessons/[lessonId]/dialogue/[dialogueId]/ListenTab'
import type { Dialogue } from '@/lib/db/types'

const playMock = vi.fn().mockResolvedValue(undefined)
const pauseMock = vi.fn()

class MockAudio {
  currentTime = 0
  onended: (() => void) | null = null
  constructor(public src: string) {}
  play = playMock
  pause = pauseMock
}

vi.stubGlobal('Audio', MockAudio)

const dialogue: Dialogue = {
  id: 'd1',
  order: 1,
  kind: 'dialogue',
  audio_url: null,
  lines: [
    { id: 'l1', order: 1, speaker_zh: '小明', text_zh: '你好嗎', pinyin: 'nǐ hǎo ma', translation_vi: 'bạn khỏe không', audio_url: 'l1.mp3' },
    { id: 'l2', order: 2, speaker_zh: '小美', text_zh: '我很好', pinyin: 'wǒ hěn hǎo', translation_vi: 'tôi khỏe', audio_url: 'l2.mp3' },
    { id: 'l3', order: 3, speaker_zh: '小明', text_zh: '謝謝', pinyin: 'xiè xiè', translation_vi: 'cảm ơn', audio_url: null },
  ],
}

beforeEach(() => {
  playMock.mockClear()
  pauseMock.mockClear()
})

describe('ListenTab', () => {
  it('renders every line with its Hanzi, pinyin, and translation, and shows a full-name avatar per speaker', () => {
    render(<ListenTab dialogue={dialogue} />)
    expect(screen.getByText('你好嗎')).toBeInTheDocument()
    expect(screen.getByText('nǐ hǎo ma')).toBeInTheDocument()
    expect(screen.getByText('bạn khỏe không')).toBeInTheDocument()
    expect(screen.getByText('我很好')).toBeInTheDocument()
    // Two distinct speakers, full name shown twice each as an avatar label.
    expect(screen.getAllByText('小明')).toHaveLength(2) // avatar label appears for l1 and l3
    expect(screen.getAllByText('小美')).toHaveLength(1)
  })

  it('plays a line\'s audio when its card is clicked', () => {
    render(<ListenTab dialogue={dialogue} />)
    fireEvent.click(screen.getByText('你好嗎'))
    expect(playMock).toHaveBeenCalled()
  })

  it('does not crash and disables play for a line with no audio_url', () => {
    render(<ListenTab dialogue={dialogue} />)
    const thirdLineButton = screen.getByText('謝謝').closest('button')
    expect(thirdLineButton).toBeDisabled()
    if (thirdLineButton) fireEvent.click(thirdLineButton)
    expect(playMock).not.toHaveBeenCalled()
  })

  it('shows pinyin and translation by default, and hides both when the toggle is clicked', () => {
    render(<ListenTab dialogue={dialogue} />)
    expect(screen.getByText('nǐ hǎo ma')).toBeInTheDocument()
    expect(screen.getByText('bạn khỏe không')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /Ẩn pinyin.*nghĩa|Hiện pinyin.*nghĩa/i }))

    expect(screen.queryByText('nǐ hǎo ma')).not.toBeInTheDocument()
    expect(screen.queryByText('bạn khỏe không')).not.toBeInTheDocument()
    // Hanzi always stays visible regardless of the toggle.
    expect(screen.getByText('你好嗎')).toBeInTheDocument()
  })

  it('assigns consistent alternating colors per speaker across repeated appearances', () => {
    render(<ListenTab dialogue={dialogue} />)
    const firstAvatar = screen.getAllByText('小明')[0]
    const thirdAvatar = screen.getAllByText('小明')[1]
    // Same speaker's two avatar instances must share the same background color class.
    const firstClasses = firstAvatar.className
    const thirdClasses = thirdAvatar.className
    expect(firstClasses).toBe(thirdClasses)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/components/dialogue/ListenTab.test.tsx`
Expected: FAIL — avatar labels, toggle button, and disabled-state assertions don't match the current implementation.

- [ ] **Step 3: Implement the chat-bubble redesign**

Replace `app/(protected)/books/[bookId]/lessons/[lessonId]/dialogue/[dialogueId]/ListenTab.tsx` with:

```tsx
'use client'

import { useMemo, useRef, useState } from 'react'
import { Eye, EyeOff, Play } from 'lucide-react'
import type { Dialogue } from '@/lib/db/types'

const AVATAR_COLORS = [
  { bg: 'bg-brand-red', text: 'text-brand-cream-text' },
  { bg: 'bg-brand-gold', text: 'text-ink' },
] as const

function useSpeakerColors(lines: Dialogue['lines']) {
  return useMemo(() => {
    const map = new Map<string, (typeof AVATAR_COLORS)[number]>()
    let nextColorIndex = 0
    for (const line of lines) {
      if (!line.speaker_zh) continue
      if (!map.has(line.speaker_zh)) {
        map.set(line.speaker_zh, AVATAR_COLORS[nextColorIndex % AVATAR_COLORS.length])
        nextColorIndex += 1
      }
    }
    return map
  }, [lines])
}

export default function ListenTab({ dialogue }: { dialogue: Dialogue }) {
  const [currentLineId, setCurrentLineId] = useState<string | null>(null)
  const [showDetails, setShowDetails] = useState(true)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const speakerColors = useSpeakerColors(dialogue.lines)

  function playLine(lineId: string, audioUrl: string | null) {
    if (!audioUrl) return
    audioRef.current?.pause()
    const audio = new Audio(audioUrl)
    audioRef.current = audio
    setCurrentLineId(lineId)
    audio.onended = () => setCurrentLineId((current) => (current === lineId ? null : current))
    audio.play()
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setShowDetails((prev) => !prev)}
          className="flex items-center gap-1.5 rounded-pill border border-card-border bg-white px-3 py-1.5 text-xs font-bold text-ink-faint transition-colors hover:text-brand-red"
        >
          {showDetails ? <EyeOff className="h-3.5 w-3.5" strokeWidth={2.5} /> : <Eye className="h-3.5 w-3.5" strokeWidth={2.5} />}
          {showDetails ? 'Ẩn pinyin & nghĩa' : 'Hiện pinyin & nghĩa'}
        </button>
      </div>

      {dialogue.lines.map((line) => {
        const isCurrent = line.id === currentLineId
        const color = line.speaker_zh ? speakerColors.get(line.speaker_zh) : undefined

        return (
          <div key={line.id} className="flex items-start gap-3">
            {line.speaker_zh && color && (
              <span
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[11px] font-bold leading-none ${color.bg} ${color.text}`}
                title={line.speaker_zh}
              >
                {line.speaker_zh}
              </span>
            )}

            <button
              type="button"
              onClick={() => playLine(line.id, line.audio_url)}
              disabled={!line.audio_url}
              className={`flex flex-1 items-start justify-between gap-3 rounded-card rounded-tl-md border p-4 text-left shadow-sm transition-all ${
                isCurrent ? 'border-brand-red/30 bg-white' : 'border-card-border bg-white/60'
              } ${line.audio_url ? 'cursor-pointer hover:-translate-y-0.5 hover:shadow-md' : 'cursor-default opacity-70'}`}
            >
              <span className="flex min-w-0 flex-1 flex-col gap-1">
                {showDetails && line.pinyin && (
                  <span className="text-xs font-semibold tracking-wide text-ink-pinyin">{line.pinyin}</span>
                )}
                <span className="font-han-title text-2xl font-medium leading-snug text-ink">{line.text_zh}</span>
                {showDetails && line.translation_vi && (
                  <span className="mt-1 text-sm font-semibold text-ink-muted">{line.translation_vi}</span>
                )}
              </span>

              <span
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full shadow-sm transition-colors ${
                  line.audio_url ? 'bg-brand-red text-white' : 'bg-card-border text-ink-faint'
                }`}
              >
                {isCurrent ? (
                  <span className="flex h-4 items-center gap-[3px]" aria-hidden="true">
                    <span className="h-full w-[3px] animate-pulse rounded-full bg-current" />
                    <span className="h-full w-[3px] animate-pulse rounded-full bg-current [animation-delay:150ms]" />
                    <span className="h-full w-[3px] animate-pulse rounded-full bg-current [animation-delay:300ms]" />
                  </span>
                ) : (
                  <Play className="h-4 w-4" strokeWidth={2.5} />
                )}
              </span>
            </button>
          </div>
        )
      })}
    </div>
  )
}
```

Notes on the implementation:
- `useSpeakerColors` assigns colors in first-appearance order, memoized so re-renders don't reshuffle colors — matches the "consistent alternating colors per speaker" requirement.
- The `ink-pinyin` token already exists in `app/globals.css` (`--color-ink-pinyin: #B9AD98`) — verify this before using it; if it's not there, fall back to `text-brand-gold` (used elsewhere in this codebase for pinyin) instead.
- `brand-cream-text` is used for text-on-red-avatar contrast — verify this token exists in `app/globals.css`'s `@theme` block (it should, per the app's existing color palette) before using it; if missing, use `text-white` instead.
- The sound-wave "playing" indicator is a simplified 3-bar `animate-pulse` (Tailwind's built-in utility) rather than the mockup's custom `@keyframes soundPulse` — this avoids adding new CSS keyframes to `globals.css` for a cosmetic detail; if `animate-pulse`'s simultaneous fade doesn't read as a lively enough "sound wave," the `[animation-delay:Xms]` arbitrary values on siblings already stagger them, which is the visual point of the mockup's per-bar delay.
- The avatar's Hanzi name at 10px/11px font in a 40px circle may still overflow for names longer than ~3 characters at default line-height — `leading-none` and small font-size are the primary levers; if a name still overflows during manual testing, reducing to `text-[10px]` or slightly enlarging the circle (e.g. `h-11 w-11`) are acceptable adjustments within this task's scope.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/components/dialogue/ListenTab.test.tsx`
Expected: PASS (5 tests: 2 pre-existing behaviors re-verified + 3 new)

- [ ] **Step 5: Run the full test suite and typecheck**

Run: `npm test`
Expected: PASS — no regressions elsewhere (in particular, `DialogueDetailPage.test.tsx`'s mock of `ListenTab` is unaffected since the prop signature didn't change).

- [ ] **Step 6: Manual verification**

Run: `npm run dev`, open a dialogue's "Nghe hội thoại" tab in Chrome with a lesson that has multiple speakers and real per-line `audio_url` values. Confirm:
- Each line shows a circular avatar with the speaker's full Chinese name, colors alternating consistently per speaker across the whole dialogue.
- Clicking the global toggle hides/shows pinyin+translation for every line at once; Hanzi always stays visible.
- Playing a line shows a sound-wave animation in its play button; a line with no `audio_url` stays visually disabled and unclickable.

- [ ] **Step 7: Commit**

```bash
git add "app/(protected)/books/[bookId]/lessons/[lessonId]/dialogue/[dialogueId]/ListenTab.tsx" tests/components/dialogue/ListenTab.test.tsx docs/superpowers/plans/2026-08-08-listen-tab-redesign.md
git commit -m "feat: redesign ListenTab as chat bubbles with speaker avatars and pinyin/translation toggle"
```
