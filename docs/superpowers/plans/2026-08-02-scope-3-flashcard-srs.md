# Scope 3 — Flashcard SRS (Leitner) + tích hợp "Xem cách viết" Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Biến trang "Từ vựng" hiện có (word-chip picker + xem nét chữ, đã build sẵn nhưng chưa commit) thành flashcard SRS đầy đủ theo thuật toán Leitner (mục 4 spec), và thêm khối "Ôn hôm nay" ở trang chủ gộp thẻ đến hạn từ mọi bài.

**Architecture:** Giữ nguyên UI xem-cách-viết hiện có (`HanziStrokeOrder`, word-chip picker trong `VocabularyFlashcards.tsx`) làm lớp hiển thị; thêm lớp lật thẻ (mặt trước `word_zh` / mặt sau đáp án + nút "Xem cách viết") và lớp SRS (đọc/ghi `vocabulary_progress` qua Supabase client trực tiếp từ trình duyệt, RLS lọc theo `auth.uid()`). "Ôn hôm nay" là 1 trang mới dùng lại đúng component lật thẻ, chỉ khác nguồn danh sách thẻ (theo `due_at <= now()` thay vì theo 1 lesson).

**Tech Stack:** Next.js 16 App Router (Server Component fetch + Client Component tương tác), TypeScript, Tailwind 4, Supabase JS client, `hanzi-writer` (đã cài).

## Global Constraints

- Không viết logic Hội thoại/Ngữ pháp/Quiz/Gõ phản xạ (mode `enabled: false` trong `app/(protected)/books/[bookId]/lessons/[lessonId]/page.tsx` giữ nguyên) — thuộc Scope 4-6.
- Server Component cho fetch ban đầu (dùng `createServerSupabase` từ `lib/supabase/server.ts`), Client Component cho phần tương tác + ghi progress (dùng `createBrowserSupabase` từ `lib/supabase/browser.ts`).
- SRS Leitner đúng theo spec mục 4: Box 0 = "Đang học", cần 3 lần đúng liên tiếp (`learning_streak`, bền trong DB) mới lên Box 1 (`due_at = now() + 1 ngày`). Box 1-5: đúng → box+1 (tối đa 5), lịch ôn box 1=1 ngày / box 2=3 ngày / box 3=7 ngày / box 4=14 ngày / box 5=30 ngày. Sai bất kỳ lúc nào ở box ≥ 1 → về thẳng `box = 1`, `due_at = ngày mai`. Sai ở box 0 → `learning_streak = 0`, `due_at = now()`.
- Mở tab "Từ mới" của 1 lesson = tự động insert các dòng `vocabulary_progress` còn thiếu (`box=0`, `due_at=now()`, `on conflict (user_id, vocabulary_id) do nothing`) — không có nút "Bắt đầu học" trung gian.
- "Ôn hôm nay" chỉ query `vocabulary_progress where user_id = auth.uid() and due_at <= now()`, KHÔNG JOIN/quét toàn bộ bảng `vocabulary`.
- "Xem cách viết" (component `HanziStrokeOrder` đã có) thuần hiển thị — không chấm điểm, không lưu DB, không đụng SRS. Không sửa logic bên trong component này trừ khi cần thiết để tích hợp vào flip-card.
- Trước khi đọc bất kỳ bảng nội dung nào lần đầu (nếu phát sinh), kiểm tra `pg_policies` thay vì giả định RLS đúng — bài học từ Scope 1-2 (đã dính bug "to anon"-only 2 lần trên 9 bảng).
- Test: `npm test` chạy `tsc --noEmit && vitest run` — mọi task có test đều phải pass cả hai.
- Dừng lại sau khi Scope 3 hoàn thành để người dùng tự verify trên trình duyệt thật trước khi sang Scope 4.

## Bối cảnh mã nguồn hiện có (đọc trước khi bắt đầu, KHÔNG viết lại)

Các file sau đã tồn tại trong repo (uncommitted, từ một phiên làm việc khác) và **phải được giữ nguyên**, chỉ chỉnh sửa đúng phần được chỉ định trong từng task:

- `lib/db/types.ts` — đã có `Vocabulary { id, dialogue_id, order, word_zh, pinyin, meaning_vi, audio_url }`, `DialogueVocabulary { dialogue_id, dialogue_order, words: Vocabulary[] }`, và từ Scope 2: `VocabularyProgress { id, user_id, vocabulary_id, box, learning_streak, due_at, last_reviewed_at, created_at }`.
- `lib/db/getLesson.ts` — `getLesson(supabase, lessonId): Promise<Lesson | null>`, lọc `status = 'published'`.
- `lib/db/getLessonVocabulary.ts` — `getLessonVocabulary(supabase, lessonId): Promise<DialogueVocabulary[]>`, JOIN `dialogues` → `vocabulary`, sắp theo `order`, lọc dialogue rỗng.
- `components/HanziStrokeOrder.tsx` — Client Component, nhận `{ character: string; size?: number }`, dùng `HanziWriter.create(...).animateCharacter()`, có nút phát lại. Đã đúng spec "Xem cách viết" — không sửa.
- `components/BackButton.tsx` — nút quay lại dùng `router.back()`.
- `app/(protected)/books/[bookId]/lessons/[lessonId]/page.tsx` — trang chọn mode (Từ vựng/Hội thoại/Ngữ pháp/Gõ câu/Quiz), chỉ `vocabulary` đang `enabled: true`.
- `app/(protected)/books/[bookId]/lessons/[lessonId]/vocabulary/page.tsx` — Server Component, fetch `lesson` + `dialogueGroups`, render `VocabularyFlashcards`.
- `app/(protected)/books/[bookId]/lessons/[lessonId]/vocabulary/VocabularyFlashcards.tsx` — Client Component hiện tại: word-chip picker (chọn từ) + hiển thị `HanziStrokeOrder` cho ký tự đang chọn + `pinyin`/`meaning_vi` tĩnh luôn hiện (KHÔNG phải flip-card — cả mặt trước/sau hiện cùng lúc). **Task 2 sẽ thay thế phần hiển thị đáp án tĩnh này bằng flip-card thật.**

## Task 1: Data layer — khởi tạo tiến độ SRS khi mở bài + hàm ghi kết quả ôn

**Files:**
- Create: `lib/db/ensureVocabularyProgress.ts`
- Create: `lib/db/recordVocabularyReview.ts`
- Create: `lib/srs/leitner.ts`
- Test: `tests/lib/srs/leitner.test.ts`
- Test: `tests/lib/db/ensureVocabularyProgress.test.ts`
- Test: `tests/lib/db/recordVocabularyReview.test.ts`

**Interfaces:**
- Consumes: `VocabularyProgress` type từ `lib/db/types.ts` (đã có sẵn: `{ id, user_id, vocabulary_id, box, learning_streak, due_at, last_reviewed_at, created_at }`).
- Produces:
  - `computeNextReview(current: { box: number; learning_streak: number }, correct: boolean): { box: number; learning_streak: number; due_at: string }` — hàm thuần (pure function), không I/O, dùng bởi Task 2's UI và Task 4's "Ôn hôm nay".
  - `ensureVocabularyProgress(supabase: SupabaseClient, vocabularyIds: string[]): Promise<void>` — insert các dòng còn thiếu cho user hiện tại, an toàn gọi lại nhiều lần.
  - `recordVocabularyReview(supabase: SupabaseClient, progressId: string, next: { box: number; learning_streak: number; due_at: string }): Promise<void>` — update 1 dòng `vocabulary_progress`, set thêm `last_reviewed_at = now()`.

