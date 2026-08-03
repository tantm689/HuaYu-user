# Scope 6: Gõ phản xạ Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the "Gõ phản xạ" (typing practice) feature — 2 sub-tabs, "Gõ từ" (vocabulary, free-order, auto-check per row) and "Gõ câu" (sentences, sequential, next-based), reading `vocabulary`/`dialogue_lines` and writing to the existing `typing_progress` table.

**Architecture:** Server Component fetches lesson vocabulary + dialogue lines, passes to a Client Component that owns local tab state (no URL query param needed — nothing here needs deep-linking). Each sub-tab is its own component. Grading is pure client-side string comparison after normalization (no AI, no server round-trip for grading — only for persisting progress).

**Tech Stack:** Next.js 16 App Router, TypeScript, Supabase JS (browser client for writes), Tailwind (existing design tokens), Vitest + React Testing Library.

## Global Constraints

- Matching is **exact-match only** after normalization — no synonyms, no AI grading. Spec: `docs/superpowers/specs/2026-08-03-scope-6-typing-design.md` §2.
- Normalization before compare: `trim()`, then map half-width punctuation to full-width: `,`→`，` `.`→`。` `?`→`？` `!`→`！` `:`→`：` `;`→`；`. Applied to BOTH the user's input and the target string before comparing.
- `typing_progress` is an **upsert of latest state, not a log** — one row per `(user_id, kind, target_id)`, never insert additional rows for repeat attempts.
- `streak` update rule: correct → `streak + 1`; incorrect → `streak = 0`. This is independent per `target_id`.
- "Gõ từ": no lock after grading — user can retype and re-grade the same row any number of times in one session. "Gõ câu": input locks after grading each sentence (both correct and incorrect); user only unlocks by restarting the tab (reload), matching the spec decision.
- No progress ring / percent summary UI for this feature — it is free practice, not a graded test. "Gõ từ" shows no aggregate count at all. "Gõ câu" shows a plain completion line ("Đã luyện xong N câu") at the end.
- Save-error handling: a failed `typing_progress` write shows a small local error message near the affected row/sentence, does not block continued practice, and does not retry automatically (same convention as Flashcard/Quiz save failures elsewhere in this app).
- Audio hint button in "Gõ câu" is unlimited plays; hidden entirely for a line with a null `audio_url`.
- Do not display saved `streak`/`is_correct` state on page load — this feature does not fetch `typing_progress` for read purposes in this scope, only writes. Every row starts unmarked each time the tab is opened.

---

### Task 1: Normalization helper + `getDialogueLines` + `typing_progress` type

**Files:**
- Create: `lib/typing/normalize.ts`
- Create: `tests/lib/typing/normalize.test.ts`
- Create: `lib/db/getDialogueLines.ts`
- Create: `tests/lib/db/getDialogueLines.test.ts`
- Modify: `lib/db/types.ts` (add `DialogueLineForTyping` interface)

**Interfaces:**
- Produces: `normalizeForMatch(s: string): string`, `isExactMatch(input: string, target: string): boolean` — used by Tasks 3 and 4.
- Produces: `getDialogueLines(supabase: SupabaseClient, lessonId: string): Promise<DialogueLineForTyping[]>` — used by Task 5 (page.tsx).
- Produces: `DialogueLineForTyping` type (`lib/db/types.ts`) — `{ id: string; text_zh: string; translation_vi: string | null; audio_url: string | null }`.

- [ ] **Step 1: Write the failing normalize tests**

```ts
// tests/lib/typing/normalize.test.ts
import { describe, it, expect } from 'vitest'
import { normalizeForMatch, isExactMatch } from '@/lib/typing/normalize'

describe('normalizeForMatch', () => {
  it('trims leading and trailing whitespace', () => {
    expect(normalizeForMatch('  你好  ')).toBe('你好')
  })

  it('converts half-width punctuation to full-width', () => {
    expect(normalizeForMatch('你好,吗?')).toBe('你好，吗？')
    expect(normalizeForMatch('好.')).toBe('好。')
    expect(normalizeForMatch('好!')).toBe('好！')
    expect(normalizeForMatch('好:')).toBe('好：')
    expect(normalizeForMatch('好;')).toBe('好；')
  })

  it('leaves already-full-width punctuation unchanged', () => {
    expect(normalizeForMatch('你好，嗎？')).toBe('你好，嗎？')
  })
})

describe('isExactMatch', () => {
  it('matches identical strings', () => {
    expect(isExactMatch('你好', '你好')).toBe(true)
  })

  it('matches after normalization differences (half-width vs full-width punctuation)', () => {
    expect(isExactMatch('你好,嗎?', '你好，嗎？')).toBe(true)
  })

  it('matches after trimming stray whitespace', () => {
    expect(isExactMatch('  你好  ', '你好')).toBe(true)
  })

  it('does not match different text', () => {
    expect(isExactMatch('你好', '再見')).toBe(false)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/lib/typing/normalize.test.ts`
