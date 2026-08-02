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