- [ ] **Step 1: Viết test cho thuật toán Leitner thuần túy**

```typescript
// tests/lib/srs/leitner.test.ts
import { describe, it, expect } from 'vitest'
import { computeNextReview } from '@/lib/srs/leitner'

describe('computeNextReview', () => {
  it('box 0 đúng lần 1: streak tăng lên 1, vẫn ở box 0, due ngay (ôn lại trong phiên)', () => {
    const result = computeNextReview({ box: 0, learning_streak: 0 }, true)
    expect(result.box).toBe(0)
    expect(result.learning_streak).toBe(1)
  })

  it('box 0 đúng lần 2: streak tăng lên 2, vẫn ở box 0', () => {
    const result = computeNextReview({ box: 0, learning_streak: 1 }, true)
    expect(result.box).toBe(0)
    expect(result.learning_streak).toBe(2)
  })

  it('box 0 đúng lần 3 liên tiếp: tốt nghiệp lên box 1, due sau 1 ngày', () => {
    const before = Date.now()
    const result = computeNextReview({ box: 0, learning_streak: 2 }, true)
    expect(result.box).toBe(1)
    expect(result.learning_streak).toBe(3)
    const dueMs = new Date(result.due_at).getTime()
    const oneDayMs = 24 * 60 * 60 * 1000
    expect(dueMs).toBeGreaterThanOrEqual(before + oneDayMs - 5000)
    expect(dueMs).toBeLessThanOrEqual(before + oneDayMs + 5000)
  })

  it('box 0 sai: streak reset về 0, due ngay lập tức (lặp lại trong phiên)', () => {
    const before = Date.now()
    const result = computeNextReview({ box: 0, learning_streak: 2 }, false)
    expect(result.box).toBe(0)
    expect(result.learning_streak).toBe(0)
    const dueMs = new Date(result.due_at).getTime()
    expect(dueMs).toBeLessThanOrEqual(before + 5000)
  })

  it('box 1 đúng: lên box 2, due sau 3 ngày', () => {
    const before = Date.now()
    const result = computeNextReview({ box: 1, learning_streak: 3 }, true)
    expect(result.box).toBe(2)
    const dueMs = new Date(result.due_at).getTime()
    const threeDaysMs = 3 * 24 * 60 * 60 * 1000
    expect(dueMs).toBeGreaterThanOrEqual(before + threeDaysMs - 5000)
    expect(dueMs).toBeLessThanOrEqual(before + threeDaysMs + 5000)
  })

  it('box 5 đúng: giữ nguyên box 5 (đã max), due sau 30 ngày', () => {
    const before = Date.now()
    const result = computeNextReview({ box: 5, learning_streak: 3 }, true)
    expect(result.box).toBe(5)
    const dueMs = new Date(result.due_at).getTime()
    const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000
    expect(dueMs).toBeGreaterThanOrEqual(before + thirtyDaysMs - 5000)
    expect(dueMs).toBeLessThanOrEqual(before + thirtyDaysMs + 5000)
  })

  it('box 3 sai: về thẳng box 1, due ngày mai', () => {
    const before = Date.now()
    const result = computeNextReview({ box: 3, learning_streak: 0 }, false)
    expect(result.box).toBe(1)
    const dueMs = new Date(result.due_at).getTime()
    const oneDayMs = 24 * 60 * 60 * 1000
    expect(dueMs).toBeGreaterThanOrEqual(before + oneDayMs - 5000)
    expect(dueMs).toBeLessThanOrEqual(before + oneDayMs + 5000)
  })
})
```

- [ ] **Step 2: Chạy test, xác nhận fail (module chưa tồn tại)**

Run: `npm test -- leitner`
Expected: FAIL với lỗi không tìm thấy module `@/lib/srs/leitner`

- [ ] **Step 3: Viết `lib/srs/leitner.ts`**

```typescript
// lib/srs/leitner.ts
const BOX_INTERVALS_DAYS: Record<number, number> = {
  1: 1,
  2: 3,
  3: 7,
  4: 14,
  5: 30,
}

const LEARNING_STREAK_TO_GRADUATE = 3

export interface LeitnerState {
  box: number
  learning_streak: number
}

export interface LeitnerResult {
  box: number
  learning_streak: number
  due_at: string
}

function addDays(days: number): string {
  const due = new Date()
  due.setDate(due.getDate() + days)
  return due.toISOString()
}

export function computeNextReview(current: LeitnerState, correct: boolean): LeitnerResult {
  if (current.box === 0) {
    if (!correct) {
      return { box: 0, learning_streak: 0, due_at: new Date().toISOString() }
    }

    const nextStreak = current.learning_streak + 1
    if (nextStreak >= LEARNING_STREAK_TO_GRADUATE) {
      return { box: 1, learning_streak: nextStreak, due_at: addDays(BOX_INTERVALS_DAYS[1]) }
    }
    return { box: 0, learning_streak: nextStreak, due_at: new Date().toISOString() }
  }

  if (!correct) {
    return { box: 1, learning_streak: 0, due_at: addDays(BOX_INTERVALS_DAYS[1]) }
  }

  const nextBox = Math.min(current.box + 1, 5)
  return { box: nextBox, learning_streak: current.learning_streak, due_at: addDays(BOX_INTERVALS_DAYS[nextBox]) }
}
```

- [ ] **Step 4: Chạy test, xác nhận pass**

Run: `npm test -- leitner`
Expected: PASS, 7 tests

- [ ] **Step 5: Viết test cho `ensureVocabularyProgress`**

```typescript
// tests/lib/db/ensureVocabularyProgress.test.ts
import { describe, it, expect, vi } from 'vitest'
import { ensureVocabularyProgress } from '@/lib/db/ensureVocabularyProgress'

describe('ensureVocabularyProgress', () => {
  it('upserts progress rows for every vocabulary id with box=0, ignoring conflicts', async () => {
    const upsert = vi.fn().mockResolvedValue({ error: null })
    const fakeClient = {
      from: vi.fn().mockReturnValue({ upsert }),
    }

    await ensureVocabularyProgress(fakeClient as never, ['v1', 'v2'])

    expect(fakeClient.from).toHaveBeenCalledWith('vocabulary_progress')
    expect(upsert).toHaveBeenCalledWith(
      [
        { vocabulary_id: 'v1', box: 0, learning_streak: 0, due_at: expect.any(String) },
        { vocabulary_id: 'v2', box: 0, learning_streak: 0, due_at: expect.any(String) },
      ],
      { onConflict: 'user_id,vocabulary_id', ignoreDuplicates: true }
    )
  })

  it('does nothing when the vocabulary id list is empty', async () => {
    const upsert = vi.fn()
    const fakeClient = { from: vi.fn().mockReturnValue({ upsert }) }

    await ensureVocabularyProgress(fakeClient as never, [])

    expect(fakeClient.from).not.toHaveBeenCalled()
  })

  it('throws when Supabase returns an error', async () => {
    const upsert = vi.fn().mockResolvedValue({ error: { message: 'db error' } })
    const fakeClient = { from: vi.fn().mockReturnValue({ upsert }) }

    await expect(ensureVocabularyProgress(fakeClient as never, ['v1'])).rejects.toThrow('db error')
  })
})
```