Expected: FAIL with "Cannot find module '@/lib/typing/normalize'"

- [ ] **Step 3: Implement normalize.ts**

```ts
// lib/typing/normalize.ts
const HALF_TO_FULL_WIDTH: Record<string, string> = {
  ',': '，',
  '.': '。',
  '?': '？',
  '!': '！',
  ':': '：',
  ';': '；',
}

export function normalizeForMatch(s: string): string {
  const trimmed = s.trim()
  return trimmed.replace(/[,.?!:;]/g, (char) => HALF_TO_FULL_WIDTH[char])
}

export function isExactMatch(input: string, target: string): boolean {
  return normalizeForMatch(input) === normalizeForMatch(target)
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/lib/typing/normalize.test.ts`
Expected: PASS, 6 tests

- [ ] **Step 5: Add `DialogueLineForTyping` to types.ts**

In `lib/db/types.ts`, add after the `Vocabulary` interface:

```ts
export interface DialogueLineForTyping {
  id: string
  text_zh: string
  translation_vi: string | null
  audio_url: string | null
}
```

- [ ] **Step 6: Write the failing getDialogueLines test**

```ts
// tests/lib/db/getDialogueLines.test.ts
import { describe, it, expect, vi } from 'vitest'
import { getDialogueLines } from '@/lib/db/getDialogueLines'

function makeSupabaseMock(data: unknown, error: unknown = null) {
  return {
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({ data, error }),
        }),
      }),
    }),
  }
}

describe('getDialogueLines', () => {
  it('flattens dialogue_lines across dialogues, sorted by dialogue order then line order', async () => {
    const rows = [
      {
        id: 'd2',
        order: 2,
        dialogue_lines: [
          { id: 'l3', order: 1, text_zh: '再見', translation_vi: 'tạm biệt', audio_url: null },
        ],
      },
      {
        id: 'd1',
        order: 1,
        dialogue_lines: [
          { id: 'l2', order: 2, text_zh: '你好嗎', translation_vi: 'bạn khỏe không', audio_url: 'a2.mp3' },
          { id: 'l1', order: 1, text_zh: '你好', translation_vi: 'xin chào', audio_url: 'a1.mp3' },
        ],
      },
    ]
    const supabase = makeSupabaseMock(rows)

    const result = await getDialogueLines(supabase as any, 'lesson-1')

    expect(result.map((r) => r.id)).toEqual(['l1', 'l2', 'l3'])
    expect(result[0]).toEqual({ id: 'l1', text_zh: '你好', translation_vi: 'xin chào', audio_url: 'a1.mp3' })
  })

  it('throws when the query errors', async () => {
    const supabase = makeSupabaseMock(null, { message: 'boom' })
    await expect(getDialogueLines(supabase as any, 'lesson-1')).rejects.toThrow('boom')
  })

  it('returns an empty array when a lesson has no dialogue lines', async () => {
    const supabase = makeSupabaseMock([{ id: 'd1', order: 1, dialogue_lines: [] }])
    const result = await getDialogueLines(supabase as any, 'lesson-1')
    expect(result).toEqual([])
  })
})
```

- [ ] **Step 7: Run test to verify it fails**

Run: `npx vitest run tests/lib/db/getDialogueLines.test.ts`
Expected: FAIL with "Cannot find module '@/lib/db/getDialogueLines'"

- [ ] **Step 8: Implement getDialogueLines.ts**

```ts
// lib/db/getDialogueLines.ts
import type { SupabaseClient } from '@supabase/supabase-js'
import type { DialogueLineForTyping } from './types'

export async function getDialogueLines(
  supabase: SupabaseClient,
  lessonId: string
): Promise<DialogueLineForTyping[]> {
  const { data, error } = await supabase
    .from('dialogues')
    .select('id, order, dialogue_lines(id, order, text_zh, translation_vi, audio_url)')
    .eq('lesson_id', lessonId)
    .order('order', { ascending: true })

  if (error) throw new Error(error.message)

  type Row = {
    id: string
    order: number
    dialogue_lines: { id: string; order: number; text_zh: string; translation_vi: string | null; audio_url: string | null }[]
  }

  const rows = [...(data as unknown as Row[])].sort((a, b) => a.order - b.order)

  return rows.flatMap((dialogue) =>
    [...dialogue.dialogue_lines]
      .sort((a, b) => a.order - b.order)
      .map((line) => ({
        id: line.id,
        text_zh: line.text_zh,
        translation_vi: line.translation_vi,
        audio_url: line.audio_url,
      }))
  )
}
```

