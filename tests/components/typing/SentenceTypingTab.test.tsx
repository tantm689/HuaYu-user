import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import SentenceTypingTab from '@/app/(protected)/books/[bookId]/lessons/[lessonId]/typing/SentenceTypingTab'

const upsert = vi.fn().mockResolvedValue({ error: null })

vi.mock('@/lib/supabase/browser', () => ({
  createBrowserSupabase: () => ({ from: vi.fn().mockReturnValue({ upsert }) }),
}))

const playMock = vi.fn()
vi.stubGlobal(
  'Audio',
  vi.fn().mockImplementation(() => ({ play: playMock }))
)

const lines = [
  { id: 'l1', text_zh: '你好嗎', translation_vi: 'bạn khỏe không', audio_url: 'a1.mp3' },
  { id: 'l2', text_zh: '我很好', translation_vi: 'tôi khỏe', audio_url: null },
]

beforeEach(() => {
  upsert.mockClear()
  playMock.mockClear()
})

describe('SentenceTypingTab', () => {
  it('shows the first line translation and an input, hides the Hanzi sentence', () => {
    render(<SentenceTypingTab lines={lines} />)
    expect(screen.getByText('bạn khỏe không')).toBeInTheDocument()
    expect(screen.queryByText('你好嗎')).not.toBeInTheDocument()
  })

  it('shows the audio button only when audio_url is present', () => {
    render(<SentenceTypingTab lines={lines} />)
    expect(screen.getByRole('button', { name: /phát âm thanh/i })).toBeInTheDocument()
  })

  it('hides the audio button when audio_url is null and plays audio when present', () => {
    render(<SentenceTypingTab lines={[lines[1], lines[0]]} />)
    expect(screen.queryByRole('button', { name: /phát âm thanh/i })).not.toBeInTheDocument()
  })

  it('locks the input and shows the correct answer after an incorrect submission, advances on Tiếp', async () => {
    render(<SentenceTypingTab lines={lines} />)
    const input = screen.getByRole('textbox')
    fireEvent.change(input, { target: { value: 'sai roi' } })
    fireEvent.click(screen.getByRole('button', { name: /kiểm tra/i }))

    await waitFor(() => expect(input).toHaveAttribute('readonly'))
    expect(screen.getByText('你好嗎')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /^tiếp$/i }))
    expect(screen.getByText('tôi khỏe')).toBeInTheDocument()
  })

  it('marks correct on exact match (after normalization) and saves progress', async () => {
    render(<SentenceTypingTab lines={lines} />)
    const input = screen.getByRole('textbox')
    fireEvent.change(input, { target: { value: '你好嗎' } })
    fireEvent.click(screen.getByRole('button', { name: /kiểm tra/i }))

    await waitFor(() =>
      expect(upsert).toHaveBeenCalledWith(
        { kind: 'dialogue_line', target_id: 'l1', is_correct: true, streak: 1, last_attempted_at: expect.any(String) },
        { onConflict: 'user_id,kind,target_id' }
      )
    )
  })

  it('shows a completion message after the last line', () => {
    render(<SentenceTypingTab lines={[lines[1]]} />)
    fireEvent.click(screen.getByRole('button', { name: /kiểm tra/i }))
    fireEvent.click(screen.getByRole('button', { name: /^tiếp$/i }))
    expect(screen.getByText(/đã luyện xong 1 câu/i)).toBeInTheDocument()
  })

  it('shows the correct/wrong tally and percent on the completion screen', () => {
    render(<SentenceTypingTab lines={lines} />)

    // First line: submit empty (counts as wrong)
    fireEvent.click(screen.getByRole('button', { name: /kiểm tra/i }))
    fireEvent.click(screen.getByRole('button', { name: /^tiếp$/i }))

    // Second line: submit correct
    const input = screen.getByRole('textbox')
    fireEvent.change(input, { target: { value: '我很好' } })
    fireEvent.click(screen.getByRole('button', { name: /kiểm tra/i }))
    fireEvent.click(screen.getByRole('button', { name: /^tiếp$/i }))

    expect(screen.getByText('Đã luyện xong 2 câu')).toBeInTheDocument()
    expect(screen.getByText('1/2 câu đúng')).toBeInTheDocument()
    expect(screen.getByText('50%')).toBeInTheDocument()
  })

  it('restarts from the first line and resets the tally when Làm lại is clicked', () => {
    render(<SentenceTypingTab lines={[lines[1]]} />)
    fireEvent.click(screen.getByRole('button', { name: /kiểm tra/i }))
    fireEvent.click(screen.getByRole('button', { name: /^tiếp$/i }))
    expect(screen.getByText('Đã luyện xong 1 câu')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /^làm lại$/i }))
    expect(screen.getByText('tôi khỏe')).toBeInTheDocument()
    expect(screen.queryByText(/đã luyện xong/i)).not.toBeInTheDocument()
  })

  it('does not crash and shows an empty-state message when lines is empty', () => {
    expect(() => render(<SentenceTypingTab lines={[]} />)).not.toThrow()
    expect(screen.getByText(/bài học này chưa có câu hội thoại để luyện gõ/i)).toBeInTheDocument()
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
  })
})
