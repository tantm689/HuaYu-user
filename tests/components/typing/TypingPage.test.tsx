import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom'
import TypingPage from '@/app/(protected)/books/[bookId]/lessons/[lessonId]/typing/TypingPage'

const push = vi.fn()
const back = vi.fn()
const refresh = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, back, refresh }),
}))

vi.mock('@/lib/supabase/browser', () => ({
  createBrowserSupabase: () => ({ from: vi.fn().mockReturnValue({ upsert: vi.fn().mockResolvedValue({ error: null }) }) }),
}))

const vocabulary = [
  { id: 'v1', dialogue_id: 'd1', order: 1, word_zh: '你好', pinyin: null, meaning_vi: 'xin chào', audio_url: null },
]
const lines = [{ id: 'l1', text_zh: '你好嗎', translation_vi: 'bạn khỏe không', audio_url: null }]

describe('TypingPage', () => {
  it('defaults to the mode-selection screen', () => {
    render(<TypingPage vocabulary={vocabulary} lines={lines} />)
    expect(screen.getByText('Gõ từ mới')).toBeInTheDocument()
    expect(screen.getByText('Gõ câu hội thoại')).toBeInTheDocument()
    expect(screen.queryByText('xin chào')).not.toBeInTheDocument()
  })

  it('enters the vocab tab when Gõ từ mới is clicked', () => {
    render(<TypingPage vocabulary={vocabulary} lines={lines} />)
    fireEvent.click(screen.getByText('Gõ từ mới'))
    expect(screen.getByText('xin chào')).toBeInTheDocument()
  })

  it('enters the sentence tab when Gõ câu hội thoại is clicked', () => {
    render(<TypingPage vocabulary={vocabulary} lines={lines} />)
    fireEvent.click(screen.getByText('Gõ câu hội thoại'))
    expect(screen.getByText('bạn khỏe không')).toBeInTheDocument()
    expect(screen.queryByText('xin chào')).not.toBeInTheDocument()
  })

  it('returns to the mode-selection screen when "Quay lại" is clicked from inside a mode', () => {
    render(<TypingPage vocabulary={vocabulary} lines={lines} />)
    fireEvent.click(screen.getByText('Gõ từ mới'))
    fireEvent.click(screen.getByRole('button', { name: /quay lại/i }))
    expect(screen.getByText('Gõ câu hội thoại')).toBeInTheDocument()
  })

  it('navigates back via router when "Quay lại" is clicked from the mode-selection screen', () => {
    render(<TypingPage vocabulary={vocabulary} lines={lines} />)
    fireEvent.click(screen.getByRole('button', { name: /quay lại/i }))
    expect(back).toHaveBeenCalled()
  })
})
