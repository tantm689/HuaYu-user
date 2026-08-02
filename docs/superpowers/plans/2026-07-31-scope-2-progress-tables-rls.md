# Scope 2: Migration bảng Progress + RLS Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **ĐIỂM DỪNG BẮT BUỘC:** Đây là 1 trong 6 scope độc lập của User App (xem `docs/superpowers/specs/2026-07-31-user-app-design.md`). Sau khi hoàn thành TOÀN BỘ plan này (mọi task DONE, final review sạch), DỪNG LẠI và báo cáo cho người dùng. Người dùng cần tự chạy migration SQL trên Supabase Dashboard thật (migration không tự động áp dụng) và xác nhận trước khi bắt đầu Scope 3 (Flashcard SRS). Không tự động chuyển sang viết/thực thi plan tiếp theo.

**Goal:** Tạo 3 bảng Postgres mới (`vocabulary_progress`, `quiz_attempts`, `typing_progress`) cho tiến độ cá nhân người dùng, kèm RLS đúng ngay từ đầu, và các TypeScript type tương ứng để Scope 3-5 dùng.

**Architecture:** 1 file migration SQL duy nhất (theo đúng convention `supabase/migrations/NNNN_description.sql` mà Admin repo dùng, nhưng đánh số riêng cho User repo vì đây là lịch sử migration độc lập dù chung Supabase project) chứa cả 3 bảng + RLS. Không viết code TypeScript đọc/ghi 3 bảng này trong scope này — chỉ định nghĩa type, để Scope 3-5 tự viết hàm truy vấn khi cần đúng ngữ cảnh nghiệp vụ của chúng.

**Tech Stack:** Postgres/Supabase SQL migration, TypeScript interface (không thêm dependency mới).

## Global Constraints

- Schema chính xác của 3 bảng (không được đoán/đổi khác) đã có sẵn trong `docs/superpowers/specs/2026-07-31-user-app-design.md` mục 9.1/9.2/9.3 — copy nguyên văn.
- Mọi bảng dùng `user_id uuid not null default auth.uid() references auth.users(id) on delete cascade` — client không cần tự truyền `user_id`.
- **RLS bắt buộc chỉ định đúng vai trò `authenticated`** (không phải `anon` — đây là dữ liệu cá nhân riêng tư, khác hẳn `books`/`lessons` công khai của Scope 1). Bài học từ Scope 1: quên chỉ định vai trò trong policy SQL gây bug thật phải vá sau — task này phải chỉ định `to authenticated` tường minh trong CHÍNH câu SQL đầu tiên, không để mặc định.
- Mỗi bảng phải bật `enable row level security` và có đủ 4 policy (select/insert/update/delete), mỗi policy giới hạn `user_id = auth.uid()` — cả điều kiện đọc (`using`) lẫn điều kiện ghi (`with check`) đều phải có, thiếu 1 trong 2 là lỗ hổng bảo mật (ví dụ thiếu `with check` trên `insert` cho phép user chèn `user_id` không phải của mình — dù cột có `default auth.uid()`, PostgREST vẫn cho phép client override giá trị default nếu không có `with check` chặn).
- KHÔNG viết logic nghiệp vụ (không viết SRS algorithm, không viết hàm insert/update cho 3 bảng này, không viết UI) — đó là việc của Scope 3 (Flashcard), Scope 4 (Quiz), Scope 5 (Gõ phản xạ). Scope 2 chỉ tạo schema + type.
- KHÔNG đụng vào bảng nội dung có sẵn (`books/lessons/dialogues/dialogue_lines/vocabulary/grammar_*/quiz_questions`) — chỉ tạo bảng mới.
- Migration file KHÔNG tự động chạy — người dùng tự copy nội dung vào Supabase Dashboard → SQL Editor để áp dụng, giống quy trình Admin repo vẫn dùng.

---

## File Structure

```
TaiwaneseEasy-user/
├── supabase/
│   └── migrations/
│       └── 0001_progress_tables.sql     # Task 1 — cả 3 bảng + RLS trong 1 file
├── lib/
│   └── db/
│       └── types.ts                     # Task 2 — modify: thêm 3 interface mới
└── tests/
    └── lib/
        └── db/
            └── types.test.ts            # Task 2 — test biên dịch/shape (xem chi tiết dưới)
```