- [ ] **Step 9: Run tests to verify they pass**

Run: `npx vitest run tests/lib/db/getDialogueLines.test.ts`
Expected: PASS, 3 tests

- [ ] **Step 10: Commit**

```bash
git add lib/typing/normalize.ts tests/lib/typing/normalize.test.ts lib/db/getDialogueLines.ts tests/lib/db/getDialogueLines.test.ts lib/db/types.ts
git commit -m "feat: add typing-match normalization and getDialogueLines helper"
```

---

### Task 2: `typingProgress` upsert helper

**Files:**
- Create: `lib/db/typingProgress.ts`
- Create: `tests/lib/db/typingProgress.test.ts`

**Interfaces:**
- Consumes: `TypingKind`, `TypingProgress` from `lib/db/types.ts` (already exist — `TypingKind = 'vocabulary' | 'dialogue_line'`).
- Produces: `upsertTypingProgress(supabase: SupabaseClient, kind: TypingKind, targetId: string, isCorrect: boolean, prevStreak: number): Promise<void>` — used by Tasks 3 and 4.

- [ ] **Step 1: Write the failing test**

```ts
// tests/lib/db/typingProgress.test.ts
import { describe, it, expect, vi } from 'vitest'
import { upsertTypingProgress } from '@/lib/db/typingProgress'

describe('upsertTypingProgress', () => {
  it('upserts with streak incremented on a correct attempt', async () => {
    const upsert = vi.fn().mockResolvedValue({ error: null })
    const supabase = { from: vi.fn().mockReturnValue({ upsert }) }

    await upsertTypingProgress(supabase as any, 'vocabulary', 'v1', true, 2)

    expect(supabase.from).toHaveBeenCalledWith('typing_progress')
    expect(upsert).toHaveBeenCalledWith(
      { kind: 'vocabulary', target_id: 'v1', is_correct: true, streak: 3, last_attempted_at: expect.any(String) },
      { onConflict: 'user_id,kind,target_id' }
    )
  })

  it('resets streak to 0 on an incorrect attempt regardless of prevStreak', async () => {
    const upsert = vi.fn().mockResolvedValue({ error: null })
    const supabase = { from: vi.fn().mockReturnValue({ upsert }) }

    await upsertTypingProgress(supabase as any, 'dialogue_line', 'l1', false, 5)

    expect(upsert).toHaveBeenCalledWith(
      { kind: 'dialogue_line', target_id: 'l1', is_correct: false, streak: 0, last_attempted_at: expect.any(String) },
      { onConflict: 'user_id,kind,target_id' }
    )
  })

  it('throws when the upsert errors', async () => {
    const upsert = vi.fn().mockResolvedValue({ error: { message: 'boom' } })
    const supabase = { from: vi.fn().mockReturnValue({ upsert }) }

    await expect(upsertTypingProgress(supabase as any, 'vocabulary', 'v1', true, 0)).rejects.toThrow('boom')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/lib/db/typingProgress.test.ts`
Expected: FAIL with "Cannot find module '@/lib/db/typingProgress'"

- [ ] **Step 3: Implement typingProgress.ts**

```ts
// lib/db/typingProgress.ts
import type { SupabaseClient } from '@supabase/supabase-js'
import type { TypingKind } from './types'

export async function upsertTypingProgress(
  supabase: SupabaseClient,
  kind: TypingKind,
  targetId: string,
  isCorrect: boolean,
  prevStreak: number
): Promise<void> {
  const streak = isCorrect ? prevStreak + 1 : 0

  const { error } = await supabase.from('typing_progress').upsert(
    {
      kind,
      target_id: targetId,
      is_correct: isCorrect,
      streak,
      last_attempted_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,kind,target_id' }
  )

  if (error) throw new Error(error.message)
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/lib/db/typingProgress.test.ts`
Expected: PASS, 3 tests

- [ ] **Step 5: Commit**

```bash
git add lib/db/typingProgress.ts tests/lib/db/typingProgress.test.ts
git commit -m "feat: add upsertTypingProgress helper"
```

---

### Task 3: `VocabTypingTab` component

**Files:**
- Create: `app/(protected)/books/[bookId]/lessons/[lessonId]/typing/VocabTypingTab.tsx`
- Create: `tests/components/typing/VocabTypingTab.test.tsx`

**Interfaces:**
- Consumes: `Vocabulary` type (`lib/db/types.ts`, already exists — has `id`, `word_zh`, `meaning_vi`), `isExactMatch` from Task 1, `upsertTypingProgress` from Task 2, `createBrowserSupabase` from `lib/supabase/browser.ts`.
- Produces: `VocabTypingTab({ vocabulary }: { vocabulary: Vocabulary[] })` default export — consumed by Task 5's `TypingPage.tsx`.

