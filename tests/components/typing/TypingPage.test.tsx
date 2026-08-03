import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom'
import TypingPage from '@/app/(protected)/books/[bookId]/lessons/[lessonId]/typing/TypingPage'

vi.mock('@/lib/supabase/browser', () => ({
  createBrowserSupabase: () => ({ from: vi.fn().mockReturnValue({ upsert: vi.fn().mockResolvedValue({ error: null }) }) }),
}))

const vocabulary = [
  { id: 'v1', dialogue_id: 'd1', order: 1, word_zh: '你好', pinyin: null, meaning_vi: 'xin chào', audio_url: null },
]
const lines = [{ id: 'l1', text_zh: '你好嗎', translation_vi: 'bạn khỏe không', audio_url: null }]

describe('TypingPage', () => {
  it('defaults to the Gõ từ tab', () => {
    render(<TypingPage vocabulary={vocabulary} lines={lines} />)
    expect(screen.getByText('xin chào')).toBeInTheDocument()
  })

  it('switches to Gõ câu tab on click', () => {
    render(<TypingPage vocabulary={vocabulary} lines={lines} />)
    fireEvent.click(screen.getByRole('button', { name: 'Gõ câu' }))
    expect(screen.getByText('bạn khỏe không')).toBeInTheDocument()
    expect(screen.queryByText('xin chào')).not.toBeInTheDocument()
  })
})
