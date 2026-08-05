import '@testing-library/jest-dom'
import { useState } from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import QuizPage from '@/app/(protected)/books/[bookId]/lessons/[lessonId]/quiz/QuizPage'
import type { QuizQuestion } from '@/lib/db/types'

let currentSearch = ''
let notifySearchChange: (() => void) | null = null
const push = vi.fn((url: string) => {
  const queryIndex = url.indexOf('?')
  currentSearch = queryIndex === -1 ? '' : url.slice(queryIndex + 1)
  notifySearchChange?.()
})
const replace = vi.fn((url: string) => {
  const queryIndex = url.indexOf('?')
  currentSearch = queryIndex === -1 ? '' : url.slice(queryIndex + 1)
  notifySearchChange?.()
})

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, replace }),
  usePathname: () => '/books/book-1/lessons/lesson-1/quiz',
  useSearchParams: () => {
    const [, setTick] = useState(0)
    notifySearchChange = () => setTick((t: number) => t + 1)
    return new URLSearchParams(currentSearch)
  },
}))

beforeEach(() => {
  push.mockClear()
  replace.mockClear()
  currentSearch = ''
})

function makeQuestions(part: 1 | 2, count: number): QuizQuestion[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `p${part}-q${i + 1}`,
    lesson_id: 'lesson-1',
    part,
    type: 'pinyin_choice' as const,
    order: i + 1,
    payload: { prompt: `Prompt ${i + 1}`, choices: ['a', 'b', 'c', 'd'], correctIndex: 0 },
  }))
}

describe('QuizPage', () => {
  it('renders 2 part cards', () => {
    render(<QuizPage part1Questions={makeQuestions(1, 15)} part2Questions={makeQuestions(2, 15)} />)
    expect(screen.getByText('Phần 1')).toBeInTheDocument()
    expect(screen.getByText('Phần 2')).toBeInTheDocument()
  })

  it('enters play mode for Part 1 when its card is clicked', () => {
    render(<QuizPage part1Questions={makeQuestions(1, 2)} part2Questions={makeQuestions(2, 2)} />)
    fireEvent.click(screen.getAllByText('Bắt đầu', { selector: 'button' })[0])
    expect(screen.getByText('Câu 1/2')).toBeInTheDocument()
  })

  it('shows the results screen with total score after completing a part', async () => {
    render(<QuizPage part1Questions={makeQuestions(1, 1)} part2Questions={makeQuestions(2, 1)} />)
    fireEvent.click(screen.getAllByText('Bắt đầu', { selector: 'button' })[0])
    fireEvent.click(screen.getByText('a')) // correct
    await waitFor(() => expect(screen.getByText('Hoàn thành')).toBeInTheDocument())
    fireEvent.click(screen.getByText('Hoàn thành'))

    expect(screen.getByText('1/1 câu đúng')).toBeInTheDocument()
    expect(screen.getByText('100%')).toBeInTheDocument()
  })

  describe('URL-backed part state (Fix 1)', () => {
    it('pushes ?part=1 to the URL when entering play mode for Part 1', () => {
      render(<QuizPage part1Questions={makeQuestions(1, 2)} part2Questions={makeQuestions(2, 2)} />)
      fireEvent.click(screen.getAllByText('Bắt đầu', { selector: 'button' })[0])
      expect(push).toHaveBeenCalledWith('/books/book-1/lessons/lesson-1/quiz?part=1')
    })

    it('renders the playing screen directly when ?part=2 is already in the URL', () => {
      currentSearch = 'part=2'
      render(<QuizPage part1Questions={makeQuestions(1, 2)} part2Questions={makeQuestions(2, 2)} />)
      expect(screen.getByText('Câu 1/2')).toBeInTheDocument()
    })

    it('replaces URL back to bare pathname (removing ?part) when returning to the part list', async () => {
      currentSearch = 'part=1'
      render(<QuizPage part1Questions={makeQuestions(1, 1)} part2Questions={makeQuestions(2, 1)} />)
      fireEvent.click(screen.getByText('a'))
      await waitFor(() => expect(screen.getByText('Hoàn thành')).toBeInTheDocument())
      fireEvent.click(screen.getByText('Hoàn thành'))
      await waitFor(() => expect(screen.getByText('1/1 câu đúng')).toBeInTheDocument())

      fireEvent.click(screen.getByText('Về danh sách Phần'))
      expect(replace).toHaveBeenCalledWith('/books/book-1/lessons/lesson-1/quiz')
    })
  })
})
