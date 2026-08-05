# Scope 7 (Ngữ pháp) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bật tab "Ngữ pháp" trên trang lesson của User App (HuaYu), hiển thị nội dung `lessons.grammar_markdown` (Markdown giàu định dạng, soạn sẵn bởi Admin CMS) dưới dạng accordion — một mục thu gọn/mở rộng cho mỗi điểm ngữ pháp.

**Architecture:** Route Server Component mới fetch `grammar_markdown` qua `getLesson()` (cần mở rộng select), tách chuỗi Markdown thành từng section bằng một hàm `splitGrammarMarkdown()` port nguyên văn từ Admin repo (2 repo không share code), rồi giao cho một Client Component render mỗi section bằng `<details>`/`<summary>` thuần HTML (đúng pattern `GuideAccordionItem.tsx` đã có) với nội dung Markdown render qua `react-markdown` + `remark-gfm`, style bằng `@tailwindcss/typography`'s `prose` class.

**Tech Stack:** Next.js 16 App Router, React 19, Supabase JS client, Tailwind v4, `react-markdown` + `remark-gfm` (mới), `@tailwindcss/typography` (mới), Vitest + Testing Library.

## Global Constraints

- Không audio cho ví dụ ngữ pháp — không có dữ liệu, không sinh mới.
- Không tương tác luyện tập nào trên nội dung ngữ pháp — tab thuần đọc/tra cứu.
- Tab luôn hiển thị (không ẩn khi bài chưa có ngữ pháp) — nội dung bên trong đổi sang trạng thái rỗng thay vì ẩn cả mục.
- Trạng thái rỗng dùng đúng style hiện có: `<p className="font-semibold text-ink-faint">...</p>`, văn bản "Bài này chưa có nội dung ngữ pháp."
- Section đầu tiên trong accordion mặc định mở (`defaultOpen`), các section sau đóng mặc định — khớp cách `GuideAccordionItem` đang dùng ở trang Guide.
- Tailwind v4 dùng cú pháp `@import "tailwindcss"` trong `app/globals.css` (không có `tailwind.config.js`) — kích hoạt `@tailwindcss/typography` bằng dòng `@plugin "@tailwindcss/typography";`, KHÔNG phải cách khai báo `plugins: []` của Tailwind v3.
- `HEADING_PATTERN` phải giữ nguyên y hệt bản Admin: `/^## Ngữ pháp \d+:?\s*(.*)$/` — đây là format thật Gemini sinh ra, đổi regex sẽ làm sai lệch với dữ liệu thật.

---

### Task 1: Port `splitGrammarMarkdown()` vào User repo

**Files:**
- Create: `lib/grammarMarkdownSections.ts`
- Test: `tests/lib/grammarMarkdownSections.test.ts`

**Interfaces:**
- Produces: `export interface GrammarMarkdownSection { id: string; title: string; heading: string | null; markdown: string }`, `export function splitGrammarMarkdown(markdown: string): GrammarMarkdownSection[]`

- [ ] **Step 1: Viết file test (port nguyên văn từ Admin repo, bỏ phần `joinGrammarMarkdown` vì User App chỉ đọc)**