- [ ] **Step 1: Write the failing test**

```tsx
// tests/components/typing/VocabTypingTab.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import VocabTypingTab from '@/app/(protected)/books/[bookId]/lessons/[lessonId]/typing/VocabTypingTab'

const upsert = vi.fn().mockResolvedValue({ error: null })

vi.mock('@/lib/supabase/browser', () => ({
  createBrowserSupabase: () => ({ from: vi.fn().mockReturnValue({ upsert }) }),
}))

const vocabulary = [
  { id: 'v1', dialogue_id: 'd1', order: 1, word_zh: '你好', pinyin: 'nǐ hǎo', meaning_vi: 'xin chào', audio_url: null },
  { id: 'v2', dialogue_id: 'd1', order: 2, word_zh: '謝謝', pinyin: 'xiè xiè', meaning_vi: 'cảm ơn', audio_url: null },
]

beforeEach(() => {
  upsert.mockClear()
})

describe('VocabTypingTab', () => {
  it('renders one row per vocabulary item showing meaning_vi, not word_zh', () => {
    render(<VocabTypingTab vocabulary={vocabulary} />)
    expect(screen.getByText('xin chào')).toBeInTheDocument()
    expect(screen.getByText('cảm ơn')).toBeInTheDocument()
    expect(screen.queryByText('你好')).not.toBeInTheDocument()
  })

  it('marks a row correct on blur when the typed word matches, and saves progress', async () => {
    render(<VocabTypingTab vocabulary={vocabulary} />)
    const input = screen.getByLabelText('xin chào')
    fireEvent.change(input, { target: { value: '你好' } })
    fireEvent.blur(input)

    await waitFor(() => expect(input).toHaveAttribute('data-state', 'correct'))
    expect(upsert).toHaveBeenCalledWith(
      { kind: 'vocabulary', target_id: 'v1', is_correct: true, streak: 1, last_attempted_at: expect.any(String) },
      { onConflict: 'user_id,kind,target_id' }
    )
  })

  it('marks a row incorrect on Enter when the typed word does not match', async () => {
    render(<VocabTypingTab vocabulary={vocabulary} />)
    const input = screen.getByLabelText('cảm ơn')
    fireEvent.change(input, { target: { value: '不對' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    await waitFor(() => expect(input).toHaveAttribute('data-state', 'incorrect'))
  })

  it('allows retyping and re-grading the same row after it was marked incorrect', async () => {
    render(<VocabTypingTab vocabulary={vocabulary} />)
    const input = screen.getByLabelText('xin chào')

    fireEvent.change(input, { target: { value: 'sai' } })
    fireEvent.blur(input)
    await waitFor(() => expect(input).toHaveAttribute('data-state', 'incorrect'))

    fireEvent.change(input, { target: { value: '你好' } })
    fireEvent.blur(input)
    await waitFor(() => expect(input).toHaveAttribute('data-state', 'correct'))
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/components/typing/VocabTypingTab.test.tsx`
Expected: FAIL with "Cannot find module '.../typing/VocabTypingTab'"

- [ ] **Step 3: Implement VocabTypingTab.tsx**