- [ ] **Step 6: Chạy test, xác nhận fail**

Run: `npm test -- ensureVocabularyProgress`
Expected: FAIL, module không tồn tại

- [ ] **Step 7: Viết `lib/db/ensureVocabularyProgress.ts`**

`user_id` không cần truyền — cột có `default auth.uid()` (migration 0001), Postgres tự điền từ token của request đang đăng nhập.

```typescript
// lib/db/ensureVocabularyProgress.ts
import type { SupabaseClient } from '@supabase/supabase-js'

export async function ensureVocabularyProgress(
  supabase: SupabaseClient,
  vocabularyIds: string[]
): Promise<void> {
  if (vocabularyIds.length === 0) return

  const now = new Date().toISOString()
  const rows = vocabularyIds.map((vocabulary_id) => ({
    vocabulary_id,
    box: 0,
    learning_streak: 0,
    due_at: now,
  }))

  const { error } = await supabase
    .from('vocabulary_progress')
    .upsert(rows, { onConflict: 'user_id,vocabulary_id', ignoreDuplicates: true })

  if (error) throw new Error(error.message)
}
```

- [ ] **Step 8: Chạy test, xác nhận pass**

Run: `npm test -- ensureVocabularyProgress`
Expected: PASS, 3 tests

- [ ] **Step 9: Viết test cho `recordVocabularyReview`**

```typescript
// tests/lib/db/recordVocabularyReview.test.ts
import { describe, it, expect, vi } from 'vitest'
import { recordVocabularyReview } from '@/lib/db/recordVocabularyReview'

describe('recordVocabularyReview', () => {
  it('updates the progress row with the computed next state and last_reviewed_at', async () => {
    const eqFn = vi.fn().mockResolvedValue({ error: null })
    const update = vi.fn().mockReturnValue({ eq: eqFn })
    const fakeClient = { from: vi.fn().mockReturnValue({ update }) }

    await recordVocabularyReview(fakeClient as never, 'progress-1', {
      box: 1,
      learning_streak: 3,
      due_at: '2026-08-03T00:00:00.000Z',
    })

    expect(fakeClient.from).toHaveBeenCalledWith('vocabulary_progress')
    expect(update).toHaveBeenCalledWith({
      box: 1,
      learning_streak: 3,
      due_at: '2026-08-03T00:00:00.000Z',
      last_reviewed_at: expect.any(String),
    })
    expect(eqFn).toHaveBeenCalledWith('id', 'progress-1')
  })

  it('throws when Supabase returns an error', async () => {
    const eqFn = vi.fn().mockResolvedValue({ error: { message: 'db error' } })
    const update = vi.fn().mockReturnValue({ eq: eqFn })
    const fakeClient = { from: vi.fn().mockReturnValue({ update }) }

    await expect(
      recordVocabularyReview(fakeClient as never, 'progress-1', {
        box: 1,
        learning_streak: 0,
        due_at: '2026-08-03T00:00:00.000Z',
      })
    ).rejects.toThrow('db error')
  })
})
```

- [ ] **Step 10: Chạy test, xác nhận fail**

Run: `npm test -- recordVocabularyReview`
Expected: FAIL, module không tồn tại

- [ ] **Step 11: Viết `lib/db/recordVocabularyReview.ts`**

```typescript
// lib/db/recordVocabularyReview.ts
import type { SupabaseClient } from '@supabase/supabase-js'
import type { LeitnerResult } from '@/lib/srs/leitner'

export async function recordVocabularyReview(
  supabase: SupabaseClient,
  progressId: string,
  next: LeitnerResult
): Promise<void> {
  const { error } = await supabase
    .from('vocabulary_progress')
    .update({
      box: next.box,
      learning_streak: next.learning_streak,
      due_at: next.due_at,
      last_reviewed_at: new Date().toISOString(),
    })
    .eq('id', progressId)

  if (error) throw new Error(error.message)
}
```

- [ ] **Step 12: Chạy test, xác nhận pass**

Run: `npm test -- recordVocabularyReview`
Expected: PASS, 2 tests

- [ ] **Step 13: Chạy toàn bộ test suite + typecheck**

Run: `npm test`
Expected: PASS toàn bộ, không lỗi TypeScript

- [ ] **Step 14: Commit**

```bash
git add lib/srs/leitner.ts lib/db/ensureVocabularyProgress.ts lib/db/recordVocabularyReview.ts tests/lib/srs/leitner.test.ts tests/lib/db/ensureVocabularyProgress.test.ts tests/lib/db/recordVocabularyReview.test.ts
git commit -m "feat: add Leitner SRS algorithm and vocabulary_progress read/write helpers"
```

## Task 2: Fetch tiến độ hiện có + thêm hàm lấy thẻ đến hạn ("Ôn hôm nay")

**Files:**
- Create: `lib/db/getVocabularyProgressForLesson.ts`
- Create: `lib/db/getDueVocabularyCards.ts`
- Test: `tests/lib/db/getVocabularyProgressForLesson.test.ts`
- Test: `tests/lib/db/getDueVocabularyCards.test.ts`

**Interfaces:**
- Consumes: `Vocabulary`, `VocabularyProgress` types từ `lib/db/types.ts` (đã có).
- Produces:
  - `getVocabularyProgressForLesson(supabase: SupabaseClient, vocabularyIds: string[]): Promise<VocabularyProgress[]>` — dùng bởi Task 3 (trang vocabulary) sau khi `ensureVocabularyProgress` đã chạy, để lấy `box`/`learning_streak`/`id` hiện tại của từng thẻ.
  - `DueVocabularyCard { progress: VocabularyProgress; vocabulary: Vocabulary }` — type mới, export từ file này.
  - `getDueVocabularyCards(supabase: SupabaseClient): Promise<DueVocabularyCard[]>` — dùng bởi Task 4 ("Ôn hôm nay"). Truy vấn XUẤT PHÁT TỪ `vocabulary_progress` (lọc `due_at <= now()` trước, dùng index `(user_id, due_at)`), rồi PostgREST embed thêm `vocabulary(...)` tương ứng đúng các dòng đã lọc — khác về bản chất với việc quét toàn bộ bảng `vocabulary` rồi LEFT JOIN tìm dòng chưa có tiến độ (cách bị spec cấm ở mục 4/9.1). Không đảo chiều truy vấn (không bắt đầu từ `vocabulary`).

- [ ] **Step 1: Viết test cho `getVocabularyProgressForLesson`**