```ts
import { describe, it, expect } from 'vitest'
import { splitGrammarMarkdown } from '@/lib/grammarMarkdownSections'

describe('splitGrammarMarkdown', () => {
  it('splits into one section per "## Ngữ pháp N" heading', () => {
    const markdown = [
      '## Ngữ pháp 1: Cách đặt câu hỏi',
      '',
      '**CHỨC NĂNG**',
      '',
      'Giải thích 1.',
      '',
      '## Ngữ pháp 2: Trợ từ 嗎',
      '',
      '**CHỨC NĂNG**',
      '',
      'Giải thích 2.',
    ].join('\n')

    const sections = splitGrammarMarkdown(markdown)
    expect(sections).toHaveLength(2)
    expect(sections[0].title).toBe('Cách đặt câu hỏi')
    expect(sections[0].markdown).toContain('Giải thích 1.')
    expect(sections[0].markdown).not.toContain('Giải thích 2.')
    expect(sections[1].title).toBe('Trợ từ 嗎')
    expect(sections[1].markdown).toContain('Giải thích 2.')
  })

  it('strips the "## Ngữ pháp N" heading line out of markdown, keeping it only in the separate heading field', () => {
    const markdown = '## Ngữ pháp 1: Cách đặt câu hỏi\n\n**CHỨC NĂNG**\n\nGiải thích.'
    const sections = splitGrammarMarkdown(markdown)
    expect(sections).toHaveLength(1)
    expect(sections[0].heading).toBe('## Ngữ pháp 1: Cách đặt câu hỏi')
    expect(sections[0].markdown).not.toContain('## Ngữ pháp')
    expect(sections[0].markdown).toBe('**CHỨC NĂNG**\n\nGiải thích.')
  })

  it('leaves heading null for the unlabeled leading section', () => {
    const markdown = 'Ghi chú chung.\n\n## Ngữ pháp 1: Test\n\nNội dung.'
    const sections = splitGrammarMarkdown(markdown)
    expect(sections[0].heading).toBeNull()
    expect(sections[1].heading).toBe('## Ngữ pháp 1: Test')
  })

  it('keeps content before the first heading as a single unlabeled leading section', () => {
    const markdown = 'Ghi chú chung.\n\n## Ngữ pháp 1: Test\n\nNội dung.'
    const sections = splitGrammarMarkdown(markdown)
    expect(sections).toHaveLength(2)
    expect(sections[0].title).toBe('')
    expect(sections[0].markdown).toBe('Ghi chú chung.')
    expect(sections[1].title).toBe('Test')
  })

  it('returns a single leading section for markdown with no grammar headings at all', () => {
    const markdown = 'Chỉ có một đoạn văn, không có heading.'
    const sections = splitGrammarMarkdown(markdown)
    expect(sections).toHaveLength(1)
    expect(sections[0].title).toBe('')
    expect(sections[0].markdown).toBe(markdown)
  })

  it('returns an empty array for empty markdown', () => {
    expect(splitGrammarMarkdown('')).toEqual([])
  })

  it('keeps H3 sub-point headings and their content nested inside the parent section, not split out', () => {
    const markdown = [
      '## Ngữ pháp 1: Test',
      '',
      '### A. Đề mục con',
      '',
      'Nội dung A.',
      '',
      '### B. Đề mục con khác',
      '',
      'Nội dung B.',
    ].join('\n')
    const sections = splitGrammarMarkdown(markdown)
    expect(sections).toHaveLength(1)
    expect(sections[0].markdown).toContain('### A. Đề mục con')
    expect(sections[0].markdown).toContain('### B. Đề mục con khác')
  })

  it('assigns unique ids to each section', () => {
    const markdown = '## Ngữ pháp 1: A\n\nX\n\n## Ngữ pháp 2: B\n\nY'
    const sections = splitGrammarMarkdown(markdown)
    const ids = sections.map((s) => s.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})
```

- [ ] **Step 2: Chạy test, xác nhận thất bại vì file nguồn chưa tồn tại**

Run: `npx vitest run grammarMarkdownSections`
Expected: FAIL với lỗi không tìm thấy module `@/lib/grammarMarkdownSections`

- [ ] **Step 3: Tạo file nguồn (port nguyên văn từ Admin repo, bỏ `joinGrammarMarkdown` — User App không cần ghi lại)**

