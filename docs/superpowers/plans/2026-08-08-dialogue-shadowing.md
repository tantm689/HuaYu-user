# Hội thoại & Shadowing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the "Hội thoại" lesson tab: a dialogue picker → 2-tab detail screen (Nghe hội thoại / Shadowing), with a corrected, syllable-level pinyin grading engine for Shadowing pronunciation checks.

**Architecture:** Server components fetch dialogue data via a new `lib/db` query module and pass it to client components. `DialogueDetailPage` is a client component owning tab state (`'listen' | 'shadowing'`), following the exact pattern already used by `TypingPage.tsx` (mode state + back button). `ListenTab` ports `easy-chinese`'s `DialogueClient.tsx` UI onto our data shape. `ShadowingScreen` is a new single-screen UI (per the user-provided screenshot) built around a new pure grading module (`lib/shadowing/pinyinGrading.ts`) that compares syllable arrays instead of raw characters or toned pinyin strings.

**Tech Stack:** Next.js App Router (server + client components), TypeScript, Tailwind 4 (existing `@theme` tokens: `brand-red`, `brand-gold`, `ink-*`, `rounded-card`), Supabase, `pinyin-pro` (new dependency), Web Speech API (`SpeechRecognition`), `MediaRecorder`, Vitest + Testing Library.

## Global Constraints