**Trách nhiệm từng file:**
- `supabase/migrations/0001_progress_tables.sql` — nguồn sự thật duy nhất cho schema 3 bảng progress, độc lập với migration history của Admin repo (2 repo track schema riêng dù chung DB — đây là migration đầu tiên của User repo, không phải tiếp nối số `0020` của Admin).
- `lib/db/types.ts` — mở rộng file đã có (từ Scope 1: `Book`, `Lesson`, `LessonStatus`) thêm 3 interface mới khớp chính xác cột trong migration.

## Interfaces

**Produces (dùng bởi Scope 3-5 sau này):**
- SQL bảng `vocabulary_progress(id, user_id, vocabulary_id, box, learning_streak, due_at, last_reviewed_at, created_at)` — Scope 3 (Flashcard) viết hàm đọc/upsert bảng này.
- SQL bảng `quiz_attempts(id, user_id, lesson_id, part, score, total, created_at)` — Scope 4 (Quiz) viết hàm insert bảng này.
- SQL bảng `typing_progress(id, user_id, kind, target_id, is_correct, streak, last_attempted_at)` — Scope 5 (Gõ phản xạ) viết hàm upsert bảng này.
- `type VocabularyProgress`, `type QuizAttempt`, `type TypingProgress`, `type TypingKind` từ `lib/db/types.ts`.

---

### Task 1: Migration SQL — 3 bảng progress + RLS

**Files:**
- Create: `supabase/migrations/0001_progress_tables.sql`

**Interfaces:**
- Produces: 3 bảng Postgres (`vocabulary_progress`, `quiz_attempts`, `typing_progress`) với RLS đầy đủ, sẵn sàng để Scope 3-5 CRUD qua Supabase client (anon key + cookie session, giống pattern `createServerSupabase()`/`createBrowserSupabase()` đã có từ Scope 1).

- [ ] **Step 1: Viết migration file đầy đủ**

Nội dung chính xác — copy nguyên văn 3 bảng từ spec mục 9.1/9.2/9.3, thêm RLS đầy đủ với vai trò `authenticated` tường minh:

```sql
-- 0001_progress_tables.sql
-- Bảng tiến độ cá nhân người dùng cho User App (Flashcard SRS, Quiz, Gõ phản xạ).
-- Migration độc lập với lịch sử migration của TaiwaneseEasy-admin (dù chung Supabase
-- project) — không đụng tới các bảng nội dung có sẵn (books/lessons/dialogues/
-- dialogue_lines/vocabulary/grammar_*/quiz_questions).

-- ============================================================
-- 1. vocabulary_progress — SRS flashcard (Leitner, có trạng thái "Đang học")
-- ============================================================

create table vocabulary_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  vocabulary_id uuid not null references vocabulary(id) on delete cascade,
  box smallint not null default 0 check (box between 0 and 5),
  learning_streak smallint not null default 0,
  due_at timestamptz not null default now(),
  last_reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, vocabulary_id)
);

create index vocabulary_progress_due_idx
  on vocabulary_progress (user_id, due_at);

alter table vocabulary_progress enable row level security;

create policy "Users can read own vocabulary progress"
on vocabulary_progress for select
to authenticated
using (user_id = auth.uid());

create policy "Users can insert own vocabulary progress"
on vocabulary_progress for insert
to authenticated
with check (user_id = auth.uid());

create policy "Users can update own vocabulary progress"
on vocabulary_progress for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "Users can delete own vocabulary progress"
on vocabulary_progress for delete
to authenticated
using (user_id = auth.uid());

-- ============================================================
-- 2. quiz_attempts — lịch sử làm quiz (mỗi lần hoàn thành 1 part = 1 dòng)
-- ============================================================

create table quiz_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  lesson_id uuid not null references lessons(id) on delete cascade,
  part smallint not null check (part in (1, 2)),
  score smallint not null,
  total smallint not null,
  created_at timestamptz not null default now()
);

create index quiz_attempts_user_lesson_idx
  on quiz_attempts (user_id, lesson_id, part, created_at desc);

alter table quiz_attempts enable row level security;

create policy "Users can read own quiz attempts"
on quiz_attempts for select
to authenticated
using (user_id = auth.uid());

create policy "Users can insert own quiz attempts"
on quiz_attempts for insert
to authenticated
with check (user_id = auth.uid());

-- Không có policy update/delete: quiz_attempts là lịch sử bất biến theo thiết kế
-- (spec mục 7 — "không ghi đè, giữ lại toàn bộ lịch sử"). Không cấp quyền
-- update/delete nào cho client, kể cả trên dòng của chính mình.

-- ============================================================
-- 3. typing_progress — Gõ phản xạ, trạng thái mới nhất (upsert, KHÔNG phải log)
-- ============================================================

create table typing_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  kind text not null check (kind in ('vocabulary', 'dialogue_line')),
  target_id uuid not null,
  is_correct boolean not null default false,
  streak integer not null default 0,
  last_attempted_at timestamptz not null default now(),
  unique (user_id, kind, target_id)
);

create index typing_progress_user_kind_idx
  on typing_progress (user_id, kind);

alter table typing_progress enable row level security;

create policy "Users can read own typing progress"
on typing_progress for select
to authenticated
using (user_id = auth.uid());

create policy "Users can insert own typing progress"
on typing_progress for insert
to authenticated
with check (user_id = auth.uid());

create policy "Users can update own typing progress"
on typing_progress for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

-- Không có policy delete: mỗi lần gõ chỉ upsert (insert-or-update) đúng 1 dòng
-- theo unique (user_id, kind, target_id) — không có lý do nghiệp vụ nào cần xoá
-- dòng tiến độ gõ, để tránh mất lịch sử "đã từng luyện qua chưa" vô tình.
```