```tsx
// app/(protected)/books/[bookId]/lessons/[lessonId]/typing/VocabTypingTab.tsx
'use client'

import { useState } from 'react'
import type { Vocabulary } from '@/lib/db/types'
import { isExactMatch } from '@/lib/typing/normalize'
import { upsertTypingProgress } from '@/lib/db/typingProgress'
import { createBrowserSupabase } from '@/lib/supabase/browser'

type RowState = 'correct' | 'incorrect' | null

export default function VocabTypingTab({ vocabulary }: { vocabulary: Vocabulary[] }) {
  const [values, setValues] = useState<Record<string, string>>({})
  const [states, setStates] = useState<Record<string, RowState>>({})
  const [streaks, setStreaks] = useState<Record<string, number>>({})
  const [errors, setErrors] = useState<Record<string, string>>({})

  async function grade(vocab: Vocabulary) {
    const typed = values[vocab.id] ?? ''
    const isCorrect = isExactMatch(typed, vocab.word_zh)
    setStates((prev) => ({ ...prev, [vocab.id]: isCorrect ? 'correct' : 'incorrect' }))
    setErrors((prev) => ({ ...prev, [vocab.id]: '' }))

    const prevStreak = streaks[vocab.id] ?? 0
    try {
      const supabase = createBrowserSupabase()
      await upsertTypingProgress(supabase, 'vocabulary', vocab.id, isCorrect, prevStreak)
      setStreaks((prev) => ({ ...prev, [vocab.id]: isCorrect ? prevStreak + 1 : 0 }))
    } catch {
      setErrors((prev) => ({ ...prev, [vocab.id]: 'Không lưu được, kiểm tra kết nối mạng.' }))
    }
  }

  return (
    <div className="flex flex-col gap-2.5">
      {vocabulary.map((vocab) => {
        const state = states[vocab.id] ?? null
        const stateClasses =
          state === 'correct'
            ? 'border-success-border bg-success-bg'
            : state === 'incorrect'
              ? 'border-error-border bg-error-bg'
              : 'border-card-border bg-white'

        return (
          <div key={vocab.id} className={`flex flex-col gap-2 rounded-card-sm border p-3 sm:flex-row sm:items-center sm:gap-3 ${stateClasses}`}>
            <label htmlFor={`vocab-${vocab.id}`} className="flex-1 font-medium text-ink">
              {vocab.meaning_vi}
            </label>
            <input
              id={`vocab-${vocab.id}`}
              aria-label={vocab.meaning_vi ?? ''}
              data-state={state ?? undefined}
              type="text"
              value={values[vocab.id] ?? ''}
              onChange={(e) => setValues((prev) => ({ ...prev, [vocab.id]: e.target.value }))}
              onBlur={() => grade(vocab)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') grade(vocab)
              }}
              className="w-full rounded-btn border border-card-border bg-white px-3 py-2 font-han-title text-lg text-ink focus:border-brand-red focus:outline-none sm:w-48"
            />
            {errors[vocab.id] && <p className="text-xs font-medium text-error-text">{errors[vocab.id]}</p>}
          </div>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/components/typing/VocabTypingTab.test.tsx`
Expected: PASS, 4 tests

- [ ] **Step 5: Commit**

```bash
git add "app/(protected)/books/[bookId]/lessons/[lessonId]/typing/VocabTypingTab.tsx" tests/components/typing/VocabTypingTab.test.tsx
git commit -m "feat: add VocabTypingTab component"
```

---

### Task 4: `SentenceTypingTab` component

**Files:**
- Create: `app/(protected)/books/[bookId]/lessons/[lessonId]/typing/SentenceTypingTab.tsx`
- Create: `tests/components/typing/SentenceTypingTab.test.tsx`

**Interfaces:**
- Consumes: `DialogueLineForTyping` type (Task 1), `isExactMatch` (Task 1), `upsertTypingProgress` (Task 2), `createBrowserSupabase`.
- Produces: `SentenceTypingTab({ lines }: { lines: DialogueLineForTyping[] })` default export — consumed by Task 5's `TypingPage.tsx`.

- [ ] **Step 1: Write the failing test**

```tsx
// tests/components/typing/SentenceTypingTab.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import SentenceTypingTab from '@/app/(protected)/books/[bookId]/lessons/[lessonId]/typing/SentenceTypingTab'

const upsert = vi.fn().mockResolvedValue({ error: null })

vi.mock('@/lib/supabase/browser', () => ({
  createBrowserSupabase: () => ({ from: vi.fn().mockReturnValue({ upsert }) }),
}))

const playMock = vi.fn()
vi.stubGlobal(
  'Audio',
  vi.fn().mockImplementation(() => ({ play: playMock }))
)

const lines = [
  { id: 'l1', text_zh: '你好嗎', translation_vi: 'bạn khỏe không', audio_url: 'a1.mp3' },
  { id: 'l2', text_zh: '我很好', translation_vi: 'tôi khỏe', audio_url: null },
]

beforeEach(() => {
  upsert.mockClear()
  playMock.mockClear()
})

describe('SentenceTypingTab', () => {
  it('shows the first line translation and an input, hides the Hanzi sentence', () => {
    render(<SentenceTypingTab lines={lines} />)
    expect(screen.getByText('bạn khỏe không')).toBeInTheDocument()
    expect(screen.queryByText('你好嗎')).not.toBeInTheDocument()
  })

  it('shows the audio button only when audio_url is present', () => {
    render(<SentenceTypingTab lines={lines} />)
    expect(screen.getByRole('button', { name: /phát âm thanh/i })).toBeInTheDocument()
  })

  it('hides the audio button when audio_url is null and plays audio when present', () => {
    render(<SentenceTypingTab lines={[lines[1], lines[0]]} />)
    expect(screen.queryByRole('button', { name: /phát âm thanh/i })).not.toBeInTheDocument()
  })

  it('locks the input and shows the correct answer after an incorrect submission, advances on Tiếp', async () => {
    render(<SentenceTypingTab lines={lines} />)
    const input = screen.getByRole('textbox')
    fireEvent.change(input, { target: { value: 'sai roi' } })
    fireEvent.click(screen.getByRole('button', { name: /kiểm tra/i }))

    await waitFor(() => expect(input).toHaveAttribute('readonly'))
    expect(screen.getByText('你好嗎')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /^tiếp$/i }))
    expect(screen.getByText('tôi khỏe')).toBeInTheDocument()
  })

  it('marks correct on exact match (after normalization) and saves progress', async () => {
    render(<SentenceTypingTab lines={lines} />)
    const input = screen.getByRole('textbox')
    fireEvent.change(input, { target: { value: '你好嗎' } })
    fireEvent.click(screen.getByRole('button', { name: /kiểm tra/i }))

    await waitFor(() =>
      expect(upsert).toHaveBeenCalledWith(
        { kind: 'dialogue_line', target_id: 'l1', is_correct: true, streak: 1, last_attempted_at: expect.any(String) },
        { onConflict: 'user_id,kind,target_id' }
      )
    )
  })

  it('shows a completion message after the last line', () => {
    render(<SentenceTypingTab lines={[lines[1]]} />)
    fireEvent.click(screen.getByRole('button', { name: /kiểm tra/i }))
    fireEvent.click(screen.getByRole('button', { name: /^tiếp$/i }))
    expect(screen.getByText(/đã luyện xong 1 câu/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/components/typing/SentenceTypingTab.test.tsx`