- DB is traditional Chinese (zh-TW) end-to-end. Never assume simplified script; never hardcode `zh-CN` anywhere.
- Grading MUST compare toneless pinyin at syllable granularity (array from `pinyin-pro`'s `type: 'array', toneType: 'none'`), never raw characters and never toned pinyin as the pass/fail gate. Toned pinyin is display-only.
- Thresholds: `accuracy === 1` → `correct`; `accuracy >= 0.7` → `almost`; else → `incorrect`. `accuracy = (maxLen - levenshteinDistance) / maxLen` computed over syllable arrays.
- `recognition.lang = 'zh-TW'` (never `'zh-CN'`).
- `dialogues` has NO `title_zh`/`title_vi` columns (dropped in Admin migration `0017_drop_dialogue_titles.sql`). Display name is computed from `kind` + a per-kind 1-based counter — reuse the exact `dialogueDisplayNames()` logic below, do not query for titles.
- Follow existing UI conventions: Tailwind theme tokens from `app/globals.css` (`brand-red` `#C1272D`, `brand-gold` `#D4AF37`, `ink` `#2B2622`, `ink-faint` `#9A8F7E`, `rounded-card`/`rounded-card-sm`/`rounded-btn`), lucide-react icons, `'use client'` pages mirroring `TypingPage.tsx`'s back-button + mode-switch pattern.
- Tests live under `tests/components/<feature>/` and `tests/lib/<feature>/`, using Vitest + Testing Library, `vi.stubGlobal` for browser API mocks (see `tests/components/typing/SentenceTypingTab.test.tsx` for the established mocking style).
- Do not modify `main`. All work happens in the `shadowing-redo` branch / worktree at `e:\HuaYu\HuaYu-user\.worktrees\shadowing-redo`.

---

## Task 1: Verify live DB schema and add `pinyin-pro` dependency

Before writing any query code, confirm the actual live Supabase schema matches what the Admin migrations imply — the prior attempt broke by trusting migration files without checking whether they'd actually been applied (migrations here require manual apply and two, `0017`/`0020`, were marked "not applied to the live project" as of their commit).

**Files:**
- Modify: `package.json`, `package-lock.json` (or equivalent lockfile)
- Create: `docs/superpowers/notes/2026-08-08-dialogue-schema-verification.md` (throwaway verification notes, not shipped as a spec)

**Interfaces:**
- Produces: confirmed column list for `dialogues` and `dialogue_lines` that Task 2 will query against.

- [ ] **Step 1: Install `pinyin-pro`**

Run: `npm install pinyin-pro`

- [ ] **Step 2: Verify installation**

Run: `node -e "const {pinyin} = require('pinyin-pro'); console.log(pinyin('你好', { toneType: 'none', type: 'array' }))"`
Expected output: `[ 'ni', 'hao' ]`

- [ ] **Step 3: Verify the live `dialogues`/`dialogue_lines` schema**

This app has no local `.env.local` with Supabase credentials checked in. Find the real credentials (check `HuaYu-admin` sibling repo's `.env.local`, or ask the user for the Supabase project URL/anon key if not found locally) and query the live schema directly — do NOT assume migration files reflect production reality.

Two acceptable verification methods, use whichever is available:
- If Supabase CLI/MCP access is available, run: `select column_name, data_type from information_schema.columns where table_name in ('dialogues', 'dialogue_lines') order by table_name, ordinal_position;`
- Otherwise, temporarily add `NEXT_PUBLIC_SUPABASE_URL`/`NEXT_PUBLIC_SUPABASE_ANON_KEY` to a local (gitignored) `.env.local` copied from `HuaYu-admin`, start `npm run dev`, and hit a scratch API route or `node` script using `@supabase/supabase-js` to `select('*').limit(1)` from both tables and log the returned object keys.

Record the confirmed column list in `docs/superpowers/notes/2026-08-08-dialogue-schema-verification.md`. Expected (per `HuaYu-admin/supabase/migrations/0001_init.sql`, `0013_dialogue_kind.sql`, `0017_drop_dialogue_titles.sql`):
- `dialogues`: `id, lesson_id, "order", kind, audio_code, audio_url` (NO `title_zh`/`title_vi`)
- `dialogue_lines`: `id, dialogue_id, "order", speaker_zh, speaker_pinyin, text_zh, pinyin, translation_vi, audio_url` (plus `start_time`/`end_time` if `0020` was applied — irrelevant to this feature, ignore if present)

If the live schema differs from this expectation (e.g. `title_zh`/`title_vi` still present, or `kind` missing), STOP and report back before proceeding — do not silently adapt Task 2's query to guessed columns.

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json docs/superpowers/notes/2026-08-08-dialogue-schema-verification.md
git commit -m "chore: add pinyin-pro dependency, verify live dialogue schema"
```

---

## Task 2: Pinyin grading engine (`lib/shadowing/pinyinGrading.ts`)

Pure, framework-free grading logic — the core fix for the bug the user reported. Built and tested in isolation before any UI touches it.

**Files:**
- Create: `lib/shadowing/pinyinGrading.ts`
- Test: `tests/lib/shadowing/pinyinGrading.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export type GradeStatus = 'correct' | 'almost' | 'incorrect'

  export interface GradeResult {
    status: GradeStatus
    accuracy: number // 0..1
    targetSyllables: string[]       // toneless, e.g. ['ni', 'hao']
    transcriptSyllables: string[]   // toneless
    targetSyllablesToned: string[]  // toned, display only, e.g. ['nǐ', 'hǎo']
    transcriptSyllablesToned: string[] // toned, display only
  }

  export function gradeSyllables(target: string, transcript: string): GradeResult
  ```
  Later tasks (`ShadowingScreen.tsx`, its test) call `gradeSyllables(currentLine.text_zh, transcript)` and render based on `.status`, `.targetSyllablesToned`, `.transcriptSyllablesToned`.

- [ ] **Step 1: Write the failing tests**

Create `tests/lib/shadowing/pinyinGrading.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { gradeSyllables } from '@/lib/shadowing/pinyinGrading'

describe('gradeSyllables', () => {
  it('grades identical pinyin as correct even when characters differ (simplified vs traditional)', () => {
    // 你好嗎 (traditional target) vs 你好吗 (simplified ASR transcript) — same syllables
    const result = gradeSyllables('你好嗎', '你好吗')
    expect(result.status).toBe('correct')
    expect(result.accuracy).toBe(1)
    expect(result.targetSyllables).toEqual(['ni', 'hao', 'ma'])
    expect(result.transcriptSyllables).toEqual(['ni', 'hao', 'ma'])
  })

  it('grades homophone pronoun swap as correct (他/她 are acoustically identical)', () => {
    const result = gradeSyllables('她們', '他们')
    expect(result.status).toBe('correct')
    expect(result.accuracy).toBe(1)
  })

  it('grades a single-syllable mismatch out of 5 as almost (accuracy 0.8)', () => {
    const result = gradeSyllables('我很喜歡你', '我很喜歡他')
    expect(result.status).toBe('almost')
    expect(result.accuracy).toBeCloseTo(0.8, 5)
  })

  it('grades a single-syllable mismatch out of 3 as incorrect (accuracy below 0.7)', () => {
    const result = gradeSyllables('早安', '晚安')
    expect(result.status).toBe('incorrect')
    expect(result.accuracy).toBeCloseTo(0.5, 5)
  })

  it('exposes toned pinyin for display without using it for grading', () => {
    const result = gradeSyllables('你好', '你好')
    expect(result.targetSyllablesToned).toEqual(['nǐ', 'hǎo'])
    expect(result.transcriptSyllablesToned).toEqual(['nǐ', 'hǎo'])
  })

  it('treats an empty transcript as fully incorrect, not a crash', () => {
    const result = gradeSyllables('你好', '')
    expect(result.status).toBe('incorrect')
    expect(result.accuracy).toBe(0)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/lib/shadowing/pinyinGrading.test.ts`
Expected: FAIL — `Cannot find module '@/lib/shadowing/pinyinGrading'`

- [ ] **Step 3: Implement the grading module**

Create `lib/shadowing/pinyinGrading.ts`:

```ts
import { pinyin } from 'pinyin-pro'

export type GradeStatus = 'correct' | 'almost' | 'incorrect'

export interface GradeResult {
  status: GradeStatus
  accuracy: number
  targetSyllables: string[]
  transcriptSyllables: string[]
  targetSyllablesToned: string[]
  transcriptSyllablesToned: string[]
}

const ALMOST_THRESHOLD = 0.7

function toSyllables(text: string, toneType: 'none' | 'symbol'): string[] {
  if (!text) return []
  return pinyin(text, { toneType, type: 'array' })
}

// Levenshtein distance over syllable arrays (not characters) so a single
// mispronounced multi-letter syllable like "zhuang" costs exactly 1, the
// same as a single mispronounced short syllable like "a" — grading by raw
// Latin characters would unfairly penalize longer syllables.
function syllableLevenshtein(a: string[], b: string[]): number {
  const rows = a.length + 1
  const cols = b.length + 1
  const matrix: number[][] = Array.from({ length: rows }, () => new Array(cols).fill(0))

  for (let i = 0; i < rows; i++) matrix[i][0] = i
  for (let j = 0; j < cols; j++) matrix[0][j] = j

  for (let i = 1; i < rows; i++) {
    for (let j = 1; j < cols; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      )
    }
  }

  return matrix[a.length][b.length]
}

export function gradeSyllables(target: string, transcript: string): GradeResult {
  const targetSyllables = toSyllables(target, 'none')
  const transcriptSyllables = toSyllables(transcript, 'none')
  const targetSyllablesToned = toSyllables(target, 'symbol')
  const transcriptSyllablesToned = toSyllables(transcript, 'symbol')

  const maxLen = Math.max(targetSyllables.length, transcriptSyllables.length)
  const accuracy = maxLen === 0 ? 0 : (maxLen - syllableLevenshtein(targetSyllables, transcriptSyllables)) / maxLen

  const status: GradeStatus =
    accuracy === 1 ? 'correct' : accuracy >= ALMOST_THRESHOLD ? 'almost' : 'incorrect'

  return {
    status,
    accuracy,
    targetSyllables,
    transcriptSyllables,
    targetSyllablesToned,
    transcriptSyllablesToned,
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/lib/shadowing/pinyinGrading.test.ts`
Expected: PASS (6 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/shadowing/pinyinGrading.ts tests/lib/shadowing/pinyinGrading.test.ts
git commit -m "feat: add syllable-level pinyin grading for shadowing"
```

---

## Task 3: `dialogueDisplayNames` helper + `getDialogueById` query

**Files:**
- Create: `lib/db/dialogueDisplayName.ts`
- Create: `lib/db/getDialogueById.ts`
- Modify: `lib/db/types.ts` (add `Dialogue`, `DialogueLine`, `DialogueKind` if not already present — check first, they were already added in `lib/db/types.ts:125-143` per the current file; confirm they're still there before adding, do not duplicate)
- Test: `tests/lib/db/dialogueDisplayName.test.ts`

**Interfaces:**
- Consumes: Task 1's confirmed schema; `SupabaseClient` from `@supabase/supabase-js` (see `lib/db/getLesson.ts` for the established query pattern).
- Produces:
  ```ts
  export function dialogueDisplayNames(dialogues: { kind: DialogueKind }[]): string[]

  export async function getDialogueById(
    supabase: SupabaseClient,
    dialogueId: string
  ): Promise<Dialogue | null>
  ```
  `DialogueDetailPage` (Task 5) calls `getDialogueById`. The dialogue picker (Task 6) calls `dialogueDisplayNames`.

- [ ] **Step 1: Write the failing test for `dialogueDisplayNames`**

Create `tests/lib/db/dialogueDisplayName.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { dialogueDisplayNames } from '@/lib/db/dialogueDisplayName'

describe('dialogueDisplayNames', () => {
  it('numbers dialogue-kind entries sequentially as "Hội thoại N"', () => {
    const names = dialogueDisplayNames([{ kind: 'dialogue' }, { kind: 'dialogue' }])
    expect(names).toEqual(['Hội thoại 1', 'Hội thoại 2'])
  })

  it('keeps independent counters per kind', () => {
    const names = dialogueDisplayNames([{ kind: 'dialogue' }, { kind: 'passage' }])
    expect(names).toEqual(['Hội thoại 1', 'Đoạn văn 1'])
  })

  it('returns an empty array for no dialogues', () => {
    expect(dialogueDisplayNames([])).toEqual([])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/lib/db/dialogueDisplayName.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Confirm `Dialogue`/`DialogueLine`/`DialogueKind` types**

Read `lib/db/types.ts`. If `DialogueKind`, `Dialogue`, `DialogueLine` are already defined (they should be, per the current file's lines 125-143), leave them as-is. If missing, add:

```ts
export type DialogueKind = 'dialogue' | 'passage'

export interface DialogueLine {
  id: string
  order: number
  speaker_zh: string | null
  text_zh: string
  pinyin: string | null
  translation_vi: string | null
  audio_url: string | null
}

export interface Dialogue {
  id: string
  order: number
  kind: DialogueKind
  audio_url: string | null
  lines: DialogueLine[]
}
```

- [ ] **Step 4: Implement `dialogueDisplayNames`**

Create `lib/db/dialogueDisplayName.ts`:

```ts
import type { DialogueKind } from './types'

// dialogues.title_zh/title_vi don't exist (dropped in Admin migration
// 0017_drop_dialogue_titles.sql) - they were always a purely mechanical
// "對話一"/"Hội thoại I" label derived from kind+position, never genuine
// content. Display name is computed at render time from `kind` plus a
// per-kind 1-based counter, mirroring Admin's lib/dialogueDisplayName.ts.
//
// The counter is independent per kind: two dialogues both kind='dialogue'
// are "Hội thoại 1"/"Hội thoại 2"; a kind='dialogue' followed by a
// kind='passage' are "Hội thoại 1"/"Đoạn văn 1" (not "...2").
export function dialogueDisplayNames(dialogues: { kind: DialogueKind }[]): string[] {
  const countByKind: Record<DialogueKind, number> = { dialogue: 0, passage: 0 }

  return dialogues.map((d) => {
    countByKind[d.kind] += 1
    const label = d.kind === 'passage' ? 'Đoạn văn' : 'Hội thoại'
    return `${label} ${countByKind[d.kind]}`
  })
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run tests/lib/db/dialogueDisplayName.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 6: Implement `getDialogueById`**

Create `lib/db/getDialogueById.ts` (mirrors `lib/db/getDialogueLines.ts`'s query style, but fetches one dialogue with its lines fully — including `pinyin` and `speaker_zh`, which `getDialogueLines.ts` omits because it only serves the typing feature):

```ts
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Dialogue } from './types'

export async function getDialogueById(
  supabase: SupabaseClient,
  dialogueId: string
): Promise<Dialogue | null> {
  const { data, error } = await supabase
    .from('dialogues')
    .select(
      'id, order, kind, audio_url, dialogue_lines(id, order, speaker_zh, text_zh, pinyin, translation_vi, audio_url)'
    )
    .eq('id', dialogueId)
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!data) return null

  type Row = {
    id: string
    order: number
    kind: Dialogue['kind']
    audio_url: string | null
    dialogue_lines: {
      id: string
      order: number
      speaker_zh: string | null
      text_zh: string
      pinyin: string | null
      translation_vi: string | null
      audio_url: string | null
    }[]
  }

  const row = data as unknown as Row

  return {
    id: row.id,
    order: row.order,
    kind: row.kind,
    audio_url: row.audio_url,
    lines: [...row.dialogue_lines].sort((a, b) => a.order - b.order),
  }
}
```

- [ ] **Step 7: Commit**

```bash
git add lib/db/dialogueDisplayName.ts lib/db/getDialogueById.ts lib/db/types.ts tests/lib/db/dialogueDisplayName.test.ts
git commit -m "feat: add dialogue display name helper and getDialogueById query"
```

---

## Task 4: Dialogue picker page (`/dialogue`)

**Files:**
- Create: `app/(protected)/books/[bookId]/lessons/[lessonId]/dialogue/page.tsx`
- Create: `lib/db/getDialoguesForLesson.ts`
- Test: `tests/components/dialogue/DialoguePicker.test.tsx` (via a small extracted client list component, see Step 3)
- Create: `app/(protected)/books/[bookId]/lessons/[lessonId]/dialogue/DialoguePickerList.tsx`

**Interfaces:**
- Consumes: `getDialoguesForLesson`, `dialogueDisplayNames` (Task 3).
- Produces: navigates to `/books/[bookId]/lessons/[lessonId]/dialogue/[dialogueId]`, which Task 5 implements.

- [ ] **Step 1: Write the failing test**

Create `tests/components/dialogue/DialoguePicker.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import DialoguePickerList from '@/app/(protected)/books/[bookId]/lessons/[lessonId]/dialogue/DialoguePickerList'

const dialogues = [
  { id: 'd1', kind: 'dialogue' as const },
  { id: 'd2', kind: 'passage' as const },
]

describe('DialoguePickerList', () => {
  it('renders one link per dialogue with its computed display name', () => {
    render(<DialoguePickerList dialogues={dialogues} bookId="b1" lessonId="l1" />)
    expect(screen.getByRole('link', { name: /Hội thoại 1/ })).toHaveAttribute(
      'href',
      '/books/b1/lessons/l1/dialogue/d1'
    )
    expect(screen.getByRole('link', { name: /Đoạn văn 1/ })).toHaveAttribute(
      'href',
      '/books/b1/lessons/l1/dialogue/d2'
    )
  })

  it('shows an empty state when there are no dialogues', () => {
    render(<DialoguePickerList dialogues={[]} bookId="b1" lessonId="l1" />)
    expect(screen.getByText(/Chưa có bài hội thoại/)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/components/dialogue/DialoguePicker.test.tsx`
Expected: FAIL — module not found

- [ ] **Step 3: Implement `DialoguePickerList`**

Create `app/(protected)/books/[bookId]/lessons/[lessonId]/dialogue/DialoguePickerList.tsx`:

```tsx
import Link from 'next/link'
import { ChevronRight, MessageCircle } from 'lucide-react'
import { dialogueDisplayNames } from '@/lib/db/dialogueDisplayName'
import type { DialogueKind } from '@/lib/db/types'

export default function DialoguePickerList({
  dialogues,
  bookId,
  lessonId,
}: {
  dialogues: { id: string; kind: DialogueKind }[]
  bookId: string
  lessonId: string
}) {
  if (dialogues.length === 0) {
    return <p className="text-center font-medium text-ink-faint">Chưa có bài hội thoại nào.</p>
  }

  const names = dialogueDisplayNames(dialogues)

  return (
    <ul className="flex flex-col gap-3">
      {dialogues.map((dialogue, index) => (
        <li key={dialogue.id}>
          <Link
            href={`/books/${bookId}/lessons/${lessonId}/dialogue/${dialogue.id}`}
            className="group flex items-center gap-4 rounded-card-sm border border-card-border bg-white px-5 py-4 shadow-sm transition-all hover:-translate-y-0.5 hover:bg-amber-50/50 hover:shadow-md"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-50 text-brand-red">
              <MessageCircle className="h-5 w-5" strokeWidth={2} />
            </span>
            <span className="flex-1 font-bold text-ink">{names[index]}</span>
            <ChevronRight className="h-5 w-5 shrink-0 text-slate-400 transition-transform group-hover:translate-x-0.5" strokeWidth={2} />
          </Link>
        </li>
      ))}
    </ul>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/components/dialogue/DialoguePicker.test.tsx`
Expected: PASS (2 tests)

- [ ] **Step 5: Implement `getDialoguesForLesson`**

Create `lib/db/getDialoguesForLesson.ts`:

```ts
import type { SupabaseClient } from '@supabase/supabase-js'
import type { DialogueKind } from './types'

export interface DialogueListItem {
  id: string
  kind: DialogueKind
}

export async function getDialoguesForLesson(
  supabase: SupabaseClient,
  lessonId: string
): Promise<DialogueListItem[]> {
  const { data, error } = await supabase
    .from('dialogues')
    .select('id, kind, order')
    .eq('lesson_id', lessonId)
    .order('order', { ascending: true })

  if (error) throw new Error(error.message)

  return (data ?? []).map((row) => ({ id: row.id, kind: row.kind as DialogueKind }))
}
```

- [ ] **Step 6: Implement the picker page**

Create `app/(protected)/books/[bookId]/lessons/[lessonId]/dialogue/page.tsx`:

```tsx
import { notFound } from 'next/navigation'
import { createServerSupabase } from '@/lib/supabase/server'
import { getLesson } from '@/lib/db/getLesson'
import { getDialoguesForLesson } from '@/lib/db/getDialoguesForLesson'
import BackButton from '@/components/BackButton'
import DialoguePickerList from './DialoguePickerList'

export default async function DialoguePickerPage({
  params,
}: {
  params: Promise<{ bookId: string; lessonId: string }>
}) {
  const { bookId, lessonId } = await params
  const supabase = await createServerSupabase()
  const lesson = await getLesson(supabase, lessonId)

  if (!lesson) notFound()

  const dialogues = await getDialoguesForLesson(supabase, lessonId)

  return (
    <div className="mx-auto max-w-[660px] px-5 py-6">
      <BackButton fallbackHref={`/books/${bookId}/lessons/${lessonId}`} />
      <h1 className="mb-5 font-han-title text-2xl font-bold text-ink">Hội thoại</h1>
      <DialoguePickerList dialogues={dialogues} bookId={bookId} lessonId={lessonId} />
    </div>
  )
}
```

Check `components/BackButton.tsx`'s actual prop name before using it — grep for its usage in `typing/page.tsx` or `vocabulary/page.tsx` and match exactly (it may be `fallbackHref` as used in `TypingPage.tsx`, confirm rather than assume).

- [ ] **Step 7: Manual verification**

Run: `npm run dev`, navigate to `/books/<a-real-book-id>/lessons/<a-real-lesson-id>/dialogue` and confirm the list renders (or the empty state, if the lesson has no dialogues yet).

- [ ] **Step 8: Commit**

```bash
git add app/\(protected\)/books/\[bookId\]/lessons/\[lessonId\]/dialogue/page.tsx app/\(protected\)/books/\[bookId\]/lessons/\[lessonId\]/dialogue/DialoguePickerList.tsx lib/db/getDialoguesForLesson.ts tests/components/dialogue/DialoguePicker.test.tsx
git commit -m "feat: add dialogue picker page"
```

---

## Task 5: Dialogue detail page with 2-tab shell (`[dialogueId]/page.tsx` + `DialogueDetailPage.tsx`)

Sets up routing and tab switching. `ListenTab` and `ShadowingScreen` are stubbed minimally here and filled in by Tasks 6 and 7 respectively — this task's job is the shell and tab-switch behavior, testable independently of what's inside each tab.

**Files:**
- Create: `app/(protected)/books/[bookId]/lessons/[lessonId]/dialogue/[dialogueId]/page.tsx`
- Create: `app/(protected)/books/[bookId]/lessons/[lessonId]/dialogue/[dialogueId]/DialogueDetailPage.tsx`
- Test: `tests/components/dialogue/DialogueDetailPage.test.tsx`

**Interfaces:**
- Consumes: `getDialogueById` (Task 3), `Dialogue` type.
- Produces: renders `<ListenTab dialogue={dialogue} />` and `<ShadowingScreen dialogue={dialogue} />` — Tasks 6 and 7 must match these exact prop signatures.

- [ ] **Step 1: Write the failing test**

Create `tests/components/dialogue/DialogueDetailPage.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom'
import DialogueDetailPage from '@/app/(protected)/books/[bookId]/lessons/[lessonId]/dialogue/[dialogueId]/DialogueDetailPage'
import type { Dialogue } from '@/lib/db/types'

vi.mock('@/app/(protected)/books/[bookId]/lessons/[lessonId]/dialogue/[dialogueId]/ListenTab', () => ({
  default: () => <div>Listen tab content</div>,
}))
vi.mock('@/app/(protected)/books/[bookId]/lessons/[lessonId]/dialogue/[dialogueId]/ShadowingScreen', () => ({
  default: () => <div>Shadowing screen content</div>,
}))

const dialogue: Dialogue = {
  id: 'd1',
  order: 1,
  kind: 'dialogue',
  audio_url: null,
  lines: [
    { id: 'l1', order: 1, speaker_zh: 'A', text_zh: '你好', pinyin: 'nǐ hǎo', translation_vi: 'chào', audio_url: null },
  ],
}

describe('DialogueDetailPage', () => {
  it('shows the Listen tab by default', () => {
    render(<DialogueDetailPage dialogue={dialogue} displayName="Hội thoại 1" bookId="b1" lessonId="l1" />)
    expect(screen.getByText('Listen tab content')).toBeInTheDocument()
    expect(screen.queryByText('Shadowing screen content')).not.toBeInTheDocument()
  })

  it('switches to the Shadowing tab on click', () => {
    render(<DialogueDetailPage dialogue={dialogue} displayName="Hội thoại 1" bookId="b1" lessonId="l1" />)
    fireEvent.click(screen.getByRole('tab', { name: /Shadowing/ }))
    expect(screen.getByText('Shadowing screen content')).toBeInTheDocument()
    expect(screen.queryByText('Listen tab content')).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/components/dialogue/DialogueDetailPage.test.tsx`
Expected: FAIL — modules not found

- [ ] **Step 3: Create stub `ListenTab` and `ShadowingScreen`**

Create minimal placeholder files so the import resolves (Tasks 6/7 replace the bodies):

`app/(protected)/books/[bookId]/lessons/[lessonId]/dialogue/[dialogueId]/ListenTab.tsx`:
```tsx
import type { Dialogue } from '@/lib/db/types'

export default function ListenTab({ dialogue }: { dialogue: Dialogue }) {
  return <div>Listen tab placeholder for {dialogue.id}</div>
}
```

`app/(protected)/books/[bookId]/lessons/[lessonId]/dialogue/[dialogueId]/ShadowingScreen.tsx`:
```tsx
import type { Dialogue } from '@/lib/db/types'

export default function ShadowingScreen({ dialogue }: { dialogue: Dialogue }) {
  return <div>Shadowing screen placeholder for {dialogue.id}</div>
}
```

- [ ] **Step 4: Implement `DialogueDetailPage`**

Create `app/(protected)/books/[bookId]/lessons/[lessonId]/dialogue/[dialogueId]/DialogueDetailPage.tsx`:

```tsx
'use client'

import { useState } from 'react'
import { Headphones, Mic } from 'lucide-react'
import BackButton from '@/components/BackButton'
import type { Dialogue } from '@/lib/db/types'
import ListenTab from './ListenTab'
import ShadowingScreen from './ShadowingScreen'

type Tab = 'listen' | 'shadowing'

export default function DialogueDetailPage({
  dialogue,
  displayName,
  bookId,
  lessonId,
}: {
  dialogue: Dialogue
  displayName: string
  bookId: string
  lessonId: string
}) {
  const [tab, setTab] = useState<Tab>('listen')

  return (
    <div className="mx-auto max-w-[660px] px-5 py-6">
      <BackButton fallbackHref={`/books/${bookId}/lessons/${lessonId}/dialogue`} />
      <h1 className="mb-5 font-han-title text-2xl font-bold text-ink">{displayName}</h1>

      <div role="tablist" className="mb-5 flex gap-2 rounded-pill bg-accent-bg p-1">
        <button
          role="tab"
          type="button"
          aria-selected={tab === 'listen'}
          onClick={() => setTab('listen')}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-pill py-2 text-sm font-bold transition-colors ${
            tab === 'listen' ? 'bg-white text-brand-red shadow-sm' : 'text-ink-faint'
          }`}
        >
          <Headphones className="h-4 w-4" strokeWidth={2.5} />
          Nghe hội thoại
        </button>
        <button
          role="tab"
          type="button"
          aria-selected={tab === 'shadowing'}
          onClick={() => setTab('shadowing')}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-pill py-2 text-sm font-bold transition-colors ${
            tab === 'shadowing' ? 'bg-white text-brand-red shadow-sm' : 'text-ink-faint'
          }`}
        >
          <Mic className="h-4 w-4" strokeWidth={2.5} />
          Shadowing
        </button>
      </div>

      {tab === 'listen' ? <ListenTab dialogue={dialogue} /> : <ShadowingScreen dialogue={dialogue} />}
    </div>
  )
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run tests/components/dialogue/DialogueDetailPage.test.tsx`
Expected: PASS (2 tests)

- [ ] **Step 6: Implement the server page**

Create `app/(protected)/books/[bookId]/lessons/[lessonId]/dialogue/[dialogueId]/page.tsx`:

```tsx
import { notFound } from 'next/navigation'
import { createServerSupabase } from '@/lib/supabase/server'
import { getDialogueById } from '@/lib/db/getDialogueById'
import { getDialoguesForLesson } from '@/lib/db/getDialoguesForLesson'
import { dialogueDisplayNames } from '@/lib/db/dialogueDisplayName'
import DialogueDetailPage from './DialogueDetailPage'

export default async function DialogueDetailRoute({
  params,
}: {
  params: Promise<{ bookId: string; lessonId: string; dialogueId: string }>
}) {
  const { bookId, lessonId, dialogueId } = await params
  const supabase = await createServerSupabase()

  const dialogue = await getDialogueById(supabase, dialogueId)
  if (!dialogue) notFound()

  // Recompute display name from the full lesson's dialogue list so the
  // per-kind counter matches what the picker page showed (a dialogue's
  // display name depends on its position among sibling dialogues, not just
  // itself).
  const siblings = await getDialoguesForLesson(supabase, lessonId)
  const names = dialogueDisplayNames(siblings)
  const displayName = names[siblings.findIndex((d) => d.id === dialogueId)] ?? ''

  return (
    <DialogueDetailPage dialogue={dialogue} displayName={displayName} bookId={bookId} lessonId={lessonId} />
  )
}
```

- [ ] **Step 7: Commit**

```bash
git add "app/(protected)/books/[bookId]/lessons/[lessonId]/dialogue/[dialogueId]/"
git commit -m "feat: add dialogue detail page with listen/shadowing tab shell"
```

---

## Task 6: `ListenTab` — port easy-chinese's dialogue view

**Files:**
- Modify: `app/(protected)/books/[bookId]/lessons/[lessonId]/dialogue/[dialogueId]/ListenTab.tsx` (replace Task 5's stub)
- Test: `tests/components/dialogue/ListenTab.test.tsx`

**Interfaces:**
- Consumes: `Dialogue` type (`dialogue.lines[]`, each with `text_zh`, `pinyin`, `translation_vi`, `audio_url`, `speaker_zh`).
- Produces: nothing consumed by later tasks — this is a leaf component.

Reference: `e:\HuaYu\easy-chinese\app\lessons\[id]\dialogue\DialogueClient.tsx` for the interaction pattern (per-line audio play, current-line highlight, auto-advance). Read that file now if not already in context. Port the *behavior*, not the literal hex colors — use this app's `@theme` tokens (`brand-red`, `ink`, `ink-faint`, `card-border`, `rounded-card`) in place of easy-chinese's inline hex.

- [ ] **Step 1: Write the failing tests**

Create `tests/components/dialogue/ListenTab.test.tsx`:

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
  ],
}

beforeEach(() => {
  playMock.mockClear()
  pauseMock.mockClear()
})

describe('ListenTab', () => {
  it('renders every line with its Hanzi, pinyin, and translation', () => {
    render(<ListenTab dialogue={dialogue} />)
    expect(screen.getByText('你好嗎')).toBeInTheDocument()
    expect(screen.getByText('nǐ hǎo ma')).toBeInTheDocument()
    expect(screen.getByText('bạn khỏe không')).toBeInTheDocument()
    expect(screen.getByText('我很好')).toBeInTheDocument()
  })

  it('plays a line\'s audio when its card is clicked', () => {
    render(<ListenTab dialogue={dialogue} />)
    fireEvent.click(screen.getByText('你好嗎'))
    expect(playMock).toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/components/dialogue/ListenTab.test.tsx`
Expected: FAIL (placeholder text doesn't match)

- [ ] **Step 3: Implement `ListenTab`**

Replace `app/(protected)/books/[bookId]/lessons/[lessonId]/dialogue/[dialogueId]/ListenTab.tsx`:

```tsx
'use client'

import { useRef, useState } from 'react'
import type { Dialogue } from '@/lib/db/types'

export default function ListenTab({ dialogue }: { dialogue: Dialogue }) {
  const [currentLineId, setCurrentLineId] = useState<string | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)

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
      {dialogue.lines.map((line) => {
        const isCurrent = line.id === currentLineId
        return (
          <button
            key={line.id}
            type="button"
            onClick={() => playLine(line.id, line.audio_url)}
            disabled={!line.audio_url}
            className={`flex flex-col gap-2 rounded-card border p-5 text-left shadow-sm transition-all ${
              isCurrent ? 'border-brand-red/30 bg-white' : 'border-card-border bg-white/60'
            } ${line.audio_url ? 'cursor-pointer hover:-translate-y-0.5 hover:shadow-md' : 'cursor-default opacity-70'}`}
          >
            {line.speaker_zh && (
              <span className="text-xs font-bold uppercase tracking-wide text-ink-faint">{line.speaker_zh}</span>
            )}
            <span className="font-han-title text-2xl font-bold text-ink">{line.text_zh}</span>
            {line.pinyin && <span className="font-medium tracking-wide text-brand-gold">{line.pinyin}</span>}
            {line.translation_vi && <span className="text-sm text-ink-muted">{line.translation_vi}</span>}
          </button>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/components/dialogue/ListenTab.test.tsx`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add "app/(protected)/books/[bookId]/lessons/[lessonId]/dialogue/[dialogueId]/ListenTab.tsx" tests/components/dialogue/ListenTab.test.tsx
git commit -m "feat: implement ListenTab for dialogue playback"
```

---

## Task 7: `useSpeechRecognition` hook

Isolates the Web Speech API wrapper (with the `zh-TW` lang fix and the start/stop timing fix from the prior attempt) so `ShadowingScreen` stays focused on UI.

**Files:**
- Create: `lib/shadowing/useSpeechRecognition.ts`
- Test: `tests/lib/shadowing/useSpeechRecognition.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export interface UseSpeechRecognitionResult {
    isSupported: boolean
    isListening: boolean
    start: () => void
    stop: () => void
  }

  export function useSpeechRecognition(onResult: (transcript: string) => void): UseSpeechRecognitionResult
  ```
  Task 8 (`ShadowingScreen`) calls `useSpeechRecognition(handleTranscript)` and calls `.start()`/`.stop()` in lockstep with `MediaRecorder.start()`/`.stop()`.

- [ ] **Step 1: Write the failing tests**

Create `tests/lib/shadowing/useSpeechRecognition.test.ts`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useSpeechRecognition } from '@/lib/shadowing/useSpeechRecognition'

class MockSpeechRecognition {
  lang = ''
  continuous = false
  interimResults = false
  onresult: ((e: any) => void) | null = null
  onerror: ((e: any) => void) | null = null
  onend: (() => void) | null = null
  start = vi.fn()
  stop = vi.fn()
  abort = vi.fn()
}

let lastInstance: MockSpeechRecognition | null = null

beforeEach(() => {
  lastInstance = null
  vi.stubGlobal(
    'webkitSpeechRecognition',
    vi.fn().mockImplementation(() => {
      lastInstance = new MockSpeechRecognition()
      return lastInstance
    })
  )
})

describe('useSpeechRecognition', () => {
  it('reports unsupported when no SpeechRecognition constructor exists', () => {
    vi.stubGlobal('webkitSpeechRecognition', undefined)
    vi.stubGlobal('SpeechRecognition', undefined)
    const { result } = renderHook(() => useSpeechRecognition(() => {}))
    expect(result.current.isSupported).toBe(false)
  })

  it('sets lang to zh-TW (never zh-CN) on start', () => {
    const { result } = renderHook(() => useSpeechRecognition(() => {}))
    act(() => result.current.start())
    expect(lastInstance?.lang).toBe('zh-TW')
    expect(lastInstance?.start).toHaveBeenCalled()
  })

  it('invokes onResult with the recognized transcript', () => {
    const onResult = vi.fn()
    const { result } = renderHook(() => useSpeechRecognition(onResult))
    act(() => result.current.start())
    act(() => {
      lastInstance?.onresult?.({ results: [[{ transcript: '你好' }]] })
    })
    expect(onResult).toHaveBeenCalledWith('你好')
  })

  it('calls abort, not just stop, when stop() is invoked while listening', () => {
    const { result } = renderHook(() => useSpeechRecognition(() => {}))
    act(() => result.current.start())
    act(() => result.current.stop())
    expect(lastInstance?.stop).toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/lib/shadowing/useSpeechRecognition.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement the hook**

Create `lib/shadowing/useSpeechRecognition.ts`:

```ts
'use client'

import { useCallback, useRef, useState } from 'react'

export interface UseSpeechRecognitionResult {
  isSupported: boolean
  isListening: boolean
  start: () => void
  stop: () => void
}

// Stale-closure hazard (hit twice in the prior implementation attempt):
// onResult is captured by `recognition.onresult` at the time `start()` runs,
// so it must always read the LATEST callback, not the one from whichever
// render created the recognition instance. A ref sidesteps this.
export function useSpeechRecognition(
  onResult: (transcript: string) => void
): UseSpeechRecognitionResult {
  const onResultRef = useRef(onResult)
  onResultRef.current = onResult

  const recognitionRef = useRef<any>(null)
  const [isListening, setIsListening] = useState(false)

  const SpeechRecognitionCtor =
    typeof window !== 'undefined'
      ? (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
      : undefined

  const isSupported = Boolean(SpeechRecognitionCtor)

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
      setIsListening(false)
    }

    setIsListening(true)
    recognition.start()
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
  }, [])

  return { isSupported, isListening, start, stop }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/lib/shadowing/useSpeechRecognition.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/shadowing/useSpeechRecognition.ts tests/lib/shadowing/useSpeechRecognition.test.ts
git commit -m "feat: add useSpeechRecognition hook with zh-TW locale"
```

---

## Task 8: `ShadowingScreen` — recording UI, audio player, and grading result

The main UI task. Follows the screenshot layout: compact audio player up top, current-sentence card (Hanzi + full-sentence pinyin + translation), two buttons (PHÁT LẠI GHI ÂM / GHI ÂM), automatic grading result after recording stops, list of other sentences below.

**Files:**
- Modify: `app/(protected)/books/[bookId]/lessons/[lessonId]/dialogue/[dialogueId]/ShadowingScreen.tsx` (replace Task 5's stub)
- Test: `tests/components/dialogue/ShadowingScreen.test.tsx`

**Interfaces:**
- Consumes: `gradeSyllables` (Task 2), `useSpeechRecognition` (Task 7), `Dialogue` type.
- Produces: nothing consumed by later tasks — leaf component.

- [ ] **Step 1: Write the failing tests**

Create `tests/components/dialogue/ShadowingScreen.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import '@testing-library/jest-dom'
import ShadowingScreen from '@/app/(protected)/books/[bookId]/lessons/[lessonId]/dialogue/[dialogueId]/ShadowingScreen'
import type { Dialogue } from '@/lib/db/types'

const dialogue: Dialogue = {
  id: 'd1',
  order: 1,
  kind: 'dialogue',
  audio_url: null,
  lines: [
    { id: 'l1', order: 1, speaker_zh: null, text_zh: '你好嗎', pinyin: 'nǐ hǎo ma', translation_vi: 'bạn khỏe không', audio_url: null },
    { id: 'l2', order: 2, speaker_zh: null, text_zh: '我很好', pinyin: 'wǒ hěn hǎo', translation_vi: 'tôi khỏe', audio_url: null },
  ],
}

// --- MediaRecorder mock ---
let recorderInstances: any[] = []
class MockMediaRecorder {
  ondataavailable: ((e: any) => void) | null = null
  onstop: (() => void) | null = null
  state: 'inactive' | 'recording' = 'inactive'
  constructor(public stream: any) {
    recorderInstances.push(this)
  }
  start() {
    this.state = 'recording'
  }
  stop() {
    this.state = 'inactive'
    this.ondataavailable?.({ data: new Blob(['x']) })
    this.onstop?.()
  }
}
vi.stubGlobal('MediaRecorder', MockMediaRecorder)
vi.stubGlobal('URL', { createObjectURL: vi.fn(() => 'blob:mock'), revokeObjectURL: vi.fn() })

const getUserMediaMock = vi.fn().mockResolvedValue({ getTracks: () => [{ stop: vi.fn() }] })
vi.stubGlobal('navigator', { mediaDevices: { getUserMedia: getUserMediaMock } })

// --- SpeechRecognition mock ---
let lastRecognition: any = null
class MockSpeechRecognition {
  lang = ''
  continuous = false
  interimResults = false
  onresult: ((e: any) => void) | null = null
  onerror: (() => void) | null = null
  onend: (() => void) | null = null
  start = vi.fn()
  stop = vi.fn()
  constructor() {
    lastRecognition = this
  }
}
vi.stubGlobal('webkitSpeechRecognition', MockSpeechRecognition)

beforeEach(() => {
  recorderInstances = []
  lastRecognition = null
  getUserMediaMock.mockClear()
})

describe('ShadowingScreen', () => {
  it('shows the first line and disables "Phát lại ghi âm" before any recording exists', () => {
    render(<ShadowingScreen dialogue={dialogue} />)
    expect(screen.getByText('你好嗎')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Phát lại ghi âm/i })).toBeDisabled()
  })

  it('starts MediaRecorder and SpeechRecognition together when "Ghi âm" is clicked', async () => {
    render(<ShadowingScreen dialogue={dialogue} />)
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /^Ghi âm$/i }))
    })
    expect(getUserMediaMock).toHaveBeenCalled()
    expect(recorderInstances[0].state).toBe('recording')
    expect(lastRecognition.start).toHaveBeenCalled()
    expect(lastRecognition.lang).toBe('zh-TW')
  })

  it('grades automatically and shows a correct result once recording stops with a matching transcript', async () => {
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
    expect(screen.getByText(/Phát âm chính xác/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Phát lại ghi âm/i })).toBeEnabled()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/components/dialogue/ShadowingScreen.test.tsx`
Expected: FAIL (placeholder text doesn't match / buttons don't exist)

- [ ] **Step 3: Implement `ShadowingScreen`**

Replace `app/(protected)/books/[bookId]/lessons/[lessonId]/dialogue/[dialogueId]/ShadowingScreen.tsx`:

```tsx
'use client'

import { useRef, useState } from 'react'
import { Mic, Play, Square } from 'lucide-react'
import type { Dialogue } from '@/lib/db/types'
import { gradeSyllables, type GradeResult } from '@/lib/shadowing/pinyinGrading'
import { useSpeechRecognition } from '@/lib/shadowing/useSpeechRecognition'

export default function ShadowingScreen({ dialogue }: { dialogue: Dialogue }) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isRecording, setIsRecording] = useState(false)
  const [recordedUrl, setRecordedUrl] = useState<string | null>(null)
  const [result, setResult] = useState<GradeResult | null>(null)
  const [permissionError, setPermissionError] = useState(false)

  const currentLine = dialogue.lines[currentIndex]

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const transcriptRef = useRef<string>('')
  const recordedAudioRef = useRef<HTMLAudioElement | null>(null)

  const speech = useSpeechRecognition((transcript) => {
    transcriptRef.current = transcript
  })

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

        const graded = gradeSyllables(currentLine.text_zh, transcriptRef.current)
        setResult(graded)
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

      {result && (
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

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/components/dialogue/ShadowingScreen.test.tsx`
Expected: PASS (3 tests)

- [ ] **Step 5: Manual verification**

Run: `npm run dev`, navigate to a dialogue's Shadowing tab in Chrome, grant microphone permission, click "Ghi âm", say the sentence aloud, click "Dừng ghi âm", confirm a grading result appears automatically (no separate "chấm điểm" button needed) and "Phát lại ghi âm" now plays back the recording.

- [ ] **Step 6: Commit**

```bash
git add "app/(protected)/books/[bookId]/lessons/[lessonId]/dialogue/[dialogueId]/ShadowingScreen.tsx" tests/components/dialogue/ShadowingScreen.test.tsx
git commit -m "feat: implement ShadowingScreen with syllable-level grading"
```

---

## Task 9: Enable the "Hội thoại" lesson tab

Flips the feature on now that the full flow works end-to-end.

**Files:**
- Modify: `app/(protected)/books/[bookId]/lessons/[lessonId]/page.tsx:10`

**Interfaces:**
- Consumes: nothing new.
- Produces: nothing consumed by later tasks — this is the final integration step.

- [ ] **Step 1: Flip `enabled: false` to `enabled: true`**

In `app/(protected)/books/[bookId]/lessons/[lessonId]/page.tsx`, change line 10:

```ts
{ key: 'dialogue', label: 'Hội thoại', description: 'Ôn lại và luyện nghe nói', icon: BookText, enabled: true },
```

- [ ] **Step 2: Run the full test suite**

Run: `npm test`
Expected: PASS — all existing tests (baseline 157 + all new tests added in Tasks 1-8) pass, zero failures.

- [ ] **Step 3: Manual end-to-end verification**

Run: `npm run dev`. From a lesson page, click "Hội thoại" (now enabled, no longer "Sắp ra mắt"), confirm the picker lists dialogues, click into one, confirm both tabs work: Nghe hội thoại plays per-line audio, Shadowing records and grades correctly for at least one sentence containing a pronoun like 他/她 or 你/妳 to confirm the original bug is fixed.

- [ ] **Step 4: Commit**

```bash
git add "app/(protected)/books/[bookId]/lessons/[lessonId]/page.tsx"
git commit -m "feat: enable Hội thoại lesson tab"
```

---

## Post-plan note

`docs/superpowers/notes/2026-08-08-dialogue-schema-verification.md` (Task 1) is a working note, not a durable spec — fine to leave in the repo for future reference, but it documents a point-in-time DB check, not a design decision.