- [ ] **Step 2: Xác nhận SQL hợp lệ bằng cách đọc lại đối chiếu spec**

Đọc `docs/superpowers/specs/2026-07-31-user-app-design.md` dòng 130-194, đối chiếu từng cột/constraint/index trong file vừa viết — xác nhận khớp 100% (tên cột, kiểu dữ liệu, `check` constraint, `unique`, index). Không tự thêm/bớt cột nào ngoài spec.

- [ ] **Step 3: Verify cú pháp SQL bằng cách đọc kỹ, không có công cụ chạy SQL cục bộ**

Không có Postgres cục bộ để test migration này (Supabase là managed service, người dùng sẽ tự chạy trên Dashboard ở bước cuối). Đọc lại toàn bộ file 1 lần nữa, kiểm tra: mọi câu lệnh kết thúc bằng `;`, tên bảng/cột nhất quán giữa `create table` và các câu `create policy` phía sau, không có dấu ngoặc thiếu cặp.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/0001_progress_tables.sql
git commit -m "feat: add progress tables migration (vocabulary_progress, quiz_attempts, typing_progress)"
```

---

### Task 2: TypeScript types cho 3 bảng progress

**Files:**
- Modify: `lib/db/types.ts`
- Test: `tests/lib/db/types.test.ts`

**Interfaces:**
- Consumes: không phụ thuộc gì từ Task 1 (TypeScript type không cần DB thật tồn tại) — nhưng PHẢI khớp chính xác tên cột đã viết trong `0001_progress_tables.sql` ở Task 1.
- Produces: `type VocabularyProgress`, `type QuizAttempt`, `type TypingProgress`, `type TypingKind` — Scope 3-5 import trực tiếp từ `lib/db/types.ts`.

- [ ] **Step 1: Viết test xác nhận shape đúng (compile-time type check qua runtime object)**

Vì đây là type-only file (không có logic runtime để unit-test theo nghĩa thông thường), test ở đây xác nhận: (a) các type export đúng tên, đúng field, thông qua việc gán 1 object literal hợp lệ vào biến có type đó — nếu field sai tên/kiểu, TypeScript sẽ báo lỗi compile, `tsc --noEmit` sẽ fail thay vì vitest fail. Viết 1 file test nhỏ dùng chính cơ chế đó:

```ts
// tests/lib/db/types.test.ts
import { describe, it, expect } from 'vitest'
import type { VocabularyProgress, QuizAttempt, TypingProgress, TypingKind } from '@/lib/db/types'

