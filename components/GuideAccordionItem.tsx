'use client'

import { ChevronDown } from 'lucide-react'

export default function GuideAccordionItem({
  title,
  defaultOpen = false,
  children,
}: {
  title: string
  defaultOpen?: boolean
  children: React.ReactNode
}) {
  return (
    <details
      className="group rounded-card-sm border border-card-border bg-white open:shadow-sm"
      open={defaultOpen}
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3.5 font-bold text-ink marker:content-none">
        {title}
        <ChevronDown
          className="h-4 w-4 shrink-0 text-ink-faint transition-transform group-open:rotate-180"
          strokeWidth={2.5}
        />
      </summary>
      <div className="border-t border-card-border px-4 py-4 text-sm leading-relaxed text-ink">{children}</div>
    </details>
  )
}