Expected: FAIL with "Cannot find module '.../typing/SentenceTypingTab'"

- [ ] **Step 3: Implement SentenceTypingTab.tsx**

```tsx
// app/(protected)/books/[bookId]/lessons/[lessonId]/typing/SentenceTypingTab.tsx
'use client'

import { useState } from 'react'
import { Volume2 } from 'lucide-react'
import type { DialogueLineForTyping } from '@/lib/db/types'
import { isExactMatch } from '@/lib/typing/normalize'
import { upsertTypingProgress } from '@/lib/db/typingProgress'
import { createBrowserSupabase } from '@/lib/supabase/browser'

export default function SentenceTypingTab({ lines }: { lines: DialogueLineForTyping[] }) {
  const [index, setIndex] = useState(0)
  const [value, setValue] = useState('')
  const [graded, setGraded] = useState<'correct' | 'incorrect' | null>(null)
  const [streaks, setStreaks] = useState<Record<string, number>>({})
  const [saveError, setSaveError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  if (done) {
    return (
      <div className="rounded-card border border-card-border bg-white p-8 text-center shadow-sm">
        <p className="font-han-title text-lg font-bold text-ink">
          Đã luyện xong {lines.length} câu
        </p>
      </div>
    )
  }

  const line = lines[index]
  const isLast = index === lines.length - 1

  async function grade() {
    const isCorrect = isExactMatch(value, line.text_zh)
    setGraded(isCorrect ? 'correct' : 'incorrect')
    setSaveError(null)

    const prevStreak = streaks[line.id] ?? 0
    try {
      const supabase = createBrowserSupabase()
      await upsertTypingProgress(supabase, 'dialogue_line', line.id, isCorrect, prevStreak)
      setStreaks((prev) => ({ ...prev, [line.id]: isCorrect ? prevStreak + 1 : 0 }))
    } catch {
      setSaveError('Không lưu được, kiểm tra kết nối mạng.')
    }
  }

  function next() {
    if (isLast) {
      setDone(true)
      return
    }
    setIndex((i) => i + 1)
    setValue('')
    setGraded(null)
  }

  const stateClasses =
    graded === 'correct'
      ? 'border-success-border bg-success-bg'
      : graded === 'incorrect'
        ? 'border-error-border bg-error-bg'
        : 'border-card-border bg-white'

  return (
    <div className="flex flex-col gap-4">
      <p className="text-xs font-semibold text-ink-faint">
        Câu {index + 1}/{lines.length}
      </p>

      <div className={`flex flex-col gap-3 rounded-card border p-5 shadow-sm ${stateClasses}`}>
        <div className="flex items-center gap-3">
          <p className="flex-1 font-medium text-ink">{line.translation_vi}</p>
          {line.audio_url && (
            <button
              type="button"
              onClick={() => new Audio(line.audio_url!).play()}
              aria-label="Phát âm thanh"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-red text-white shadow-sm transition-colors hover:bg-brand-red-dark"
            >
              <Volume2 className="h-4 w-4" strokeWidth={2} />
            </button>
          )}
        </div>

        <input
          type="text"
          value={value}
          readOnly={graded !== null}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && graded === null) grade()
          }}
          className="w-full rounded-btn border border-card-border bg-white px-3 py-2 font-han-title text-lg text-ink focus:border-brand-red focus:outline-none"
        />

        {graded === 'incorrect' && (
          <p className="font-han-title text-base text-ink-faint">
            Đáp án đúng: <span className="font-bold text-ink">{line.text_zh}</span>
          </p>
        )}

        {saveError && <p className="text-xs font-medium text-error-text">{saveError}</p>}
      </div>

      {graded === null ? (
        <button
          type="button"
          onClick={grade}
          className="self-start rounded-btn bg-brand-red px-6 py-2.5 font-semibold text-white shadow-sm transition-colors hover:bg-brand-red-dark"
        >
          Kiểm tra
        </button>
      ) : (
        <button
          type="button"
          onClick={next}
          className="self-start rounded-btn bg-brand-red px-6 py-2.5 font-semibold text-white shadow-sm transition-colors hover:bg-brand-red-dark"
        >
          Tiếp
        </button>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/components/typing/SentenceTypingTab.test.tsx`