```typescript
// tests/lib/db/getVocabularyProgressForLesson.test.ts
import { describe, it, expect, vi } from 'vitest'
import { getVocabularyProgressForLesson } from '@/lib/db/getVocabularyProgressForLesson'

describe('getVocabularyProgressForLesson', () => {
  it('returns progress rows filtered by the given vocabulary ids', async () => {
    const mockRows = [
      {
        id: 'p1',
        user_id: 'u1',
        vocabulary_id: 'v1',
        box: 0,
        learning_streak: 0,
        due_at: '2026-08-02T00:00:00Z',
        last_reviewed_at: null,
        created_at: '2026-08-02T00:00:00Z',
      },
    ]
    const inFn = vi.fn().mockResolvedValue({ data: mockRows, error: null })
    const fakeClient = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({ in: inFn }),
      }),
    }

    const result = await getVocabularyProgressForLesson(fakeClient as never, ['v1'])

    expect(result).toEqual(mockRows)
    expect(inFn).toHaveBeenCalledWith('vocabulary_id', ['v1'])
  })

  it('returns empty array without querying when vocabularyIds is empty', async () => {
    const fakeClient = { from: vi.fn() }

    const result = await getVocabularyProgressForLesson(fakeClient as never, [])

    expect(result).toEqual([])
    expect(fakeClient.from).not.toHaveBeenCalled()
  })

  it('throws when Supabase returns an error', async () => {
    const inFn = vi.fn().mockResolvedValue({ data: null, error: { message: 'db error' } })
    const fakeClient = {
      from: vi.fn().mockReturnValue({ select: vi.fn().mockReturnValue({ in: inFn }) }),
    }

    await expect(getVocabularyProgressForLesson(fakeClient as never, ['v1'])).rejects.toThrow('db error')
  })
})
```

- [ ] **Step 2: Chạy test, xác nhận fail**

Run: `npm test -- getVocabularyProgressForLesson`
Expected: FAIL, module không tồn tại

- [ ] **Step 3: Viết `lib/db/getVocabularyProgressForLesson.ts`**

```typescript
// lib/db/getVocabularyProgressForLesson.ts
import type { SupabaseClient } from '@supabase/supabase-js'
import type { VocabularyProgress } from './types'

export async function getVocabularyProgressForLesson(
  supabase: SupabaseClient,
  vocabularyIds: string[]
): Promise<VocabularyProgress[]> {
  if (vocabularyIds.length === 0) return []

  const { data, error } = await supabase
    .from('vocabulary_progress')
    .select('id, user_id, vocabulary_id, box, learning_streak, due_at, last_reviewed_at, created_at')
    .in('vocabulary_id', vocabularyIds)

  if (error) throw new Error(error.message)
  return data as VocabularyProgress[]
}
```

- [ ] **Step 4: Chạy test, xác nhận pass**

Run: `npm test -- getVocabularyProgressForLesson`
Expected: PASS, 3 tests

- [ ] **Step 5: Viết test cho `getDueVocabularyCards`**

```typescript
// tests/lib/db/getDueVocabularyCards.test.ts
import { describe, it, expect, vi } from 'vitest'
import { getDueVocabularyCards } from '@/lib/db/getDueVocabularyCards'

describe('getDueVocabularyCards', () => {
  it('queries vocabulary_progress joined with vocabulary, filtered by due_at <= now, ordered by due_at', async () => {
    const mockRows = [
      {
        id: 'p1',
        user_id: 'u1',
        vocabulary_id: 'v1',
        box: 1,
        learning_streak: 3,
        due_at: '2026-08-01T00:00:00Z',
        last_reviewed_at: '2026-07-31T00:00:00Z',
        created_at: '2026-07-30T00:00:00Z',
        vocabulary: {
          id: 'v1',
          dialogue_id: 'd1',
          order: 1,
          word_zh: '你好',
          pinyin: 'nǐ hǎo',
          meaning_vi: 'xin chào',
          audio_url: null,
        },
      },
    ]
    const order = vi.fn().mockResolvedValue({ data: mockRows, error: null })
    const lte = vi.fn().mockReturnValue({ order })
    const fakeClient = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({ lte }),
      }),
    }

    const result = await getDueVocabularyCards(fakeClient as never)

    expect(result).toEqual([
      {
        progress: {
          id: 'p1',
          user_id: 'u1',
          vocabulary_id: 'v1',
          box: 1,
          learning_streak: 3,
          due_at: '2026-08-01T00:00:00Z',
          last_reviewed_at: '2026-07-31T00:00:00Z',
          created_at: '2026-07-30T00:00:00Z',
        },
        vocabulary: mockRows[0].vocabulary,
      },
    ])
    expect(lte).toHaveBeenCalledWith('due_at', expect.any(String))
    expect(order).toHaveBeenCalledWith('due_at', { ascending: true })
  })

  it('throws when Supabase returns an error', async () => {
    const order = vi.fn().mockResolvedValue({ data: null, error: { message: 'db error' } })
    const lte = vi.fn().mockReturnValue({ order })
    const fakeClient = { from: vi.fn().mockReturnValue({ select: vi.fn().mockReturnValue({ lte }) }) }

    await expect(getDueVocabularyCards(fakeClient as never)).rejects.toThrow('db error')
  })
})
```

- [ ] **Step 6: Chạy test, xác nhận fail**

Run: `npm test -- getDueVocabularyCards`
Expected: FAIL, module không tồn tại

- [ ] **Step 7: Viết `lib/db/getDueVocabularyCards.ts`**

RLS (`vocabulary_progress` chỉ đọc được dòng `user_id = auth.uid()`, migration 0001) đã tự lọc theo user — không cần `.eq('user_id', ...)` thủ công.

```typescript
// lib/db/getDueVocabularyCards.ts
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Vocabulary, VocabularyProgress } from './types'

export interface DueVocabularyCard {
  progress: VocabularyProgress
  vocabulary: Vocabulary
}

export async function getDueVocabularyCards(supabase: SupabaseClient): Promise<DueVocabularyCard[]> {
  const { data, error } = await supabase
    .from('vocabulary_progress')
    .select(
      'id, user_id, vocabulary_id, box, learning_streak, due_at, last_reviewed_at, created_at, vocabulary(id, dialogue_id, order, word_zh, pinyin, meaning_vi, audio_url)'
    )
    .lte('due_at', new Date().toISOString())
    .order('due_at', { ascending: true })

  if (error) throw new Error(error.message)

  return (
    data as unknown as (VocabularyProgress & { vocabulary: Vocabulary })[]
  ).map(({ vocabulary, ...progress }) => ({ progress, vocabulary }))
}
```

- [ ] **Step 8: Chạy test, xác nhận pass**

Run: `npm test -- getDueVocabularyCards`
Expected: PASS, 2 tests

- [ ] **Step 9: Chạy toàn bộ test suite + typecheck**

Run: `npm test`
Expected: PASS toàn bộ

- [ ] **Step 10: Commit**

```bash
git add lib/db/getVocabularyProgressForLesson.ts lib/db/getDueVocabularyCards.ts tests/lib/db/getVocabularyProgressForLesson.test.ts tests/lib/db/getDueVocabularyCards.test.ts
git commit -m "feat: add progress lookup for a lesson and due-cards query for Ôn hôm nay"
```

## Task 3: Flip-card component dùng chung (flip + Leitner + "Xem cách viết")

**Files:**
- Create: `components/FlashcardReviewer.tsx`
- Test: `tests/components/FlashcardReviewer.test.tsx`

**Interfaces:**
- Consumes:
  - `Vocabulary` type từ `lib/db/types.ts`.
  - `VocabularyProgress` type từ `lib/db/types.ts`.
  - `computeNextReview` từ `lib/srs/leitner.ts` (Task 1).
  - `recordVocabularyReview` từ `lib/db/recordVocabularyReview.ts` (Task 1).
  - `createBrowserSupabase` từ `lib/supabase/browser.ts` (đã có).
  - `HanziStrokeOrder` từ `components/HanziStrokeOrder.tsx` (đã có, không sửa).
