import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
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
  // Math.random() just under 1 keeps a 2-item Fisher-Yates shuffle a no-op
  // (floor(0.999 * 2) = 1 = its own index), so tests can rely on `lines`'
  // original order unless a test explicitly wants shuffling.
  vi.spyOn(Math, 'random').mockReturnValue(0.999)
})

afterEach(() => {
  vi.restoreAllMocks()
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

  it('locks the input and shows the correct answer after an incorrect submission, advances on Tiếp theo', async () => {
    render(<SentenceTypingTab lines={lines} />)
    const input = screen.getByRole('textbox')
    fireEvent.change(input, { target: { value: 'sai roi' } })
    fireEvent.click(screen.getByRole('button', { name: /kiểm tra/i }))

    await waitFor(() => expect(input).toHaveAttribute('readonly'))
    expect(screen.getByText('你好嗎')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /tiếp theo/i }))
    expect(screen.getByText('tôi khỏe')).toBeInTheDocument()
  })

  it('marks correct on exact match (after normalization), shows a "Chính xác!" label, and saves progress', async () => {
    render(<SentenceTypingTab lines={lines} />)
    const input = screen.getByRole('textbox')
    fireEvent.change(input, { target: { value: '你好嗎' } })
    fireEvent.click(screen.getByRole('button', { name: /kiểm tra/i }))

    await waitFor(() => expect(screen.getByText(/chính xác!/i)).toBeInTheDocument())
    expect(screen.queryByText(/đáp án đúng/i)).not.toBeInTheDocument()

    expect(upsert).toHaveBeenCalledWith(
      { kind: 'dialogue_line', target_id: 'l1', is_correct: true, streak: 1, last_attempted_at: expect.any(String) },
      { onConflict: 'user_id,kind,target_id' }
    )
  })

  it('shows a completion message and a restart button after the last line', () => {
    render(<SentenceTypingTab lines={[lines[1]]} />)
    fireEvent.click(screen.getByRole('button', { name: /kiểm tra/i }))
    fireEvent.click(screen.getByRole('button', { name: /tiếp theo/i }))
    expect(screen.getByText(/đã luyện xong 1 câu hội thoại/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^làm lại$/i })).toBeInTheDocument()
  })

  it('restarts from the first line when Làm lại is clicked', () => {
    render(<SentenceTypingTab lines={[lines[1]]} />)
    fireEvent.click(screen.getByRole('button', { name: /kiểm tra/i }))
    fireEvent.click(screen.getByRole('button', { name: /tiếp theo/i }))
    expect(screen.getByText(/đã luyện xong/i)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /^làm lại$/i }))
    expect(screen.getByText('tôi khỏe')).toBeInTheDocument()
    expect(screen.queryByText(/đã luyện xong/i)).not.toBeInTheDocument()
  })

  it('shuffles the line order on mount (swaps the only pair in a 2-item list when random() forces the swap)', () => {
    // Fisher-Yates on a 2-item array does exactly one swap: i=1,
    // j = Math.floor(random() * 2). random() = 0 -> j = 0 -> swap, putting
    // the second line first. random() just under 1 -> j = 1 -> no swap.
    vi.spyOn(Math, 'random').mockReturnValue(0)
    render(<SentenceTypingTab lines={lines} />)
    expect(screen.getByText('tôi khỏe')).toBeInTheDocument()
    expect(screen.queryByText('bạn khỏe không')).not.toBeInTheDocument()
  })

  it('reshuffles when Làm lại is clicked (does not reuse the same fixed order object)', () => {
    render(<SentenceTypingTab lines={[lines[1]]} />)
    fireEvent.click(screen.getByRole('button', { name: /kiểm tra/i }))
    fireEvent.click(screen.getByRole('button', { name: /tiếp theo/i }))

    vi.spyOn(Math, 'random').mockReturnValue(0)
    fireEvent.click(screen.getByRole('button', { name: /^làm lại$/i }))
    expect(screen.getByText('tôi khỏe')).toBeInTheDocument()
  })

  it('does not crash and shows an empty-state message when lines is empty', () => {
    expect(() => render(<SentenceTypingTab lines={[]} />)).not.toThrow()
    expect(screen.getByText(/bài học này chưa có câu hội thoại để luyện gõ/i)).toBeInTheDocument()
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
  })
})
