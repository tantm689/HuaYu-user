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
