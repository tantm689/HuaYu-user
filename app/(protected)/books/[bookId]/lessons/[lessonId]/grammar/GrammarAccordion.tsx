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