describe('progress table types', () => {
  it('VocabularyProgress accepts the exact migration column shape', () => {
    const row: VocabularyProgress = {
      id: 'a',
      user_id: 'u',
      vocabulary_id: 'v',
      box: 0,
      learning_streak: 0,
      due_at: '2026-01-01T00:00:00Z',
      last_reviewed_at: null,
      created_at: '2026-01-01T00:00:00Z',
    }
    expect(row.box).toBe(0)
  })

  it('QuizAttempt accepts the exact migration column shape', () => {
    const row: QuizAttempt = {
      id: 'a',
      user_id: 'u',
      lesson_id: 'l',
      part: 1,
      score: 10,
      total: 15,
      created_at: '2026-01-01T00:00:00Z',
    }
    expect(row.part).toBe(1)
  })

  it('TypingProgress accepts the exact migration column shape', () => {
    const kind: TypingKind = 'vocabulary'
    const row: TypingProgress = {
      id: 'a',
      user_id: 'u',
      kind,
      target_id: 't',
      is_correct: true,
      streak: 3,
      last_attempted_at: '2026-01-01T00:00:00Z',
    }
    expect(row.streak).toBe(3)
  })
})
```

- [ ] **Step 2: Chạy test, xác nhận fail vì type chưa tồn tại**

Run: `npx vitest run tests/lib/db/types.test.ts`
Expected: FAIL — TypeScript compile error hoặc "has no exported member 'VocabularyProgress'" (tuỳ cách vitest báo lỗi type).

- [ ] **Step 3: Thêm 3 interface + 1 type union vào `lib/db/types.ts`**

Đọc file hiện tại trước (đã có `LessonStatus`, `Book`, `Lesson` từ Scope 1), rồi append vào cuối file:

```ts
export type TypingKind = 'vocabulary' | 'dialogue_line'

export interface VocabularyProgress {
  id: string
  user_id: string
  vocabulary_id: string
  box: number
  learning_streak: number
  due_at: string
  last_reviewed_at: string | null
  created_at: string
}

export interface QuizAttempt {
  id: string
  user_id: string
  lesson_id: string
  part: 1 | 2
  score: number
  total: number
  created_at: string
}

export interface TypingProgress {
  id: string
  user_id: string
  kind: TypingKind
  target_id: string
  is_correct: boolean
  streak: number
  last_attempted_at: string
}
```

- [ ] **Step 4: Chạy test lại, xác nhận pass**

Run: `npx vitest run tests/lib/db/types.test.ts`
Expected: PASS (3/3)

- [ ] **Step 5: Verify TypeScript biên dịch sạch toàn repo**

Run: `npx tsc --noEmit`
Expected: không lỗi.

- [ ] **Step 6: Commit**

```bash
git add lib/db/types.ts tests/lib/db/types.test.ts
git commit -m "feat: add VocabularyProgress/QuizAttempt/TypingProgress types"
```

---

## Kiểm thử tổng hợp trước khi báo cáo hoàn thành Scope 2

- [ ] `npx tsc --noEmit` — sạch, không lỗi.
- [ ] `npx vitest run` — toàn bộ test pass (bao gồm cả test từ Scope 1).
- [ ] `npx eslint .` — 0 lỗi, 0 warning (đã fix `.claude/**`/`docs/**` ignore ở Scope 1, phải vẫn sạch).
- [ ] `npm run build` — build production thành công.
- [ ] Đọc lại `supabase/migrations/0001_progress_tables.sql` lần cuối, đối chiếu spec mục 9 từng dòng.

**Sau khi tất cả mục trên đạt: DỪNG LẠI.** Báo cáo người dùng: (1) nội dung/đường dẫn migration file để họ tự copy vào Supabase Dashboard → SQL Editor → Run; (2) nhắc rằng khác với Scope 1 (đã bị thiếu vai trò `authenticated` phải vá sau), migration này đã chỉ định `to authenticated` tường minh ngay từ đầu cho cả 3 bảng, nên không cần vá RLS sau khi chạy; (3) gợi ý người dùng tự kiểm tra nhanh sau khi chạy migration bằng cách vào Supabase Dashboard → Table Editor, xác nhận 3 bảng mới xuất hiện và có RLS bật (icon khóa). Không bắt đầu Scope 3 cho tới khi người dùng xác nhận.
