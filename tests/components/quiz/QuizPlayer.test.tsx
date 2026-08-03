import '@testing-library/jest-dom'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import QuizPlayer from '@/app/(protected)/books/[bookId]/lessons/[lessonId]/quiz/QuizPlayer'
import type { QuizQuestion } from '@/lib/db/types'

function makeQuestions(count: number): QuizQuestion[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `q${i + 1}`,
    lesson_id: 'lesson-1',
    part: 1 as const,
    type: 'pinyin_choice' as const,
    order: i + 1,
    payload: { prompt: `Prompt ${i + 1}`, choices: ['a', 'b', 'c', 'd'], correctIndex: 0 },
  }))
}

beforeEach(() => {
  // Question order and per-question answer-choice order are both shuffled;
  // random() just under 1 keeps every Fisher-Yates swap a no-op so tests can
  // rely on the input order unless a test explicitly forces a shuffle.
  vi.spyOn(Math, 'random').mockReturnValue(0.999)
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('QuizPlayer', () => {
  it('renders the first question and a progress indicator', () => {
    render(<QuizPlayer questions={makeQuestions(3)} onPartComplete={vi.fn()} />)
    expect(screen.getByText('Prompt 1')).toBeInTheDocument()
    expect(screen.getByText('Câu 1/3')).toBeInTheDocument()
  })

  it('advances to the next question after answering and clicking Tiếp', async () => {
    render(<QuizPlayer questions={makeQuestions(3)} onPartComplete={vi.fn()} />)
    fireEvent.click(screen.getByText('a')) // correct choice for question 1
    await waitFor(() => expect(screen.getByText('Tiếp')).toBeInTheDocument())
    fireEvent.click(screen.getByText('Tiếp'))
    expect(screen.getByText('Prompt 2')).toBeInTheDocument()
    expect(screen.getByText('Câu 2/3')).toBeInTheDocument()
  })

  it('calls onPartComplete with all results after answering the last question', async () => {
    const onPartComplete = vi.fn()
    render(<QuizPlayer questions={makeQuestions(2)} onPartComplete={onPartComplete} />)

    fireEvent.click(screen.getByText('a')) // Q1 correct
    await waitFor(() => expect(screen.getByText('Tiếp')).toBeInTheDocument())
    fireEvent.click(screen.getByText('Tiếp'))

    fireEvent.click(screen.getByText('b')) // Q2 wrong (correctIndex is 0)
    await waitFor(() => expect(screen.getByText('Hoàn thành')).toBeInTheDocument())
    fireEvent.click(screen.getByText('Hoàn thành'))

    expect(onPartComplete).toHaveBeenCalledWith([
      { questionId: 'q1', isCorrect: true, userAnswer: 0 },
      { questionId: 'q2', isCorrect: false, userAnswer: 1 },
    ])
  })

  it('shows "Hoàn thành" instead of "Tiếp" on the last question', async () => {
    render(<QuizPlayer questions={makeQuestions(1)} onPartComplete={vi.fn()} />)
    fireEvent.click(screen.getByText('a'))
    await waitFor(() => expect(screen.getByText('Hoàn thành')).toBeInTheDocument())
    expect(screen.queryByText('Tiếp')).not.toBeInTheDocument()
  })

  it('shuffles question order on mount (swaps the only pair in a 2-question list when random() forces the swap)', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0)
    render(<QuizPlayer questions={makeQuestions(2)} onPartComplete={vi.fn()} />)
    expect(screen.getByText('Prompt 2')).toBeInTheDocument()
    expect(screen.queryByText('Prompt 1')).not.toBeInTheDocument()
  })
})
