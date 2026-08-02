import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import FlashcardReviewer from '@/components/FlashcardReviewer'

const updateEq = vi.fn().mockResolvedValue({ error: null })
const update = vi.fn().mockReturnValue({ eq: updateEq })
const fromMock = vi.fn().mockReturnValue({ update })

vi.mock('@/lib/supabase/browser', () => ({
  createBrowserSupabase: () => ({ from: fromMock }),
}))

vi.mock('@/components/HanziStrokeOrder', () => ({
  default: ({ character }: { character: string }) => <div data-testid="stroke-order">{character}</div>,
}))

const cards = [
  {
    vocabulary: {
      id: 'v1',
      dialogue_id: 'd1',
      order: 1,
      word_zh: '你好',
      pinyin: 'nǐ hǎo',
      meaning_vi: 'xin chào',
      audio_url: null,
    },
    progress: {
      id: 'p1',
      user_id: 'u1',
      vocabulary_id: 'v1',
      box: 0,
      learning_streak: 0,
      due_at: '2026-08-02T00:00:00Z',
      last_reviewed_at: null,
      created_at: '2026-08-02T00:00:00Z',
    },
  },
  {
    vocabulary: {
      id: 'v2',
      dialogue_id: 'd1',
      order: 2,
      word_zh: '謝謝',
      pinyin: 'xiè xiè',
      meaning_vi: 'cảm ơn',
      audio_url: null,
    },
    progress: {
      id: 'p2',
      user_id: 'u1',
      vocabulary_id: 'v2',
      box: 0,
      learning_streak: 0,
      due_at: '2026-08-02T00:00:00Z',
      last_reviewed_at: null,
      created_at: '2026-08-02T00:00:00Z',
    },
  },
]

beforeEach(() => {
  fromMock.mockClear()
  update.mockClear()
  updateEq.mockClear()
})

describe('FlashcardReviewer', () => {
  it('shows the front (word_zh) first, hides pinyin/meaning until flipped', () => {
    render(<FlashcardReviewer cards={cards} />)
    expect(screen.getByText('你好')).toBeInTheDocument()
    expect(screen.queryByText('nǐ hǎo')).not.toBeInTheDocument()
  })

  it('reveals pinyin/meaning and the "Xem cách viết" button after flipping', () => {
    render(<FlashcardReviewer cards={cards} />)
    fireEvent.click(screen.getByRole('button', { name: /lật thẻ/i }))
    expect(screen.getByText('nǐ hǎo')).toBeInTheDocument()
    expect(screen.getByText('xin chào')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /xem cách viết/i })).toBeInTheDocument()
  })

  it('opens per-character stroke order canvases when "Xem cách viết" is clicked', () => {
    render(<FlashcardReviewer cards={cards} />)
    fireEvent.click(screen.getByRole('button', { name: /lật thẻ/i }))
    fireEvent.click(screen.getByRole('button', { name: /xem cách viết/i }))
    const canvases = screen.getAllByTestId('stroke-order')
    expect(canvases).toHaveLength(2)
    expect(canvases[0]).toHaveTextContent('你')
    expect(canvases[1]).toHaveTextContent('好')
  })

  it('marking correct saves box=1, learning_streak=1 via recordVocabularyReview and advances to next card', async () => {
    render(<FlashcardReviewer cards={cards} />)
    fireEvent.click(screen.getByRole('button', { name: /lật thẻ/i }))
    fireEvent.click(screen.getByRole('button', { name: /^đúng$/i }))

    await waitFor(() => expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ box: 0, learning_streak: 1 })
    ))
    expect(updateEq).toHaveBeenCalledWith('id', 'p1')
    expect(screen.getByText('謝謝')).toBeInTheDocument()
  })

  it('marking wrong at box 0 resets learning_streak to 0 and advances to next card', async () => {
    render(<FlashcardReviewer cards={cards} />)
    fireEvent.click(screen.getByRole('button', { name: /lật thẻ/i }))
    fireEvent.click(screen.getByRole('button', { name: /^sai$/i }))

    await waitFor(() => expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ box: 0, learning_streak: 0 })
    ))
    expect(screen.getByText('謝謝')).toBeInTheDocument()
  })

  it('shows a completion message after the last card is reviewed', async () => {
    render(<FlashcardReviewer cards={[cards[0]]} />)
    fireEvent.click(screen.getByRole('button', { name: /lật thẻ/i }))
    fireEvent.click(screen.getByRole('button', { name: /^đúng$/i }))

    await waitFor(() => expect(screen.getByText(/đã ôn xong/i)).toBeInTheDocument())
  })

  it('shows an error message with a "Thử lại" button on save failure, and retrying succeeds', async () => {
    updateEq.mockResolvedValueOnce({ error: { message: 'network error' } })

    render(<FlashcardReviewer cards={cards} />)
    fireEvent.click(screen.getByRole('button', { name: /lật thẻ/i }))
    fireEvent.click(screen.getByRole('button', { name: /^đúng$/i }))

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/không lưu được/i))
    const retryButton = screen.getByRole('button', { name: /thử lại/i })
    expect(retryButton).toBeInTheDocument()

    updateEq.mockResolvedValueOnce({ error: null })
    fireEvent.click(retryButton)

    await waitFor(() => expect(screen.getByText('謝謝')).toBeInTheDocument())
    expect(updateEq).toHaveBeenCalledTimes(2)
  })
})