```ts
// Splits a single grammarMarkdown string into per-grammar-point sections at
// "## Ngữ pháp N" boundaries (level-2 heading, per the Admin CMS's extraction
// prompt heading scheme), so this tab can render one collapsible accordion
// item per grammar point instead of one long unbroken document. Content
// before the first such heading (if any - legacy data extracted before this
// migration, or a lesson with no grammar points yet) is kept as a single
// unlabeled leading section.
//
// The heading line itself is pulled out into `heading` rather than left in
// `markdown`: the accordion trigger already displays `title`, so leaving the
// "## Ngữ pháp N: ..." heading in the rendered content would show the same
// text again immediately inside the section, as a large duplicate H2.
// `heading` is null for the unlabeled leading section, which has no
// corresponding heading line to remove.
export interface GrammarMarkdownSection {
  id: string
  title: string
  heading: string | null
  markdown: string
}

const HEADING_PATTERN = /^## Ngữ pháp \d+:?\s*(.*)$/

export function splitGrammarMarkdown(markdown: string): GrammarMarkdownSection[] {
  const lines = markdown.split('\n')
  const sections: GrammarMarkdownSection[] = []
  let current: { heading: string; title: string; lines: string[] } | null = null
  let leading: string[] = []
  let index = 0

  const flush = () => {
    if (current) {
      sections.push({
        id: `section-${index++}`,
        title: current.title,
        heading: current.heading,
        markdown: current.lines.join('\n').trim(),
      })
      current = null
    }
  }

  for (const line of lines) {
    const match = HEADING_PATTERN.exec(line)
    if (match) {
      flush()
      current = { heading: line, title: match[1] || line.replace(/^##\s*/, ''), lines: [] }
    } else if (current) {
      current.lines.push(line)
    } else {
      leading.push(line)
    }
  }
  flush()

  const leadingText = leading.join('\n').trim()
  if (leadingText) {
    sections.unshift({ id: 'section-leading', title: '', heading: null, markdown: leadingText })
  }

  return sections
}
```

- [ ] **Step 4: Chạy test, xác nhận pass**

Run: `npx vitest run grammarMarkdownSections`
Expected: PASS (8 test)

- [ ] **Step 5: Commit**

```bash
git add lib/grammarMarkdownSections.ts tests/lib/grammarMarkdownSections.test.ts
git commit -m "feat: port splitGrammarMarkdown from the Admin repo"
```

---

### Task 2: Mở rộng `getLesson()` để trả về `grammar_markdown`

**Files:**
- Modify: `lib/db/types.ts`
- Modify: `lib/db/getLesson.ts`
- Create: `tests/lib/db/getLesson.test.ts`

**Interfaces:**
- Consumes: không có (chỉnh sửa hàm/kiểu đã tồn tại)
- Produces: `Lesson` interface có thêm field `grammar_markdown: string | null`; `getLesson()` trả về field đó trong kết quả select.

- [ ] **Step 1: Viết test cho `getLesson()` (mock Supabase client, xác nhận select bao gồm `grammar_markdown` và trả đúng giá trị)**

```ts
import { describe, it, expect, vi } from 'vitest'
import { getLesson } from '@/lib/db/getLesson'

describe('getLesson', () => {
  it('selects grammar_markdown along with the existing lesson fields', async () => {
    const mockLesson = {
      id: 'l1',
      book_id: 'b1',
      lesson_no: 1,
      title_zh: '你好',
      title_vi: 'Xin chào',
      theme: null,
      status: 'published',
      created_at: '2026-08-02T00:00:00Z',
      grammar_markdown: '## Ngữ pháp 1: Test\n\nNội dung.',
    }
    const maybeSingle = vi.fn().mockResolvedValue({ data: mockLesson, error: null })
    const eqStatus = vi.fn().mockReturnValue({ maybeSingle })
    const eqId = vi.fn().mockReturnValue({ eq: eqStatus })
    const select = vi.fn().mockReturnValue({ eq: eqId })
    const fakeClient = { from: vi.fn().mockReturnValue({ select }) }

    const result = await getLesson(fakeClient as never, 'l1')

    expect(result).toEqual(mockLesson)
    expect(select).toHaveBeenCalledWith(
      expect.stringContaining('grammar_markdown')
    )
  })

  it('returns null when no matching published lesson exists', async () => {
    const maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null })
    const eqStatus = vi.fn().mockReturnValue({ maybeSingle })
    const eqId = vi.fn().mockReturnValue({ eq: eqStatus })
    const select = vi.fn().mockReturnValue({ eq: eqId })
    const fakeClient = { from: vi.fn().mockReturnValue({ select }) }

    const result = await getLesson(fakeClient as never, 'missing')

    expect(result).toBeNull()
  })

  it('throws when Supabase returns an error', async () => {
    const maybeSingle = vi.fn().mockResolvedValue({ data: null, error: { message: 'db error' } })
    const eqStatus = vi.fn().mockReturnValue({ maybeSingle })
    const eqId = vi.fn().mockReturnValue({ eq: eqStatus })
    const select = vi.fn().mockReturnValue({ eq: eqId })
    const fakeClient = { from: vi.fn().mockReturnValue({ select }) }

    await expect(getLesson(fakeClient as never, 'l1')).rejects.toThrow('db error')
  })
})
```