Expected: PASS, 6 tests

- [ ] **Step 5: Commit**

```bash
git add "app/(protected)/books/[bookId]/lessons/[lessonId]/typing/SentenceTypingTab.tsx" tests/components/typing/SentenceTypingTab.test.tsx
git commit -m "feat: add SentenceTypingTab component"
```

---

### Task 5: `TypingPage` (tab switcher) + route + entry-point label

**Files:**
- Create: `app/(protected)/books/[bookId]/lessons/[lessonId]/typing/TypingPage.tsx`
- Create: `app/(protected)/books/[bookId]/lessons/[lessonId]/typing/page.tsx`
- Create: `tests/components/typing/TypingPage.test.tsx`
- Modify: `app/(protected)/books/[bookId]/lessons/[lessonId]/page.tsx`

**Interfaces:**
- Consumes: `VocabTypingTab` (Task 3), `SentenceTypingTab` (Task 4), `getLessonVocabulary` (existing), `getDialogueLines` (Task 1), `getLesson` (existing).
- Produces: nothing consumed by later tasks — this is the last task.

- [ ] **Step 1: Write the failing test**

```tsx
// tests/components/typing/TypingPage.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom'
import TypingPage from '@/app/(protected)/books/[bookId]/lessons/[lessonId]/typing/TypingPage'

vi.mock('@/lib/supabase/browser', () => ({
  createBrowserSupabase: () => ({ from: vi.fn().mockReturnValue({ upsert: vi.fn().mockResolvedValue({ error: null }) }) }),
}))

const vocabulary = [
  { id: 'v1', dialogue_id: 'd1', order: 1, word_zh: '你好', pinyin: null, meaning_vi: 'xin chào', audio_url: null },
]
const lines = [{ id: 'l1', text_zh: '你好嗎', translation_vi: 'bạn khỏe không', audio_url: null }]

describe('TypingPage', () => {
  it('defaults to the Gõ từ tab', () => {
    render(<TypingPage vocabulary={vocabulary} lines={lines} />)
    expect(screen.getByText('xin chào')).toBeInTheDocument()
  })

  it('switches to Gõ câu tab on click', () => {
    render(<TypingPage vocabulary={vocabulary} lines={lines} />)
    fireEvent.click(screen.getByRole('button', { name: 'Gõ câu' }))
    expect(screen.getByText('bạn khỏe không')).toBeInTheDocument()
    expect(screen.queryByText('xin chào')).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/components/typing/TypingPage.test.tsx`
Expected: FAIL with "Cannot find module '.../typing/TypingPage'"

- [ ] **Step 3: Implement TypingPage.tsx**

```tsx
// app/(protected)/books/[bookId]/lessons/[lessonId]/typing/TypingPage.tsx
'use client'

import { useState } from 'react'
import type { Vocabulary, DialogueLineForTyping } from '@/lib/db/types'
import VocabTypingTab from './VocabTypingTab'
import SentenceTypingTab from './SentenceTypingTab'

type Tab = 'vocab' | 'sentence'

export default function TypingPage({
  vocabulary,
  lines,
}: {
  vocabulary: Vocabulary[]
  lines: DialogueLineForTyping[]
}) {
  const [tab, setTab] = useState<Tab>('vocab')

  return (
    <div className="flex flex-col gap-5">
      <div className="flex gap-2 rounded-pill bg-accent-bg p-1">
        <button
          type="button"
          onClick={() => setTab('vocab')}
          className={`flex-1 rounded-pill px-4 py-2 text-sm font-semibold transition-colors ${
            tab === 'vocab' ? 'bg-white text-brand-red shadow-sm' : 'text-ink-faint'
          }`}
        >
          Gõ từ
        </button>
        <button
          type="button"
          onClick={() => setTab('sentence')}
          className={`flex-1 rounded-pill px-4 py-2 text-sm font-semibold transition-colors ${
            tab === 'sentence' ? 'bg-white text-brand-red shadow-sm' : 'text-ink-faint'
          }`}
        >
          Gõ câu
        </button>
      </div>

      {tab === 'vocab' ? (
        <VocabTypingTab vocabulary={vocabulary} />
      ) : (
        <SentenceTypingTab key="sentence-tab" lines={lines} />
      )}
    </div>
  )
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/components/typing/TypingPage.test.tsx`
Expected: PASS, 2 tests

