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
  it('renders one collapsible item per section, titled with a Roman numeral prefix followed by section.title', () => {
    render(<GrammarAccordion sections={sections} />)
    expect(screen.getByText('I. Cách đặt câu hỏi')).toBeInTheDocument()
    expect(screen.getByText('II. Trợ từ 嗎')).toBeInTheDocument()
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
    const secondSummary = screen.getByText('II. Trợ từ 嗎').closest('summary')!
    fireEvent.click(secondSummary)
    const details = document.querySelectorAll('details')
    expect(details[1]).toHaveAttribute('open')
  })

  it('shows a fallback summary label ("Ghi chú chung") for a section with an empty title, while still rendering its content, and does not consume a Roman numeral for it', () => {
    const withLeading: GrammarMarkdownSection[] = [
      { id: 'section-leading', title: '', heading: null, markdown: 'Nội dung mở đầu.' },
      ...sections,
    ]
    render(<GrammarAccordion sections={withLeading} />)
    expect(screen.getByText('Ghi chú chung')).toBeInTheDocument() // the fallback summary label
    expect(screen.getByText('Nội dung mở đầu.')).toBeInTheDocument() // the section's body content
    // Numbering still starts at I for the first real grammar point, unaffected by the leading section.
    expect(screen.getByText('I. Cách đặt câu hỏi')).toBeInTheDocument()
    expect(screen.getByText('II. Trợ từ 嗎')).toBeInTheDocument()
  })

  it('numbers grammar points sequentially past X using Roman numerals', () => {
    const manySections: GrammarMarkdownSection[] = Array.from({ length: 11 }, (_, i) => ({
      id: `section-${i}`,
      title: `Điểm ${i + 1}`,
      heading: `## Ngữ pháp ${i + 1}: Điểm ${i + 1}`,
      markdown: `Nội dung ${i + 1}.`,
    }))
    render(<GrammarAccordion sections={manySections} />)
    expect(screen.getByText('X. Điểm 10')).toBeInTheDocument()
    expect(screen.getByText('XI. Điểm 11')).toBeInTheDocument()
  })
})
