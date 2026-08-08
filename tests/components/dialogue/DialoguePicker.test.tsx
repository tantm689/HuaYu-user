import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import DialoguePickerList from '@/app/(protected)/books/[bookId]/lessons/[lessonId]/dialogue/DialoguePickerList'

const dialogues = [
  { id: 'd1', kind: 'dialogue' as const },
  { id: 'd2', kind: 'passage' as const },
]

describe('DialoguePickerList', () => {
  it('renders one link per dialogue with its computed display name', () => {
    render(<DialoguePickerList dialogues={dialogues} bookId="b1" lessonId="l1" />)
    expect(screen.getByRole('link', { name: /Hội thoại 1/ })).toHaveAttribute(
      'href',
      '/books/b1/lessons/l1/dialogue/d1'
    )
    expect(screen.getByRole('link', { name: /Đoạn văn 1/ })).toHaveAttribute(
      'href',
      '/books/b1/lessons/l1/dialogue/d2'
    )
  })

  it('shows an empty state when there are no dialogues', () => {
    render(<DialoguePickerList dialogues={[]} bookId="b1" lessonId="l1" />)
    expect(screen.getByText(/Chưa có bài hội thoại/)).toBeInTheDocument()
  })
})
