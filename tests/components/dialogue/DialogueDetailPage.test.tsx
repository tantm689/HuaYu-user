import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom'
import DialogueDetailPage from '@/app/(protected)/books/[bookId]/lessons/[lessonId]/dialogue/[dialogueId]/DialogueDetailPage'
import type { Dialogue } from '@/lib/db/types'

vi.mock('@/app/(protected)/books/[bookId]/lessons/[lessonId]/dialogue/[dialogueId]/ListenTab', () => ({
  default: () => <div>Listen tab content</div>,
}))
vi.mock('@/app/(protected)/books/[bookId]/lessons/[lessonId]/dialogue/[dialogueId]/ShadowingScreen', () => ({
  default: () => <div>Shadowing screen content</div>,
}))
// DialogueDetailPage renders BackButton, which calls useRouter() — mock
// next/navigation so it doesn't throw "expected app router to be mounted"
// outside a Next.js app router tree. Same pattern as other component tests
// in this repo (QuizPage.test.tsx, ReviewSession.test.tsx, TypingPage.test.tsx).
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), back: vi.fn(), refresh: vi.fn() }),
}))

const dialogue: Dialogue = {
  id: 'd1',
  order: 1,
  kind: 'dialogue',
  audio_url: null,
  lines: [
    { id: 'l1', order: 1, speaker_zh: 'A', text_zh: '你好', pinyin: 'nǐ hǎo', translation_vi: 'chào', audio_url: null },
  ],
}

describe('DialogueDetailPage', () => {
  it('shows the Listen tab by default', () => {
    render(<DialogueDetailPage dialogue={dialogue} displayName="Hội thoại 1" bookId="b1" lessonId="l1" />)
    expect(screen.getByText('Listen tab content')).toBeInTheDocument()
    expect(screen.queryByText('Shadowing screen content')).not.toBeInTheDocument()
  })

  it('switches to the Shadowing tab on click', () => {
    render(<DialogueDetailPage dialogue={dialogue} displayName="Hội thoại 1" bookId="b1" lessonId="l1" />)
    fireEvent.click(screen.getByRole('tab', { name: /Shadowing/ }))
    expect(screen.getByText('Shadowing screen content')).toBeInTheDocument()
    expect(screen.queryByText('Listen tab content')).not.toBeInTheDocument()
  })
})