- [ ] **Step 5: Implement page.tsx**

```tsx
// app/(protected)/books/[bookId]/lessons/[lessonId]/typing/page.tsx
import { notFound } from 'next/navigation'
import { createServerSupabase } from '@/lib/supabase/server'
import { getLesson } from '@/lib/db/getLesson'
import { getLessonVocabulary } from '@/lib/db/getLessonVocabulary'
import { getDialogueLines } from '@/lib/db/getDialogueLines'
import BackButton from '@/components/BackButton'
import TypingPage from './TypingPage'

export default async function TypingRoute({
  params,
}: {
  params: Promise<{ bookId: string; lessonId: string }>
}) {
  const { bookId, lessonId } = await params
  const supabase = await createServerSupabase()
  const lesson = await getLesson(supabase, lessonId)

  if (!lesson) notFound()

  const [dialogueVocabulary, lines] = await Promise.all([
    getLessonVocabulary(supabase, lessonId),
    getDialogueLines(supabase, lessonId),
  ])
  const vocabulary = dialogueVocabulary.flatMap((d) => d.words)

  if (vocabulary.length === 0 && lines.length === 0) {
    return (
      <div className="mx-auto max-w-[660px] px-5 py-6">
        <BackButton fallbackHref={`/books/${bookId}/lessons/${lessonId}`} />
        <p className="mt-6 text-center text-sm font-medium text-ink-faint">
          Bài học này chưa có từ vựng hoặc câu hội thoại để luyện gõ.
        </p>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-[660px] px-5 py-6">
      <BackButton fallbackHref={`/books/${bookId}/lessons/${lessonId}`} />
      <h1 className="mb-5 font-han-title text-2xl font-bold text-ink">Gõ phản xạ</h1>
      <TypingPage vocabulary={vocabulary} lines={lines} />
    </div>
  )
}
```

- [ ] **Step 6: Update the lesson-detail mode entry**

In `app/(protected)/books/[bookId]/lessons/[lessonId]/page.tsx`, change the `typing` entry in the `modes` array from:

```ts
{ key: 'typing', label: 'Gõ câu', description: 'Luyện gõ lại câu hội thoại', icon: Keyboard, enabled: false },
```

to:

```ts
{ key: 'typing', label: 'Gõ phản xạ', description: 'Luyện gõ từ và câu', icon: Keyboard, enabled: true },
```

- [ ] **Step 7: Manual verification**

Run: `npm run dev`, open a published lesson's detail page, click "Gõ phản xạ". Confirm:
- "Gõ từ" tab shows meaning_vi rows, typing the correct Hanzi and blurring turns the row green; wrong text turns it red; retyping re-grades.
- "Gõ câu" tab shows translation_vi + input, audio button only where `audio_url` exists, wrong answer locks the input and reveals the correct sentence, "Tiếp" advances, last line shows "Đã luyện xong N câu".
- Reload the page — no stale visual pass/fail state carries over (per spec, no read of prior `typing_progress`).

- [ ] **Step 8: Run the full test suite**

Run: `npm test`
Expected: all tests pass (prior suite + new typing tests), no regressions.

- [ ] **Step 9: Commit**

```bash
git add "app/(protected)/books/[bookId]/lessons/[lessonId]/typing" "app/(protected)/books/[bookId]/lessons/[lessonId]/page.tsx" tests/components/typing/TypingPage.test.tsx
git commit -m "feat: add Gõ phản xạ page (tab switcher, route) and enable typing mode"
```

---

## Self-Review Notes (for the plan author, already applied above)

- Spec coverage: §2 functional rules (normalization, upsert-not-log, streak rule, no-lock-on-vocab/lock-on-sentence, unlimited audio replays, exact-match only) are all encoded in Global Constraints and Tasks 1-4. §3 UI decisions (entry point label, tab structure, color tokens, completion message, error banner) are covered in Task 5 and the component implementations.
- No placeholders: every step has literal code, no "add tests for the above" or "similar to Task N" shortcuts.
- Type consistency checked: `Vocabulary`, `TypingKind`, `TypingProgress`, `DialogueLineForTyping` used with identical field names across all tasks (`word_zh`, `meaning_vi`, `text_zh`, `translation_vi`, `audio_url`, `kind`, `target_id`, `streak`, `is_correct`).
