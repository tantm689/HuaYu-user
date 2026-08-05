# Scope 7 (Ngữ pháp) — Design

## Mục tiêu

Bật tab "Ngữ pháp" (hiện `enabled: false` trên trang lesson) để học viên xem lại nội dung ngữ pháp của bài học — thuần tra cứu/ôn lại, không có tương tác luyện tập nào (Quiz đã đảm nhiệm phần kiểm tra).

## Nguồn dữ liệu

`lessons.grammar_markdown` (migration `0021_grammar_markdown.sql`, đã merge vào Admin repo's `main`) — một cột `text` duy nhất chứa toàn bộ nội dung ngữ pháp của bài học dưới dạng Markdown, do Admin CMS soạn (TipTap + `tiptap-markdown`). Không còn 4 bảng lồng nhau (`grammar_points`/`grammar_sub_points`/`grammar_sections`/`grammar_examples`) — các bảng đó đã bị drop trong cùng migration.

Cấu trúc nội dung: các điểm ngữ pháp phân tách bằng heading cấp 2 dạng `## Ngữ pháp N: <tiêu đề>`, có thể chứa bold, danh sách, và bảng (Markdown GFM). Không có audio đi kèm ví dụ ngữ pháp (`grammar_examples.audio_url` đã bị drop vĩnh viễn từ trước — xem `[[project_book_structure_scope]]`).

`getLesson()` (`lib/db/getLesson.ts`) hiện KHÔNG select cột `grammar_markdown` — cần thêm vào `.select()` và vào `Lesson` interface (`lib/db/types.ts`).

## Kiến trúc

Route mới: `app/(protected)/books/[bookId]/lessons/[lessonId]/grammar/page.tsx` — Server Component, theo đúng pattern của `vocabulary/page.tsx`:

1. Fetch `lesson` qua `getLesson()` (sau khi thêm `grammar_markdown` vào select).
2. Nếu `lesson.grammar_markdown` là `null`/rỗng: render trạng thái rỗng "Chưa có nội dung ngữ pháp" (cùng style với Từ vựng's "Bài này chưa có từ vựng.").
3. Ngược lại: gọi `splitGrammarMarkdown()` để tách thành từng section theo heading, render bằng `GrammarAccordion` (Client Component mới).

### `lib/grammarMarkdownSections.ts` (mới, port từ Admin repo)

Copy nguyên logic `splitGrammarMarkdown()` từ Admin repo's `lib/grammarMarkdownSections.ts` sang User repo — 2 repo không share code nên phải copy thủ công. Chỉ cần phần tách section (`splitGrammarMarkdown`), KHÔNG cần `joinGrammarMarkdown()` (chỉ Admin's editor cần ghép lại để lưu) — User App chỉ đọc.

```ts
export interface GrammarMarkdownSection {
  id: string
  title: string
  heading: string | null
  markdown: string
}

const HEADING_PATTERN = /^## Ngữ pháp \d+:?\s*(.*)$/

export function splitGrammarMarkdown(markdown: string): GrammarMarkdownSection[] {
  // ... giống hệt bản Admin
}
```

### `GrammarAccordion.tsx` (Client Component, mới)

Nhận `sections: GrammarMarkdownSection[]`, render mỗi section bằng 1 `<details>` (theo đúng pattern `GuideAccordionItem.tsx` đã có sẵn — dùng `<details>`/`<summary>` thuần HTML, KHÔNG cần thêm thư viện accordion mới). Section đầu tiên `defaultOpen`, các section sau đóng mặc định (khớp cách `GuideAccordionItem` đang dùng ở trang Guide).

Bên trong mỗi section, `section.markdown` được render qua `react-markdown` + `remark-gfm` (2 dependency mới, tương thích React 19/Next 16) — hỗ trợ đúng heading/bold/list/table mà không cần kéo theo TipTap (editor đầy đủ, quá nặng cho nhu cầu chỉ đọc). Style bằng `@tailwindcss/typography`'s `prose` class (Admin repo đã cài package này cho đúng mục đích tương tự). User repo dùng Tailwind v4 (`@import "tailwindcss"` trong `app/globals.css`, không có `tailwind.config.js`) — kích hoạt plugin bằng `@plugin "@tailwindcss/typography";` thêm vào `app/globals.css`, không phải cách khai báo `plugins: []` của v3.

### Trang lesson (`app/(protected)/books/[bookId]/lessons/[lessonId]/page.tsx`)

Đổi `enabled: false` → `enabled: true` cho mục `key: 'grammar'` trong mảng `modes`.

## Trường hợp rỗng

`grammar_markdown` null hoặc rỗng (dữ liệu cũ trước migration, hoặc admin chưa nhập): hiển thị dòng text "Bài này chưa có nội dung ngữ pháp." — cùng style với empty-state hiện có của tab Từ vựng, không có UI đặc biệt nào khác.

## Không nằm trong phạm vi

- Audio cho câu ví dụ ngữ pháp (không có dữ liệu, không sinh mới).
- Bất kỳ tương tác luyện tập nào trên nội dung ngữ pháp (không có flashcard/quiz riêng cho ngữ pháp — Quiz đã kiểm tra ngữ pháp qua `fill_blank`/`sentence_order`).
- Ẩn tab khi bài không có ngữ pháp — tab luôn hiện, chỉ nội dung bên trong đổi sang trạng thái rỗng.

## File chính sẽ động tới

- `app/(protected)/books/[bookId]/lessons/[lessonId]/grammar/page.tsx` (mới)
- `app/(protected)/books/[bookId]/lessons/[lessonId]/grammar/GrammarAccordion.tsx` (mới)
- `lib/grammarMarkdownSections.ts` (mới, port từ Admin repo)
- `lib/db/getLesson.ts` (thêm `grammar_markdown` vào select)
- `lib/db/types.ts` (thêm `grammar_markdown: string | null` vào `Lesson`)
- `app/(protected)/books/[bookId]/lessons/[lessonId]/page.tsx` (bật `enabled: true`)
- `package.json` (thêm `react-markdown`, `remark-gfm`, `@tailwindcss/typography`)

## Kiểm thử

- `splitGrammarMarkdown()`: unit test với markdown có 1/nhiều heading, markdown không có heading nào (toàn bộ thành 1 section không tên), markdown rỗng.
- `GrammarAccordion`: render đúng số section, section đầu mở mặc định, các section sau đóng, click mở/đóng đúng.
- Route `grammar/page.tsx`: render trạng thái rỗng khi `grammar_markdown` null, render đúng accordion khi có dữ liệu.
- Test thủ công: mở 1 bài học đã có `grammar_markdown` thật (import từ Admin), xác nhận heading/bold/bảng render đúng, xác nhận tab hiện `enabled` trên trang lesson.