- Produces: `FlashcardReviewer` — Client Component, props:
  ```typescript
  interface FlashcardReviewerProps {
    cards: { vocabulary: Vocabulary; progress: VocabularyProgress }[]
    onCardReviewed?: (vocabularyId: string) => void
  }
  ```
  Dùng bởi Task 4 (trang vocabulary của 1 lesson) và Task 5 (trang "Ôn hôm nay").

Component này là 1 bộ lật-thẻ tuần tự hoàn chỉnh: hiện `word_zh` mặt trước, bấm để lật thấy `pinyin`/`meaning_vi`/phát `audio_url`/nút "Xem cách viết" (mở `HanziStrokeOrder` cho từng ký tự trong `word_zh`, xếp ngang), rồi 2 nút Đúng/Sai — bấm xong tự lưu qua `recordVocabularyReview` và chuyển sang thẻ kế tiếp trong mảng `cards`. Hết mảng thì hiện màn hình "Đã ôn xong".

- [ ] **Step 1: Viết test hành vi cốt lõi (không test animation của HanziStrokeOrder — đã có sẵn, không thuộc phạm vi)**

```tsx
// tests/components/FlashcardReviewer.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import FlashcardReviewer from '@/components/FlashcardReviewer'

const updateEq = vi.fn().mockResolvedValue({ error: null })
const update = vi.fn().mockReturnValue({ eq: updateEq })
const fromMock = vi.fn().mockReturnValue({ update })

vi.mock('@/lib/supabase/browser', () => ({
  createBrowserSupabase: () => ({ from: fromMock }),
}))

vi.mock('@/components/HanziStrokeOrder', () => ({
  default: ({ character }: { character: string }) => <div data-testid="stroke-order">{character}</div>,
}))

const cards = [
  {
    vocabulary: {
      id: 'v1',
      dialogue_id: 'd1',
      order: 1,
      word_zh: '你好',
      pinyin: 'nǐ hǎo',
      meaning_vi: 'xin chào',
      audio_url: null,
    },
    progress: {
      id: 'p1',
      user_id: 'u1',
      vocabulary_id: 'v1',
      box: 0,
      learning_streak: 0,
      due_at: '2026-08-02T00:00:00Z',
      last_reviewed_at: null,
      created_at: '2026-08-02T00:00:00Z',
    },
  },
  {
    vocabulary: {
      id: 'v2',
      dialogue_id: 'd1',
      order: 2,
      word_zh: '謝謝',
      pinyin: 'xiè xiè',
      meaning_vi: 'cảm ơn',
      audio_url: null,
    },
    progress: {
      id: 'p2',
      user_id: 'u1',
      vocabulary_id: 'v2',
      box: 0,
      learning_streak: 0,
      due_at: '2026-08-02T00:00:00Z',
      last_reviewed_at: null,
      created_at: '2026-08-02T00:00:00Z',
    },
  },
]

beforeEach(() => {
  fromMock.mockClear()
  update.mockClear()
  updateEq.mockClear()
})

describe('FlashcardReviewer', () => {
  it('shows the front (word_zh) first, hides pinyin/meaning until flipped', () => {
    render(<FlashcardReviewer cards={cards} />)
    expect(screen.getByText('你好')).toBeInTheDocument()
    expect(screen.queryByText('nǐ hǎo')).not.toBeInTheDocument()
  })

  it('reveals pinyin/meaning and the "Xem cách viết" button after flipping', () => {
    render(<FlashcardReviewer cards={cards} />)
    fireEvent.click(screen.getByRole('button', { name: /lật thẻ/i }))
    expect(screen.getByText('nǐ hǎo')).toBeInTheDocument()
    expect(screen.getByText('xin chào')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /xem cách viết/i })).toBeInTheDocument()
  })

  it('opens per-character stroke order canvases when "Xem cách viết" is clicked', () => {
    render(<FlashcardReviewer cards={cards} />)
    fireEvent.click(screen.getByRole('button', { name: /lật thẻ/i }))
    fireEvent.click(screen.getByRole('button', { name: /xem cách viết/i }))
    const canvases = screen.getAllByTestId('stroke-order')
    expect(canvases).toHaveLength(2)
    expect(canvases[0]).toHaveTextContent('你')
    expect(canvases[1]).toHaveTextContent('好')
  })

  it('marking correct saves box=1, learning_streak=1 via recordVocabularyReview and advances to next card', async () => {
    render(<FlashcardReviewer cards={cards} />)
    fireEvent.click(screen.getByRole('button', { name: /lật thẻ/i }))
    fireEvent.click(screen.getByRole('button', { name: /^đúng$/i }))

    await waitFor(() => expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ box: 0, learning_streak: 1 })
    ))
    expect(updateEq).toHaveBeenCalledWith('id', 'p1')
    expect(screen.getByText('謝謝')).toBeInTheDocument()
  })

  it('marking wrong at box 0 resets learning_streak to 0 and advances to next card', async () => {
    render(<FlashcardReviewer cards={cards} />)
    fireEvent.click(screen.getByRole('button', { name: /lật thẻ/i }))
    fireEvent.click(screen.getByRole('button', { name: /^sai$/i }))

    await waitFor(() => expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ box: 0, learning_streak: 0 })
    ))
    expect(screen.getByText('謝謝')).toBeInTheDocument()
  })

  it('shows a completion message after the last card is reviewed', async () => {
    render(<FlashcardReviewer cards={[cards[0]]} />)
    fireEvent.click(screen.getByRole('button', { name: /lật thẻ/i }))
    fireEvent.click(screen.getByRole('button', { name: /^đúng$/i }))

    await waitFor(() => expect(screen.getByText(/đã ôn xong/i)).toBeInTheDocument())
  })
})
```

- [ ] **Step 2: Chạy test, xác nhận fail**

Run: `npm test -- FlashcardReviewer`
Expected: FAIL, module không tồn tại

- [ ] **Step 3: Viết `components/FlashcardReviewer.tsx`**

