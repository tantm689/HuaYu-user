import '@testing-library/jest-dom'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import ReviewSession from '@/app/(protected)/review/ReviewSession'
import * as browserSupabase from '@/lib/supabase/browser'
import * as dueCardsModule from '@/lib/db/getDueVocabularyCards'

const push = vi.fn()
const refresh = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, refresh }),
}))

const updateEq = vi.fn().mockResolvedValue({ error: null })
const update = vi.fn().mockReturnValue({ eq: updateEq })
const fromMock = vi.fn().mockReturnValue({ update })

vi.mock('@/lib/supabase/browser', () => ({
  createBrowserSupabase: () => ({ from: fromMock }),
}))

vi.mock('@/components/HanziStrokeOrder', () => ({
  default: ({ character }: { character: string }) => <div data-testid="stroke-order">{character}</div>,
}))

const card = {
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
}

function flipCard() {
  fireEvent.click(screen.getByRole('button', { name: /lật thẻ để xem đáp án/i }))
}

beforeEach(() => {
  push.mockClear()
  refresh.mockClear()
  fromMock.mockClear()
  window.localStorage.clear()
  vi.restoreAllMocks()
})

describe('ReviewSession completion screen', () => {
  it('shows "Đã ôn xong!" and a home button when no cards are due anymore', async () => {
    vi.spyOn(dueCardsModule, 'getDueVocabularyCards').mockResolvedValue([])

    render(<ReviewSession cards={[card]} />)
    flipCard()
    fireEvent.click(screen.getByRole('button', { name: /^đã thuộc/i }))

    await waitFor(() => expect(screen.getByText('Đã ôn xong!')).toBeInTheDocument())
    expect(screen.queryByText(/vẫn còn/i)).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /về trang chủ/i }))
    expect(push).toHaveBeenCalledWith('/home')
  })

  it('shows the remaining count and an explanation when cards are still due right after finishing', async () => {
    vi.spyOn(dueCardsModule, 'getDueVocabularyCards').mockResolvedValue(Array(5).fill(card))

    render(<ReviewSession cards={[card]} />)
    flipCard()
    fireEvent.click(screen.getByRole('button', { name: /^đã thuộc/i }))

    await waitFor(() => expect(screen.getByText('Vẫn còn 5 từ cần ôn')).toBeInTheDocument())
    expect(screen.getByText('3 lần liên tiếp')).toBeInTheDocument()
    expect(screen.getByText(/tính lại từ 0/i)).toBeInTheDocument()

    expect(screen.getByRole('button', { name: /^về trang chủ$/i })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /^ôn tiếp$/i }))
    expect(refresh).toHaveBeenCalled()
  })
})