- [ ] **Step 2: Chạy test, xác nhận thất bại (select hiện tại chưa có `grammar_markdown`)**

Run: `npx vitest run tests/lib/db/getLesson.test.ts`
Expected: FAIL ở assertion `expect(select).toHaveBeenCalledWith(expect.stringContaining('grammar_markdown'))`

- [ ] **Step 3: Thêm `grammar_markdown` vào `Lesson` interface**

Trong `lib/db/types.ts`, sửa:

```ts
export interface Lesson {
  id: string
  book_id: string
  lesson_no: number
  title_zh: string
  title_vi: string
  theme: string | null
  status: LessonStatus
  created_at: string
  grammar_markdown: string | null
}
```

- [ ] **Step 4: Thêm `grammar_markdown` vào select của `getLesson()`**

Trong `lib/db/getLesson.ts`, sửa dòng `.select(...)`:

```ts
export async function getLesson(supabase: SupabaseClient, lessonId: string): Promise<Lesson | null> {
  const { data, error } = await supabase
    .from('lessons')
    .select('id, book_id, lesson_no, title_zh, title_vi, theme, status, created_at, grammar_markdown')
    .eq('id', lessonId)
    .eq('status', 'published')
    .maybeSingle()

  if (error) throw new Error(error.message)
  return data as Lesson | null
}
```

- [ ] **Step 5: Chạy test, xác nhận pass**

Run: `npx vitest run tests/lib/db/getLesson.test.ts`
Expected: PASS (3 test)

- [ ] **Step 6: Chạy typecheck để xác nhận không có nơi nào khác dùng `Lesson` bị vỡ do field mới bắt buộc**

Run: `npm run typecheck`
Expected: PASS (mọi nơi tạo `Lesson` thủ công trong test khác cũng cần có `grammar_markdown` — nếu FAIL, sửa các fixture đó thêm field `grammar_markdown: null`)

- [ ] **Step 7: Commit**

```bash
git add lib/db/types.ts lib/db/getLesson.ts tests/lib/db/getLesson.test.ts
git commit -m "feat: add grammar_markdown to getLesson's select and Lesson type"
```

---

### Task 3: Cài đặt `react-markdown`, `remark-gfm`, `@tailwindcss/typography`

**Files:**
- Modify: `package.json`
- Modify: `app/globals.css`

**Interfaces:**
- Consumes: không có
- Produces: package `react-markdown` (component `Markdown` từ `react-markdown`), package `remark-gfm` (plugin `remarkGfm`), Tailwind class `prose`/`prose-sm` khả dụng toàn cục.

- [ ] **Step 1: Cài package**

```bash
npm install react-markdown remark-gfm
npm install -D @tailwindcss/typography
```

- [ ] **Step 2: Kích hoạt plugin typography trong `app/globals.css`**

Thêm dòng `@plugin` ngay sau dòng `@import "tailwindcss";` ở đầu file:

```css
@import "tailwindcss";
@plugin "@tailwindcss/typography";

@theme {
```

- [ ] **Step 3: Xác nhận build không lỗi (typography plugin đúng cú pháp Tailwind v4)**

Run: `npm run build`
Expected: build thành công, không có lỗi CSS/PostCSS liên quan đến `@plugin`

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json app/globals.css
git commit -m "feat: install react-markdown, remark-gfm, @tailwindcss/typography"
```

---

### Task 4: `GrammarAccordion` component

**Files:**
- Create: `app/(protected)/books/[bookId]/lessons/[lessonId]/grammar/GrammarAccordion.tsx`
- Test: `tests/components/grammar/GrammarAccordion.test.tsx`

**Interfaces:**
- Consumes: `GrammarMarkdownSection` từ `lib/grammarMarkdownSections.ts` (Task 1)
- Produces: `export default function GrammarAccordion({ sections }: { sections: GrammarMarkdownSection[] }): JSX.Element` — Client Component

- [ ] **Step 1: Viết test**

```tsx
import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom'
import GrammarAccordion from '@/app/(protected)/books/[bookId]/lessons/[lessonId]/grammar/GrammarAccordion'
import type { GrammarMarkdownSection } from '@/lib/grammarMarkdownSections'

