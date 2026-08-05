'use client'

import { ChevronDown } from 'lucide-react'
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { GrammarMarkdownSection } from '@/lib/grammarMarkdownSections'

// Số La Mã chỉ để hiển thị (đánh số các điểm ngữ pháp "## Ngữ pháp N" theo
// đúng thứ tự xuất hiện) - dữ liệu gốc lưu số thường theo đúng quy ước của
// Admin CMS, không đổi ở đây để splitGrammarMarkdown() giữ nguyên là bản
// port trung thực. Section "Ghi chú chung" (heading === null) không được
// đánh số vì nó không phải một điểm ngữ pháp thật.
const ROMAN_NUMERALS = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII']

function toRomanNumeral(n: number): string {
  return ROMAN_NUMERALS[n - 1] ?? String(n)
}

// Cùng pattern <details>/<summary> thuần HTML với GuideAccordionItem.tsx -
// không cần thư viện accordion riêng cho một danh sách đơn giản thế này.
export default function GrammarAccordion({ sections }: { sections: GrammarMarkdownSection[] }) {
  let numberedIndex = 0

  return (
    <div className="flex flex-col gap-3">
      {sections.map((section, index) => {
        const displayTitle =
          section.heading !== null ? `${toRomanNumeral(++numberedIndex)}. ${section.title}` : 'Ghi chú chung'

        return (
          <details
            key={section.id}
            className="group rounded-card-sm border border-card-border bg-white open:shadow-sm"
            open={index === 0}
          >
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3.5 text-[18px] font-bold text-ink marker:content-none">
              {displayTitle}
              <ChevronDown
                className="h-4 w-4 shrink-0 text-ink-faint transition-transform group-open:rotate-180"
                strokeWidth={2.5}
              />
            </summary>
            {/* Phân cấp cỡ chữ theo đúng cấp bậc nội dung: heading "## Ngữ
                pháp N" (I, II...) đã ở summary 18px; "### A. ..." (đề mục
                con) 16px; nhãn viết hoa in đậm ("**CHỨC NĂNG**", không phải
                heading thật - xem lib/gemini/extract.ts) 14.5px; văn bản
                thường 13.5px. */}
            <div className="prose max-w-none border-t border-card-border px-4 py-4 text-[13.5px] text-ink prose-headings:text-ink prose-h3:text-[16px] prose-h3:font-bold prose-strong:text-[14.5px] prose-strong:tracking-wide prose-strong:text-brand-red">
              <Markdown remarkPlugins={[remarkGfm]}>{section.markdown}</Markdown>
            </div>
          </details>
        )
      })}
    </div>
  )
}
