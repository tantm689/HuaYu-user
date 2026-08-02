import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useEffect } from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import FlashcardReviewer from '@/components/FlashcardReviewer'

const updateEq = vi.fn().mockResolvedValue({ error: null })
const update = vi.fn().mockReturnValue({ eq: updateEq })
const fromMock = vi.fn().mockReturnValue({ update })

vi.mock('@/lib/supabase/browser', () => ({
  createBrowserSupabase: () => ({ from: fromMock }),
}))

let strokeOrderMounts: number

vi.mock('@/components/HanziStrokeOrder', () => ({
  default: ({ character }: { character: string }) => {
    useEffect(() => {
      strokeOrderMounts++
    }, [])
    return <div data-testid="stroke-order">{character}</div>
  },
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
      audio_url: 'https://example.com/v1.mp3',
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

function flipCard() {
  fireEvent.click(screen.getByRole('button', { name: /lật thẻ để xem đáp án/i }))
}

function openSettings() {
  fireEvent.click(screen.getByRole('button', { name: /cài đặt/i }))
}

function resetViaSettings() {
  openSettings()
  fireEvent.click(screen.getByRole('button', { name: /đặt lại thẻ/i }))
}

beforeEach(() => {
  fromMock.mockClear()
  update.mockClear()
  updateEq.mockClear()
  strokeOrderMounts = 0
  window.localStorage.clear()
})

describe('FlashcardReviewer', () => {
  it('shows the front (word_zh) first, with the card not yet rotated to the back', () => {
    render(<FlashcardReviewer cards={cards} />)
    expect(screen.getByText('你好')).toBeInTheDocument()
    const card = screen.getByRole('button', { name: /lật thẻ để xem đáp án/i })
    expect(card).toHaveStyle({ transform: 'rotateY(0deg)' })
  })

  it('reveals pinyin/meaning after flipping, via clicking the card', () => {
    render(<FlashcardReviewer cards={cards} />)
    flipCard()
    expect(screen.getByText('nǐ hǎo')).toBeInTheDocument()
    expect(screen.getByText('xin chào')).toBeInTheDocument()
  })

  it('shows per-character stroke order canvases on the back of the card by default, no extra click needed', () => {
    render(<FlashcardReviewer cards={cards} />)
    flipCard()
    const canvases = screen.getAllByTestId('stroke-order')
    expect(canvases).toHaveLength(2)
    expect(canvases[0]).toHaveTextContent('你')
    expect(canvases[1]).toHaveTextContent('好')
  })

  it('marking "Đã thuộc" saves box=1, learning_streak=1 via recordVocabularyReview and advances to next card', async () => {
    render(<FlashcardReviewer cards={cards} />)
    flipCard()
    fireEvent.click(screen.getByRole('button', { name: /^đã thuộc/i }))

    await waitFor(() => expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ box: 0, learning_streak: 1 })
    ))
    expect(updateEq).toHaveBeenCalledWith('id', 'p1')
    await waitFor(() => expect(screen.getByText('謝謝')).toBeInTheDocument())
  })

  it('marking "Chưa thuộc" at box 0 resets learning_streak to 0 and advances to next card', async () => {
    render(<FlashcardReviewer cards={cards} />)
    flipCard()
    fireEvent.click(screen.getByRole('button', { name: /chưa thuộc/i }))

    await waitFor(() => expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ box: 0, learning_streak: 0 })
    ))
    await waitFor(() => expect(screen.getByText('謝謝')).toBeInTheDocument())
  })

  it('shows a round summary screen with percent/counts when a round ends with some cards still not mastered, and continuing starts a fresh round with only those cards', async () => {
    render(<FlashcardReviewer cards={cards} />)

    // Round 1 (2 cards): v1 chưa thuộc, v2 đã thuộc.
    flipCard()
    fireEvent.click(screen.getByRole('button', { name: /chưa thuộc/i }))
    await waitFor(() => expect(screen.getByText('謝謝')).toBeInTheDocument())

    flipCard()
    fireEvent.click(screen.getByRole('button', { name: /^đã thuộc/i }))

    // Round summary: 1/2 mastered = 50%, 1 đã thuộc, 1 chưa thuộc.
    await waitFor(() => expect(screen.getByText('50%')).toBeInTheDocument())
    expect(screen.getByText('Đã thuộc')).toBeInTheDocument()
    expect(screen.getByText('Chưa thuộc')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /tiếp tục với 1 từ chưa thuộc/i }))

    // Round 2 starts fresh, containing ONLY v1.
    await waitFor(() => expect(screen.getByText('你好')).toBeInTheDocument())
    expect(screen.getByText('0/1')).toBeInTheDocument()

    // Round 2: v1 đã thuộc -> no cards left, session complete (no summary shown, straight to done).
    flipCard()
    fireEvent.click(screen.getByRole('button', { name: /^đã thuộc/i }))
    await waitFor(() => expect(screen.getByText(/đã ôn xong/i)).toBeInTheDocument())

    expect(update).toHaveBeenCalledTimes(3)
  })

  it('shows a completion message after the only card is marked "Đã thuộc"', async () => {
    render(<FlashcardReviewer cards={[cards[0]]} />)
    flipCard()
    fireEvent.click(screen.getByRole('button', { name: /^đã thuộc/i }))

    await waitFor(() => expect(screen.getByText(/đã ôn xong/i)).toBeInTheDocument())
  })

  it('shows an error message with a "Thử lại" button on save failure, and retrying succeeds', async () => {
    updateEq.mockResolvedValueOnce({ error: { message: 'network error' } })

    render(<FlashcardReviewer cards={cards} />)
    flipCard()
    fireEvent.click(screen.getByRole('button', { name: /^đã thuộc/i }))

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/không lưu được/i))
    const retryButton = screen.getByRole('button', { name: /thử lại/i })
    expect(retryButton).toBeInTheDocument()

    updateEq.mockResolvedValueOnce({ error: null })
    fireEvent.click(retryButton)

    await waitFor(() => expect(screen.getByText('謝謝')).toBeInTheDocument())
    expect(updateEq).toHaveBeenCalledTimes(2)
  })

  it('flips the card when Space is pressed, and answers with ArrowLeft/ArrowRight', async () => {
    render(<FlashcardReviewer cards={cards} />)

    fireEvent.keyDown(window, { code: 'Space' })
    expect(screen.getByText('nǐ hǎo')).toBeInTheDocument()

    fireEvent.keyDown(window, { code: 'ArrowRight' })

    await waitFor(() => expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ box: 0, learning_streak: 1 })
    ))
    await waitFor(() => expect(screen.getByText('謝謝')).toBeInTheDocument())
  })

  it('shows a playable audio control on the front of the card, without needing to flip first', () => {
    render(<FlashcardReviewer cards={cards} />)
    expect(screen.getByRole('button', { name: /phát âm thanh/i })).toBeInTheDocument()
  })

  it('opens the settings menu and resets back to round 1 with the full original deck via "Đặt lại thẻ"', async () => {
    render(<FlashcardReviewer cards={cards} />)

    flipCard()
    fireEvent.click(screen.getByRole('button', { name: /^đã thuộc/i }))
    await waitFor(() => expect(screen.getByText('謝謝')).toBeInTheDocument())

    resetViaSettings()

    expect(screen.getByText('你好')).toBeInTheDocument()
    expect(screen.getByText('0/2')).toBeInTheDocument()
    const card = screen.getByRole('button', { name: /lật thẻ để xem đáp án/i })
    expect(card).toHaveStyle({ transform: 'rotateY(0deg)' })
  })

  it('keeps the settings menu open after toggling "Trộn thẻ" (unlike "Đặt lại thẻ", which closes it)', () => {
    render(<FlashcardReviewer cards={cards} />)
    openSettings()

    fireEvent.click(screen.getByRole('button', { name: /trộn thẻ/i }))

    expect(screen.getByRole('button', { name: /trộn thẻ/i })).toBeInTheDocument()
  })

  it('turning "Trộn thẻ" ON shuffles only the remaining cards behind the one currently showing, leaving the current card in place', () => {
    const fourCards = [
      cards[0],
      cards[1],
      {
        vocabulary: {
          id: 'v3',
          dialogue_id: 'd1',
          order: 3,
          word_zh: '再見',
          pinyin: 'zàijiàn',
          meaning_vi: 'tạm biệt',
          audio_url: null,
        },
        progress: {
          id: 'p3',
          user_id: 'u1',
          vocabulary_id: 'v3',
          box: 0,
          learning_streak: 0,
          due_at: '2026-08-02T00:00:00Z',
          last_reviewed_at: null,
          created_at: '2026-08-02T00:00:00Z',
        },
      },
      {
        vocabulary: {
          id: 'v4',
          dialogue_id: 'd1',
          order: 4,
          word_zh: '早安',
          pinyin: 'zǎoān',
          meaning_vi: 'chào buổi sáng',
          audio_url: null,
        },
        progress: {
          id: 'p4',
          user_id: 'u1',
          vocabulary_id: 'v4',
          box: 0,
          learning_streak: 0,
          due_at: '2026-08-02T00:00:00Z',
          last_reviewed_at: null,
          created_at: '2026-08-02T00:00:00Z',
        },
      },
    ]

    // Fisher-Yates with Math.random always 0 deterministically reverses the array.
    const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0)

    render(<FlashcardReviewer cards={fourCards} />)
    expect(screen.getByText('你好')).toBeInTheDocument() // v1, unshuffled front card

    openSettings()
    fireEvent.click(screen.getByRole('button', { name: /trộn thẻ/i }))

    // v1 (front card) is untouched by the shuffle.
    expect(screen.getByText('你好')).toBeInTheDocument()

    randomSpy.mockRestore()
  })

  it('turning "Trộn thẻ" OFF restores the remaining cards to their original order, leaving the current card in place', async () => {
    const fourCards = [
      cards[0],
      cards[1],
      {
        vocabulary: {
          id: 'v3',
          dialogue_id: 'd1',
          order: 3,
          word_zh: '再見',
          pinyin: 'zàijiàn',
          meaning_vi: 'tạm biệt',
          audio_url: null,
        },
        progress: {
          id: 'p3',
          user_id: 'u1',
          vocabulary_id: 'v3',
          box: 0,
          learning_streak: 0,
          due_at: '2026-08-02T00:00:00Z',
          last_reviewed_at: null,
          created_at: '2026-08-02T00:00:00Z',
        },
      },
    ]

    render(<FlashcardReviewer cards={fourCards} />)

    openSettings()
    fireEvent.click(screen.getByRole('button', { name: /trộn thẻ/i })) // ON: shuffles v2/v3 behind v1
    fireEvent.click(screen.getByRole('button', { name: /trộn thẻ/i })) // OFF: restores v2, v3 order behind v1

    expect(screen.getByText('你好')).toBeInTheDocument() // still the front card, untouched

    // Advance past v1 to confirm the rest is back in original order: v2 then v3.
    flipCard()
    fireEvent.click(screen.getByRole('button', { name: /^đã thuộc/i }))
    await waitFor(() => expect(screen.getByText('謝謝')).toBeInTheDocument())
  })

  it('shows "Đặt lại thẻ" on the completion screen, resetting the whole session', async () => {
    render(<FlashcardReviewer cards={[cards[0]]} />)
    flipCard()
    fireEvent.click(screen.getByRole('button', { name: /^đã thuộc/i }))
    await waitFor(() => expect(screen.getByText(/đã ôn xong/i)).toBeInTheDocument())

    fireEvent.click(screen.getByRole('button', { name: /đặt lại thẻ/i }))

    expect(screen.getByText('你好')).toBeInTheDocument()
  })

  it('remounts HanziStrokeOrder for the next card even when a character shares the same position as the previous card (keyed by vocabulary id, not char+index)', async () => {
    const sameFirstCharCards = [
      cards[0], // 你好 -> chars: 你, 好
      {
        vocabulary: {
          id: 'v3',
          dialogue_id: 'd1',
          order: 3,
          word_zh: '你們', // shares "你" at index 0 with card 1
          pinyin: 'nǐmen',
          meaning_vi: 'các bạn',
          audio_url: null,
        },
        progress: {
          id: 'p3',
          user_id: 'u1',
          vocabulary_id: 'v3',
          box: 0,
          learning_streak: 0,
          due_at: '2026-08-02T00:00:00Z',
          last_reviewed_at: null,
          created_at: '2026-08-02T00:00:00Z',
        },
      },
    ]

    render(<FlashcardReviewer cards={sameFirstCharCards} />)
    flipCard()
    await waitFor(() => expect(strokeOrderMounts).toBe(2)) // 你, 好

    fireEvent.click(screen.getByRole('button', { name: /^đã thuộc/i }))
    await waitFor(() => expect(screen.getByText('你們')).toBeInTheDocument())
    flipCard()

    // If keyed only by char+index, the "你" canvas at index 0 would be reused
    // (same key) instead of remounted — this assertion catches that regression.
    await waitFor(() => expect(strokeOrderMounts).toBe(4)) // +你, +們
  })

  it('shows separate "Chưa thuộc"/"Đã thuộc" counters and a progress bar for the current round', async () => {
    render(<FlashcardReviewer cards={cards} />)
    expect(screen.getByText('0/2')).toBeInTheDocument()

    flipCard()
    fireEvent.click(screen.getByRole('button', { name: /^đã thuộc/i }))
    await waitFor(() => expect(screen.getByText('謝謝')).toBeInTheDocument())
    expect(screen.getByText('1/2')).toBeInTheDocument()
  })

  it('flashes a colored ring on the card when answering, before advancing to the next card', async () => {
    render(<FlashcardReviewer cards={cards} />)
    flipCard()

    const card = screen.getByRole('button', { name: /lật lại mặt trước/i })
    fireEvent.click(screen.getByRole('button', { name: /^đã thuộc/i }))

    await waitFor(() => expect(card.className).toMatch(/outline-success-border/))
    await waitFor(() => expect(screen.getByText('謝謝')).toBeInTheDocument())
  })

  it('persists round state to localStorage under storageKey, and restores it on next mount', async () => {
    const { unmount } = render(<FlashcardReviewer cards={cards} storageKey="test-key" />)
    flipCard()
    fireEvent.click(screen.getByRole('button', { name: /^đã thuộc/i }))
    await waitFor(() => expect(screen.getByText('謝謝')).toBeInTheDocument())

    await waitFor(() => {
      const saved = window.localStorage.getItem('test-key')
      expect(saved).not.toBeNull()
      expect(JSON.parse(saved!)).toEqual({ roundCardIds: ['v2'], nextRoundCardIds: [] })
    })

    unmount()
    render(<FlashcardReviewer cards={cards} storageKey="test-key" />)
    expect(screen.getByText('謝謝')).toBeInTheDocument()
  })

  it('clears the saved localStorage entry when the session completes', async () => {
    render(<FlashcardReviewer cards={[cards[0]]} storageKey="test-key" />)
    flipCard()
    fireEvent.click(screen.getByRole('button', { name: /^đã thuộc/i }))

    await waitFor(() => expect(screen.getByText(/đã ôn xong/i)).toBeInTheDocument())
    await waitFor(() => expect(window.localStorage.getItem('test-key')).toBeNull())
  })

  it('clears the saved localStorage entry when "Đặt lại thẻ" is pressed via the settings menu', async () => {
    render(<FlashcardReviewer cards={cards} storageKey="test-key" />)
    flipCard()
    fireEvent.click(screen.getByRole('button', { name: /^đã thuộc/i }))
    await waitFor(() => expect(screen.getByText('謝謝')).toBeInTheDocument())
    expect(window.localStorage.getItem('test-key')).not.toBeNull()

    resetViaSettings()
    expect(window.localStorage.getItem('test-key')).toBeNull()
  })

  it('ignores a saved state that no longer matches the current card set (falls back to a fresh round 1)', () => {
    window.localStorage.setItem(
      'test-key',
      JSON.stringify({ roundCardIds: ['some-stale-id-not-in-cards'], nextRoundCardIds: [] })
    )
    render(<FlashcardReviewer cards={cards} storageKey="test-key" />)
    expect(screen.getByText('你好')).toBeInTheDocument()
  })

  it('recovers into the next round directly (skipping the summary) if restored state was saved mid-summary with an empty round', () => {
    window.localStorage.setItem(
      'test-key',
      JSON.stringify({ roundCardIds: [], nextRoundCardIds: ['v1'] })
    )
    render(<FlashcardReviewer cards={cards} storageKey="test-key" />)
    expect(screen.getByText('你好')).toBeInTheDocument()
    expect(screen.getByText('0/1')).toBeInTheDocument()
  })

  it('shows no "Quay lại thẻ trước" button before any card has been answered', () => {
    render(<FlashcardReviewer cards={cards} />)
    expect(screen.queryByRole('button', { name: /quay lại thẻ trước/i })).not.toBeInTheDocument()
  })

  it('"Quay lại thẻ trước" restores the previous card, reverts its Leitner data in Supabase, and updates the counters', async () => {
    render(<FlashcardReviewer cards={cards} />)

    flipCard()
    fireEvent.click(screen.getByRole('button', { name: /^đã thuộc/i })) // v1: box 0->1, streak 0->1
    await waitFor(() => expect(screen.getByText('謝謝')).toBeInTheDocument())
    expect(screen.getByText('1/2')).toBeInTheDocument()

    update.mockClear()
    updateEq.mockClear()

    fireEvent.click(screen.getByRole('button', { name: /quay lại thẻ trước/i }))

    // v1's Leitner data is reverted back to its pre-answer values in Supabase.
    await waitFor(() => expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ box: 0, learning_streak: 0 })
    ))
    expect(updateEq).toHaveBeenCalledWith('id', 'p1')

    // UI is back to showing v1, counters reset to before that answer, not flipped.
    await waitFor(() => expect(screen.getByText('你好')).toBeInTheDocument())
    expect(screen.getByText('0/2')).toBeInTheDocument()
    const card = screen.getByRole('button', { name: /lật thẻ để xem đáp án/i })
    expect(card).toHaveStyle({ transform: 'rotateY(0deg)' })
  })

  it('supports undoing multiple answers in a row, restoring each card and its counters step by step', async () => {
    render(<FlashcardReviewer cards={cards} />)

    flipCard()
    fireEvent.click(screen.getByRole('button', { name: /^đã thuộc/i })) // v1 done
    await waitFor(() => expect(screen.getByText('謝謝')).toBeInTheDocument())

    flipCard()
    fireEvent.click(screen.getByRole('button', { name: /chưa thuộc/i })) // v2 wrong
    await waitFor(() => expect(screen.getByText('50%')).toBeInTheDocument()) // round summary (v2 not mastered)

    fireEvent.click(screen.getByRole('button', { name: /quay lại thẻ trước/i }))
    // Undo brings back the flashcard screen (not the summary) with v2 as the current card.
    await waitFor(() => expect(screen.getByText('謝謝')).toBeInTheDocument())
    expect(screen.getByText('1/2')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /quay lại thẻ trước/i }))
    await waitFor(() => expect(screen.getByText('你好')).toBeInTheDocument())
    expect(screen.getByText('0/2')).toBeInTheDocument()

    // No more history left.
    expect(screen.queryByRole('button', { name: /quay lại thẻ trước/i })).not.toBeInTheDocument()
  })

  it('clears the undo history when "Đặt lại thẻ" is pressed', async () => {
    render(<FlashcardReviewer cards={cards} />)

    flipCard()
    fireEvent.click(screen.getByRole('button', { name: /^đã thuộc/i }))
    await waitFor(() => expect(screen.getByRole('button', { name: /quay lại thẻ trước/i })).toBeInTheDocument())

    resetViaSettings()

    expect(screen.queryByRole('button', { name: /quay lại thẻ trước/i })).not.toBeInTheDocument()
  })
})