const sections: GrammarMarkdownSection[] = [
  { id: 'section-0', title: 'Cách đặt câu hỏi', heading: '## Ngữ pháp 1: Cách đặt câu hỏi', markdown: '**CHỨC NĂNG**\n\nGiải thích 1.' },
  { id: 'section-1', title: 'Trợ từ 嗎', heading: '## Ngữ pháp 2: Trợ từ 嗎', markdown: 'Giải thích 2.' },
]

describe('GrammarAccordion', () => {
  it('renders one collapsible item per section, titled by section.title', () => {
    render(<GrammarAccordion sections={sections} />)
    expect(screen.getByText('Cách đặt câu hỏi')).toBeInTheDocument()
    expect(screen.getByText('Trợ từ 嗎')).toBeInTheDocument()
  })

  it('opens the first section by default, keeps the rest closed', () => {
    render(<GrammarAccordion sections={sections} />)
    const details = document.querySelectorAll('details')
    expect(details).toHaveLength(2)
    expect(details[0]).toHaveAttribute('open')
    expect(details[1]).not.toHaveAttribute('open')
  })

  it('renders markdown content as formatted HTML (bold text becomes a <strong>)', () => {
    render(<GrammarAccordion sections={sections} />)
    const strongEl = screen.getByText('CHỨC NĂNG')
    expect(strongEl.tagName).toBe('STRONG')
  })

  it('toggles a closed section open on click', () => {
    render(<GrammarAccordion sections={sections} />)
    const secondSummary = screen.getByText('Trợ từ 嗎').closest('summary')!
    fireEvent.click(secondSummary)
    const details = document.querySelectorAll('details')
    expect(details[1]).toHaveAttribute('open')
  })

  it('falls back to the heading id for the leading unlabeled section (empty title)', () => {
    const withLeading: GrammarMarkdownSection[] = [
      { id: 'section-leading', title: '', heading: null, markdown: 'Ghi chú chung.' },
      ...sections,
    ]
    render(<GrammarAccordion sections={withLeading} />)
    expect(screen.getByText('Ghi chú chung.')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Chạy test, xác nhận thất bại vì component chưa tồn tại**

Run: `npx vitest run GrammarAccordion`
Expected: FAIL với lỗi không tìm thấy module

- [ ] **Step 3: Viết component**

```tsx
'use client'

import { ChevronDown } from 'lucide-react'
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { GrammarMarkdownSection } from '@/lib/grammarMarkdownSections'

// Cùng pattern <details>/<summary> thuần HTML với GuideAccordionItem.tsx -
// không cần thư viện accordion riêng cho một danh sách đơn giản thế này.
export default function GrammarAccordion({ sections }: { sections: GrammarMarkdownSection[] }) {
  return (
    <div className="flex flex-col gap-3">
      {sections.map((section, index) => (
        <details
          key={section.id}
          className="group rounded-card-sm border border-card-border bg-white open:shadow-sm"
          open={index === 0}
        >
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3.5 font-bold text-ink marker:content-none">
            {section.title || 'Ghi chú chung'}
            <ChevronDown
              className="h-4 w-4 shrink-0 text-ink-faint transition-transform group-open:rotate-180"
              strokeWidth={2.5}
            />
          </summary>
          <div className="prose prose-sm max-w-none border-t border-card-border px-4 py-4 text-ink prose-headings:text-ink prose-strong:text-ink">
            <Markdown remarkPlugins={[remarkGfm]}>{section.markdown}</Markdown>
          </div>
        </details>
      ))}
    </div>
  )
}
```

- [ ] **Step 4: Chạy test, xác nhận pass**

Run: `npx vitest run GrammarAccordion`
Expected: PASS (5 test)

- [ ] **Step 5: Commit**

```bash
git add "app/(protected)/books/[bookId]/lessons/[lessonId]/grammar/GrammarAccordion.tsx" tests/components/grammar/GrammarAccordion.test.tsx
git commit -m "feat: add GrammarAccordion component"
```

---

### Task 5: Route `grammar/page.tsx` + bật tab trên trang lesson

**Files:**
- Create: `app/(protected)/books/[bookId]/lessons/[lessonId]/grammar/page.tsx`
- Modify: `app/(protected)/books/[bookId]/lessons/[lessonId]/page.tsx`
- Test: không có — xác nhận (2026-08-05): các route Server Component tương đương (`vocabulary/page.tsx`, `quiz/page.tsx`) không có file test riêng trong repo này; `tests/components/quiz/QuizPage.test.tsx` test `QuizPage.tsx` (Client Component), không phải route `page.tsx`. `grammar/page.tsx` chỉ điều phối `getLesson()` (đã test ở Task 2) và `GrammarAccordion` (đã test ở Task 4) nên không cần test riêng — verify qua Step 4 (test thủ công trình duyệt).

**Interfaces:**
- Consumes: `getLesson()` (Task 2), `GrammarAccordion` (Task 4), `splitGrammarMarkdown()` (Task 1)
- Produces: route `/books/[bookId]/lessons/[lessonId]/grammar`

- [ ] **Step 1: Viết route**

```tsx
import { notFound } from 'next/navigation'
import { createServerSupabase } from '@/lib/supabase/server'
import { getLesson } from '@/lib/db/getLesson'
import BackButton from '@/components/BackButton'
import GrammarAccordion from './GrammarAccordion'
import { splitGrammarMarkdown } from '@/lib/grammarMarkdownSections'

export default async function GrammarPage({
  params,
}: {
  params: Promise<{ bookId: string; lessonId: string }>
}) {
  const { bookId, lessonId } = await params
  const supabase = await createServerSupabase()
  const lesson = await getLesson(supabase, lessonId)

  if (!lesson) notFound()

  const sections = lesson.grammar_markdown ? splitGrammarMarkdown(lesson.grammar_markdown) : []

  return (
    <div className="mx-auto max-w-[660px] px-5 py-6">
      <BackButton fallbackHref={`/books/${bookId}/lessons/${lessonId}`} />

      <div className="mb-5 rounded-card border border-card-border bg-white p-6 shadow-sm">
        <span className="mb-3 inline-flex items-center gap-1.5 rounded-pill border border-red-100 bg-red-50 px-3 py-1 text-xs font-bold uppercase tracking-wide text-brand-red">
          Bài {lesson.lesson_no}
        </span>
        <h1 className="font-han-title text-2xl font-bold text-ink">Ngữ pháp</h1>
      </div>

      {sections.length === 0 ? (
        <p className="font-semibold text-ink-faint">Bài này chưa có nội dung ngữ pháp.</p>
      ) : (
        <GrammarAccordion sections={sections} />
      )}
    </div>
  )
}
```

- [ ] **Step 2: Bật tab "Ngữ pháp" trên trang lesson**

Trong `app/(protected)/books/[bookId]/lessons/[lessonId]/page.tsx`, sửa dòng của `key: 'grammar'` trong mảng `modes`:

```ts
{ key: 'grammar', label: 'Ngữ pháp', description: 'Xem lại cấu trúc ngữ pháp', icon: LayoutList, enabled: true },
```

- [ ] **Step 3: Chạy toàn bộ test suite + typecheck**

Run: `npm test`
Expected: PASS toàn bộ, không có test nào bị vỡ do thay đổi `Lesson`/tab list

- [ ] **Step 4: Test thủ công trên trình duyệt**

Chạy `npm run dev`, mở 1 bài học đã có `grammar_markdown` thật (import sẵn từ Admin CMS qua Supabase), xác nhận:
- Trang lesson hiện tab "Ngữ pháp" ở trạng thái `enabled` (không còn "Sắp ra mắt"), bấm vào chuyển đúng trang.
- Trang `/grammar` hiện đúng heading, bold, bảng (nếu bài có) được render đẹp.
- Section đầu tiên mở sẵn, các section sau đóng, bấm mở/đóng đúng.
- Mở 1 bài học chưa có `grammar_markdown` (hoặc set NULL thủ công trên Supabase để test), xác nhận hiện "Bài này chưa có nội dung ngữ pháp."

- [ ] **Step 5: Commit**

```bash
git add "app/(protected)/books/[bookId]/lessons/[lessonId]/grammar/page.tsx" "app/(protected)/books/[bookId]/lessons/[lessonId]/page.tsx"
git commit -m "feat: add grammar tab route, enable it on the lesson page"
```
