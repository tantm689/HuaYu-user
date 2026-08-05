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
