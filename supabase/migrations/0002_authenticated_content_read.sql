-- 0002_authenticated_content_read.sql
-- Mở rộng RLS role trên 7 bảng nội dung để cho phép cả role `authenticated`
-- đọc, không chỉ `anon`. Đây là fix cho 1 khoảng trống RLS phát hiện được khi
-- review Scope 2: policy gốc của các bảng này (viết từ trước, không thuộc
-- migration nào track trong TaiwaneseEasy-user) chỉ chỉ định `to anon`, khiến
-- người dùng ĐÃ đăng nhập (JWT có role `authenticated`, không phải `anon`)
-- không đọc được — cùng loại bug đã gặp và tự vá tay (không ghi migration)
-- cho bảng `books`/`lessons` trước đó.
--
-- Postgres không có "ALTER POLICY ... TO ..." để thêm role vào policy đã tồn
-- tại — phải drop rồi tạo lại. Điều kiện `using (...)` dưới đây được copy
-- NGUYÊN VĂN từ `qual` thật của từng policy gốc (lấy qua
-- `select tablename, policyname, qual from pg_policies where ...` trên
-- Supabase Dashboard), chỉ mở rộng `to anon` thành `to anon, authenticated` —
-- không đổi logic lọc.

-- ============================================================
-- vocabulary
-- ============================================================

drop policy "anon can read vocabulary of published lessons" on vocabulary;

create policy "anon can read vocabulary of published lessons"
on vocabulary for select
to anon, authenticated
using (
  exists (
    select 1
    from dialogues
    join lessons on lessons.id = dialogues.lesson_id
    where dialogues.id = vocabulary.dialogue_id
      and lessons.status = 'published'
  )
);

-- ============================================================
-- dialogues
-- ============================================================

drop policy "anon can read dialogues of published lessons" on dialogues;

create policy "anon can read dialogues of published lessons"
on dialogues for select
to anon, authenticated
using (
  exists (
    select 1
    from lessons
    where lessons.id = dialogues.lesson_id
      and lessons.status = 'published'
  )
);

-- ============================================================
-- dialogue_lines
-- ============================================================

drop policy "anon can read dialogue lines of published lessons" on dialogue_lines;

create policy "anon can read dialogue lines of published lessons"
on dialogue_lines for select
to anon, authenticated
using (
  exists (
    select 1
    from dialogues
    join lessons on lessons.id = dialogues.lesson_id
    where dialogues.id = dialogue_lines.dialogue_id
      and lessons.status = 'published'
  )
);

-- ============================================================
-- grammar_points
-- ============================================================

drop policy "anon can read grammar points of published lessons" on grammar_points;

create policy "anon can read grammar points of published lessons"
on grammar_points for select
to anon, authenticated
using (
  exists (
    select 1
    from lessons
    where lessons.id = grammar_points.lesson_id
      and lessons.status = 'published'
  )
);

-- ============================================================
-- grammar_sections
-- ============================================================
-- Dùng hàm sẵn có grammar_section_lesson_id(section_id) để tra lesson_id
-- tương ứng — giữ nguyên cách gọi hàm này y hệt policy gốc, không tự suy
-- diễn lại logic join qua grammar_points/grammar_sub_points.

drop policy "anon can read grammar sections of published lessons" on grammar_sections;

create policy "anon can read grammar sections of published lessons"
on grammar_sections for select
to anon, authenticated
using (
  exists (
    select 1
    from lessons
    where lessons.id = grammar_section_lesson_id(grammar_sections.id)
      and lessons.status = 'published'
  )
);

-- ============================================================
-- grammar_examples
-- ============================================================
-- Cũng dùng grammar_section_lesson_id(...), nhưng truyền
-- grammar_examples.grammar_section_id (không phải id của chính bảng này) —
-- giữ nguyên đúng như policy gốc.

drop policy "anon can read grammar examples of published lessons" on grammar_examples;

create policy "anon can read grammar examples of published lessons"
on grammar_examples for select
to anon, authenticated
using (
  exists (
    select 1
    from lessons
    where lessons.id = grammar_section_lesson_id(grammar_examples.grammar_section_id)
      and lessons.status = 'published'
  )
);

-- ============================================================
-- quiz_questions
-- ============================================================

drop policy "anon can read quiz questions of published lessons" on quiz_questions;

create policy "anon can read quiz questions of published lessons"
on quiz_questions for select
to anon, authenticated
using (
  exists (
    select 1
    from lessons
    where lessons.id = quiz_questions.lesson_id
      and lessons.status = 'published'
  )
);