```tsx
// components/FlashcardReviewer.tsx
'use client'

import { useState } from 'react'
import { Volume2 } from 'lucide-react'
import type { Vocabulary, VocabularyProgress } from '@/lib/db/types'
import { computeNextReview } from '@/lib/srs/leitner'
import { recordVocabularyReview } from '@/lib/db/recordVocabularyReview'
import { createBrowserSupabase } from '@/lib/supabase/browser'
import HanziStrokeOrder from '@/components/HanziStrokeOrder'

interface FlashcardCard {
  vocabulary: Vocabulary
  progress: VocabularyProgress
}

interface FlashcardReviewerProps {
  cards: FlashcardCard[]
  onCardReviewed?: (vocabularyId: string) => void
}

export default function FlashcardReviewer({ cards, onCardReviewed }: FlashcardReviewerProps) {
  const [index, setIndex] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const [showStrokeOrder, setShowStrokeOrder] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  if (index >= cards.length) {
    return (
      <div className="rounded-card border border-card-border bg-white p-8 text-center shadow-sm">
        <p className="font-han-title text-xl font-bold text-ink">Đã ôn xong!</p>
        <p className="mt-1 text-sm font-medium text-ink-faint">Quay lại sau khi có thẻ mới đến hạn.</p>
      </div>
    )
  }

  const { vocabulary, progress } = cards[index]
  const characters = [...vocabulary.word_zh]

  function goToNext(vocabularyId: string) {
    setFlipped(false)
    setShowStrokeOrder(false)
    setSaveError(null)
    setIndex((i) => i + 1)
    onCardReviewed?.(vocabularyId)
  }

  async function handleAnswer(correct: boolean) {
    setSaving(true)
    setSaveError(null)
    const next = computeNextReview({ box: progress.box, learning_streak: progress.learning_streak }, correct)

    try {
      const supabase = createBrowserSupabase()
      await recordVocabularyReview(supabase, progress.id, next)
      goToNext(vocabulary.id)
    } catch {
      setSaveError('Không lưu được, kiểm tra kết nối mạng.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="rounded-card border border-card-border bg-white p-8 shadow-sm">
      <div className="flex flex-col items-center gap-4">
        <p className="font-han-title text-4xl font-bold text-ink">{vocabulary.word_zh}</p>

        {!flipped && (
          <button
            type="button"
            onClick={() => setFlipped(true)}
            className="rounded-btn bg-[#1e2a5e] px-6 py-2.5 font-semibold text-white shadow-sm transition-colors hover:bg-[#28377a]"
          >
            Lật thẻ
          </button>
        )}

        {flipped && (
          <>
            <div className="text-center">
              {vocabulary.pinyin && <p className="text-lg font-semibold text-ink-pinyin">{vocabulary.pinyin}</p>}
              {vocabulary.meaning_vi && <p className="mt-1 font-bold text-ink">{vocabulary.meaning_vi}</p>}
            </div>

            {vocabulary.audio_url && (
              <button
                type="button"
                onClick={() => new Audio(vocabulary.audio_url!).play()}
                aria-label="Phát âm thanh"
                className="flex h-10 w-10 items-center justify-center rounded-full bg-accent-bg text-brand-red transition-colors hover:bg-amber-100"
              >
                <Volume2 className="h-5 w-5" strokeWidth={2} />
              </button>
            )}

            {!showStrokeOrder && (
              <button
                type="button"
                onClick={() => setShowStrokeOrder(true)}
                className="text-sm font-semibold text-brand-red underline-offset-2 hover:underline"
              >
                Xem cách viết
              </button>
            )}

            {showStrokeOrder && (
              <div className="flex flex-wrap justify-center gap-3">
                {characters.map((char, i) => (
                  <HanziStrokeOrder key={`${char}-${i}`} character={char} size={140} />
                ))}
              </div>
            )}

            {saveError && <p className="text-sm font-semibold text-error-text">{saveError}</p>}

            <div className="flex gap-3">
              <button
                type="button"
                disabled={saving}
                onClick={() => handleAnswer(false)}
                className="rounded-btn border border-error-border bg-error-bg px-6 py-2.5 font-semibold text-error-text shadow-sm transition-colors hover:bg-red-100 disabled:opacity-50"
              >
                Sai
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => handleAnswer(true)}
                className="rounded-btn border border-success-border bg-success-bg px-6 py-2.5 font-semibold text-success-text shadow-sm transition-colors hover:bg-green-100 disabled:opacity-50"
              >
                Đúng
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Chạy test, xác nhận pass**

Run: `npm test -- FlashcardReviewer`
Expected: PASS, 7 tests

- [ ] **Step 5: Chạy toàn bộ test suite + typecheck**

Run: `npm test`
Expected: PASS toàn bộ

- [ ] **Step 6: Commit**

```bash
git add components/FlashcardReviewer.tsx tests/components/FlashcardReviewer.test.tsx
git commit -m "feat: add FlashcardReviewer component with Leitner review + Xem cách viết"
```

## Task 4: Tích hợp SRS vào trang "Từ mới" của 1 bài học

**Files:**
- Modify: `app/(protected)/books/[bookId]/lessons/[lessonId]/vocabulary/page.tsx`
- Modify: `app/(protected)/books/[bookId]/lessons/[lessonId]/vocabulary/VocabularyFlashcards.tsx`
- Test: `tests/app/vocabulary-page-integration.test.tsx` — SKIP: App Router Server Component pages không test được qua vitest/RTL một cách thực tế (cần Next.js runtime) — task này verify bằng test thủ công (Step cuối), giống cách Scope 1 verify `app/(protected)/home/page.tsx`.

**Interfaces:**
- Consumes:
  - `getLesson`, `getLessonVocabulary` từ `lib/db/*.ts` (đã có, không sửa).
  - `ensureVocabularyProgress` từ `lib/db/ensureVocabularyProgress.ts` (Task 1).
  - `getVocabularyProgressForLesson` từ `lib/db/getVocabularyProgressForLesson.ts` (Task 2).
  - `FlashcardReviewer` từ `components/FlashcardReviewer.tsx` (Task 3).
- Produces: trang `vocabulary/page.tsx` hoàn chỉnh — không có interface mới cho task khác dùng (trang lá, cuối luồng điều hướng).

Trang này hiện đang gọi `VocabularyFlashcards` (word-chip picker tĩnh). Giữ nguyên word-chip picker làm cách chọn thẻ để ôn tự do, nhưng thêm `ensureVocabularyProgress` khi vào trang (side-effect duy nhất là insert, theo đúng mục 4 spec "mở tab là insert") và tích hợp `FlashcardReviewer` làm chế độ ôn chính.

Quyết định UI: `VocabularyFlashcards` giữ nguyên chức năng "duyệt từ tự do" (chọn chip → xem `HanziStrokeOrder` ngay, không cần lật) hiện có — đây là cách xem tham khảo, không phải phiên ôn SRS. Thêm 1 nút "Bắt đầu ôn (Leitner)" trong trang mở `FlashcardReviewer` với TOÀN BỘ thẻ của bài (không lọc theo `due_at`, đúng spec mục 4: "tab này luôn hiển thị đúng các thẻ thuộc bài, không lọc theo hạn — có thể ôn lại bất kỳ lúc nào kể cả chưa đến hạn").

- [ ] **Step 1: Sửa `vocabulary/page.tsx` để gọi `ensureVocabularyProgress` và fetch tiến độ**

```tsx
// app/(protected)/books/[bookId]/lessons/[lessonId]/vocabulary/page.tsx
import { notFound } from 'next/navigation'
import { createServerSupabase } from '@/lib/supabase/server'
import { getLesson } from '@/lib/db/getLesson'
import { getLessonVocabulary } from '@/lib/db/getLessonVocabulary'
import { ensureVocabularyProgress } from '@/lib/db/ensureVocabularyProgress'
import { getVocabularyProgressForLesson } from '@/lib/db/getVocabularyProgressForLesson'
import BackButton from '@/components/BackButton'
import VocabularyFlashcards from './VocabularyFlashcards'

export default async function VocabularyPage({
  params,
}: {
  params: Promise<{ bookId: string; lessonId: string }>
}) {
  const { lessonId } = await params
  const supabase = await createServerSupabase()
  const [lesson, dialogueGroups] = await Promise.all([
    getLesson(supabase, lessonId),
    getLessonVocabulary(supabase, lessonId),
  ])

  if (!lesson) notFound()

  const words = dialogueGroups.flatMap((group) => group.words)
  const vocabularyIds = words.map((w) => w.id)

  await ensureVocabularyProgress(supabase, vocabularyIds)
  const progress = await getVocabularyProgressForLesson(supabase, vocabularyIds)

  return (
    <div className="mx-auto max-w-[660px] px-5 py-6">
      <BackButton />

      <div className="mb-5 rounded-card border border-card-border bg-white p-6 shadow-sm">
        <span className="mb-3 inline-flex items-center gap-1.5 rounded-pill border border-red-100 bg-red-50 px-3 py-1 text-xs font-bold uppercase tracking-wide text-brand-red">
          Bài {lesson.lesson_no}
        </span>
        <h1 className="font-han-title text-2xl font-bold text-ink">Từ vựng</h1>
      </div>

      {words.length === 0 ? (
        <p className="font-semibold text-ink-faint">Bài này chưa có từ vựng.</p>
      ) : (
        <VocabularyFlashcards words={words} progress={progress} />
      )}
    </div>
  )
}
```

- [ ] **Step 2: Sửa `VocabularyFlashcards.tsx` để thêm nút chuyển sang chế độ ôn SRS**

Giữ nguyên toàn bộ phần word-chip picker + xem-tự-do hiện có, chỉ thêm state chuyển chế độ và render `FlashcardReviewer` khi ở chế độ ôn.

```tsx
// app/(protected)/books/[bookId]/lessons/[lessonId]/vocabulary/VocabularyFlashcards.tsx
'use client'

import { useState } from 'react'
import { GraduationCap } from 'lucide-react'
import type { Vocabulary, VocabularyProgress } from '@/lib/db/types'
import HanziStrokeOrder from '@/components/HanziStrokeOrder'
import FlashcardReviewer from '@/components/FlashcardReviewer'

export default function VocabularyFlashcards({
  words,
  progress,
}: {
  words: Vocabulary[]
  progress: VocabularyProgress[]
}) {
  const [activeIndex, setActiveIndex] = useState(0)
  const [charIndex, setCharIndex] = useState(0)
  const [reviewing, setReviewing] = useState(false)

  const word = words[activeIndex]
  const characters = [...word.word_zh]
  const activeChar = characters[Math.min(charIndex, characters.length - 1)]

  function selectWord(index: number) {
    setActiveIndex(index)
    setCharIndex(0)
  }

  if (reviewing) {
    const progressByVocabId = new Map(progress.map((p) => [p.vocabulary_id, p]))
    const cards = words
      .filter((w) => progressByVocabId.has(w.id))
      .map((w) => ({ vocabulary: w, progress: progressByVocabId.get(w.id)! }))

    return (
      <div className="flex flex-col gap-4">
        <button
          type="button"
          onClick={() => setReviewing(false)}
          className="self-start text-sm font-semibold text-ink-faint hover:text-brand-red"
        >
          &larr; Quay lại danh sách từ
        </button>
        <FlashcardReviewer cards={cards} />
      </div>
    )
  }

  return (
    <div className="rounded-card border border-card-border bg-white p-6 shadow-sm">
      <div className="mb-6 flex items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {words.map((w, index) => (
            <button
              key={w.id}
              type="button"
              onClick={() => selectWord(index)}
              className={
                index === activeIndex
                  ? 'rounded-btn bg-[#1e2a5e] px-4 py-2 font-han-body text-lg font-semibold text-white shadow-sm'
                  : 'rounded-btn bg-accent-bg px-4 py-2 font-han-body text-lg font-semibold text-ink transition-colors hover:bg-amber-100'
              }
            >
              {w.word_zh}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setReviewing(true)}
          className="flex shrink-0 items-center gap-1.5 rounded-btn bg-brand-red px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-red-dark"
        >
          <GraduationCap className="h-4 w-4" strokeWidth={2.25} />
          Ôn từ vựng
        </button>
      </div>

      <div className="flex flex-col items-center gap-4">
        <HanziStrokeOrder key={activeChar} character={activeChar} />

        {characters.length > 1 && (
          <div className="flex gap-2">
            {characters.map((char, index) => (
              <button
                key={index}
                type="button"
                onClick={() => setCharIndex(index)}
                className={
                  index === charIndex
                    ? 'flex h-9 w-9 items-center justify-center rounded-full bg-brand-red font-han-body text-base font-semibold text-white'
                    : 'flex h-9 w-9 items-center justify-center rounded-full bg-accent-bg font-han-body text-base font-semibold text-ink-faint transition-colors hover:bg-amber-100'
                }
              >
                {char}
              </button>
            ))}
          </div>
        )}

        <div className="text-center">
          {word.pinyin && <p className="text-lg font-semibold text-ink-pinyin">{word.pinyin}</p>}
          {word.meaning_vi && <p className="mt-1 font-bold text-ink">{word.meaning_vi}</p>}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Chạy typecheck (không có unit test mới ở bước này — xác nhận không có lỗi type)**

Run: `npm run typecheck`
Expected: PASS, không lỗi

- [ ] **Step 4: Chạy toàn bộ test suite**

Run: `npm test`
Expected: PASS toàn bộ (không có test nào bị breaking do đổi props của `VocabularyFlashcards`, vì chưa có test cũ cho component này)

- [ ] **Step 5: Test thủ công (dev server)**

Run: `npm run dev`, mở `http://localhost:3000`, đăng nhập, vào 1 bài học đã publish có từ vựng → tab "Từ mới":
1. Xác nhận trang tải không lỗi console, word-chip picker + xem-tự-do vẫn hoạt động như trước.
2. Bấm "Ôn từ vựng" → xác nhận vào chế độ `FlashcardReviewer`, thấy `word_zh` mặt trước.
3. Bấm "Lật thẻ" → thấy `pinyin`/`meaning_vi`, bấm "Xem cách viết" → thấy canvas nét chữ đúng số ký tự.
4. Bấm "Đúng" 3 lần liên tiếp cho cùng 1 từ (quay lại "Ôn từ vựng" mỗi lần nếu cần) → xác nhận sau lần đúng thứ 3, không còn thấy từ đó (đã tốt nghiệp box 1, `due_at` = ngày mai nên không lặp lại trong phiên).
5. Kiểm tra trong Supabase Dashboard (Table Editor → `vocabulary_progress`) rằng `box`/`learning_streak`/`due_at` đã cập nhật đúng.

- [ ] **Step 6: Commit**

```bash
git add "app/(protected)/books/[bookId]/lessons/[lessonId]/vocabulary/page.tsx" "app/(protected)/books/[bookId]/lessons/[lessonId]/vocabulary/VocabularyFlashcards.tsx"
git commit -m "feat: integrate Leitner SRS review mode into the Từ mới tab"
```

## Task 5: "Ôn hôm nay" ở trang chủ

**Files:**
- Modify: `app/(protected)/home/page.tsx`
- Create: `app/(protected)/review/page.tsx`
- Create: `app/(protected)/review/ReviewSession.tsx`

**Interfaces:**
- Consumes:
  - `getDueVocabularyCards` từ `lib/db/getDueVocabularyCards.ts` (Task 2).
  - `FlashcardReviewer` từ `components/FlashcardReviewer.tsx` (Task 3).
- Produces: không có interface mới cho task khác — đây là task cuối của Scope 3.

`app/(protected)/home/page.tsx` thêm 1 khối ở đầu trang đếm số thẻ đến hạn (dùng `getDueVocabularyCards` — đếm `length`, chấp nhận query cả danh sách vì đã lọc theo index, không cần query đếm riêng). Bấm vào điều hướng tới `/review`, trang mới fetch lại danh sách thẻ đến hạn và render `FlashcardReviewer`.

- [ ] **Step 1: Sửa `app/(protected)/home/page.tsx` thêm khối "Ôn hôm nay"**

```tsx
// app/(protected)/home/page.tsx
import Link from 'next/link'
import { BookMarked, ChevronRight, Library, Sparkles } from 'lucide-react'
import { createServerSupabase } from '@/lib/supabase/server'
import { getPublishedBooks } from '@/lib/db/getPublishedBooks'
import { getDueVocabularyCards } from '@/lib/db/getDueVocabularyCards'

export default async function HomePage() {
  const supabase = await createServerSupabase()
  const [books, dueCards] = await Promise.all([
    getPublishedBooks(supabase),
    getDueVocabularyCards(supabase),
  ])

  return (
    <div className="mx-auto max-w-[660px] px-5 py-6">
      {dueCards.length > 0 && (
        <Link
          href="/review"
          className="group mb-5 flex items-center gap-4 rounded-card border border-brand-gold/40 bg-accent-bg px-6 py-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
        >
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-brand-red text-white">
            <Sparkles className="h-6 w-6" strokeWidth={2} />
          </span>
          <span className="flex-1">
            <span className="block font-han-title text-lg font-bold text-ink">Ôn hôm nay</span>
            <span className="text-sm font-semibold text-ink-faint">{dueCards.length} từ vựng đến hạn ôn</span>
          </span>
          <ChevronRight className="h-5 w-5 shrink-0 text-slate-400 transition-transform group-hover:translate-x-0.5" strokeWidth={2} />
        </Link>
      )}

      <div className="mb-5 rounded-card border border-card-border bg-white p-6 shadow-sm">
        <span className="mb-3 inline-flex items-center gap-1.5 rounded-pill border border-red-100 bg-red-50 px-3 py-1 text-xs font-bold uppercase tracking-wide text-brand-red">
          <Library className="h-3.5 w-3.5" strokeWidth={2.5} />
          TaiwaneseEasy
        </span>
        <h1 className="font-han-title text-2xl font-bold text-ink">Chọn quyển sách</h1>
      </div>

      <ul className="flex flex-col gap-3">
        {books.map((book) => (
          <li key={book.id}>
            <Link
              href={`/books/${book.id}`}
              className="group flex items-center gap-4 rounded-card-sm border border-card-border bg-white px-5 py-4 shadow-sm transition-all hover:-translate-y-0.5 hover:bg-amber-50/50 hover:shadow-md"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-50 text-brand-red">
                <BookMarked className="h-5 w-5" strokeWidth={2} />
              </span>
              <span className="flex-1">
                <span className="block font-bold text-ink">{book.title}</span>
                {book.volume && (
                  <span className="text-sm font-medium text-ink-faint">Quyển {book.volume}</span>
                )}
              </span>
              <ChevronRight className="h-5 w-5 shrink-0 text-slate-400 transition-transform group-hover:translate-x-0.5" strokeWidth={2} />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
```

- [ ] **Step 2: Tạo `app/(protected)/review/page.tsx`**

```tsx
// app/(protected)/review/page.tsx
import { createServerSupabase } from '@/lib/supabase/server'
import { getDueVocabularyCards } from '@/lib/db/getDueVocabularyCards'
import BackButton from '@/components/BackButton'
import ReviewSession from './ReviewSession'

export default async function ReviewPage() {
  const supabase = await createServerSupabase()
  const dueCards = await getDueVocabularyCards(supabase)

  return (
    <div className="mx-auto max-w-[660px] px-5 py-6">
      <BackButton />

      <div className="mb-5 rounded-card border border-card-border bg-white p-6 shadow-sm">
        <h1 className="font-han-title text-2xl font-bold text-ink">Ôn hôm nay</h1>
        <p className="text-sm font-medium text-ink-faint">{dueCards.length} từ vựng đến hạn ôn</p>
      </div>

      {dueCards.length === 0 ? (
        <p className="font-semibold text-ink-faint">Không có từ nào đến hạn ôn hôm nay.</p>
      ) : (
        <ReviewSession cards={dueCards} />
      )}
    </div>
  )
}
```

- [ ] **Step 3: Tạo `app/(protected)/review/ReviewSession.tsx`**

Wrapper mỏng quanh `FlashcardReviewer` — tách riêng vì `ReviewPage` là Server Component nhưng `FlashcardReviewer` cần `'use client'`.

```tsx
// app/(protected)/review/ReviewSession.tsx
'use client'

import type { DueVocabularyCard } from '@/lib/db/getDueVocabularyCards'
import FlashcardReviewer from '@/components/FlashcardReviewer'

export default function ReviewSession({ cards }: { cards: DueVocabularyCard[] }) {
  return <FlashcardReviewer cards={cards} />
}
```

- [ ] **Step 4: Chạy typecheck**

Run: `npm run typecheck`
Expected: PASS, không lỗi

- [ ] **Step 5: Chạy toàn bộ test suite**

Run: `npm test`
Expected: PASS toàn bộ

- [ ] **Step 6: Test thủ công (dev server)**

Với server đang chạy từ Task 4:
1. Ôn 1 vài từ ở tab "Từ mới" của 1 bài, cố tình để 1 từ SAI ở box ≥ 1 (ví dụ đã lên box 1 từ trước, giờ bấm "Sai") → xác nhận `due_at` set về "ngày mai" (không xuất hiện lại ngay ở "Ôn hôm nay").
2. Trực tiếp sửa `due_at` của 1-2 dòng `vocabulary_progress` trong Supabase Dashboard về quá khứ (ví dụ `now() - interval '1 day'`) để giả lập "đến hạn".
3. Reload trang chủ (`/`) → xác nhận khối "Ôn hôm nay" xuất hiện với đúng số lượng.
4. Bấm vào → xác nhận vào `/review`, thấy đúng các thẻ đã sửa `due_at`, ôn được bình thường (lật, xem cách viết, Đúng/Sai), sau khi ôn hết thấy "Đã ôn xong".
5. Reload lại trang chủ → xác nhận khối "Ôn hôm nay" biến mất (vì các thẻ vừa ôn đã có `due_at` mới trong tương lai) hoặc số lượng giảm đúng.

- [ ] **Step 7: Commit**

```bash
git add "app/(protected)/home/page.tsx" "app/(protected)/review/page.tsx" "app/(protected)/review/ReviewSession.tsx"
git commit -m "feat: add Ôn hôm nay review session on the home page"
```

---

**Sau khi Task 5 hoàn thành và review cuối cùng (whole-scope review) đạt yêu cầu: DỪNG LẠI.** Không tự động chuyển sang Scope 4. Người dùng sẽ tự mở app trên trình duyệt thật, ôn thử vài từ, kiểm tra Supabase Dashboard, và xác nhận trước khi cho phép viết plan Scope 4 (Quiz).
