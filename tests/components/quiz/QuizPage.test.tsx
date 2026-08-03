import '@testing-library/jest-dom'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import QuizPage from '@/app/(protected)/books/[bookId]/lessons/[lessonId]/quiz/QuizPage'
import type { QuizQuestion } from '@/lib/db/types'
import * as browserSupabase from '@/lib/supabase/browser'

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

function mockSupabaseInsert() {
  const insert = vi.fn().mockResolvedValue({ error: null })
  const fakeClient = { from: vi.fn().mockReturnValue({ insert }) }
  vi.spyOn(browserSupabase, 'createBrowserSupabase').mockReturnValue(fakeClient as never)
  return { insert, fakeClient }
}

describe('QuizPage', () => {
  it('renders 2 part cards with no score badge when no attempts exist', () => {
    render(
      <QuizPage
        lessonId="lesson-1"
        part1Questions={makeQuestions(1, 15)}
        part2Questions={makeQuestions(2, 15)}
        bestScores={{ part1: null, part2: null }}
      />
    )
    expect(screen.getByText('Phần 1')).toBeInTheDocument()
    expect(screen.getByText('Phần 2')).toBeInTheDocument()
    expect(screen.queryByText(/Điểm cao nhất/)).not.toBeInTheDocument()
  })

  it('shows best score badge for a part that has been attempted', () => {
    render(
      <QuizPage
        lessonId="lesson-1"
        part1Questions={makeQuestions(1, 15)}
        part2Questions={makeQuestions(2, 15)}
        bestScores={{ part1: 12, part2: null }}
      />
    )
    expect(screen.getByText('Điểm cao nhất: 12/15')).toBeInTheDocument()
  })

  it('enters play mode for Part 1 when its card is clicked', () => {
    render(
      <QuizPage
        lessonId="lesson-1"
        part1Questions={makeQuestions(1, 2)}
        part2Questions={makeQuestions(2, 2)}
        bestScores={{ part1: null, part2: null }}
      />
    )
    fireEvent.click(screen.getAllByText('Bắt đầu', { selector: 'button' })[0])
    expect(screen.getByText('Câu 1/2')).toBeInTheDocument()
  })

  it('shows the results screen with total score after completing a part, and records the attempt', async () => {
    const { insert } = mockSupabaseInsert()
    render(
      <QuizPage
        lessonId="lesson-1"
        part1Questions={makeQuestions(1, 1)}
        part2Questions={makeQuestions(2, 1)}
        bestScores={{ part1: null, part2: null }}
      />
    )
    fireEvent.click(screen.getAllByText('Bắt đầu', { selector: 'button' })[0])
    fireEvent.click(screen.getByText('a')) // correct
    await waitFor(() => expect(screen.getByText('Hoàn thành')).toBeInTheDocument())
    fireEvent.click(screen.getByText('Hoàn thành'))

    expect(screen.getByText('1/1')).toBeInTheDocument()
    await waitFor(() => {
      expect(insert).toHaveBeenCalledWith({ lesson_id: 'lesson-1', part: 1, score: 1, total: 1 })
    })
  })

  it('shows a retry button and error message when recording the attempt fails', async () => {
    const insert = vi.fn().mockResolvedValue({ error: { message: 'network down' } })
    const fakeClient = { from: vi.fn().mockReturnValue({ insert }) }
    vi.spyOn(browserSupabase, 'createBrowserSupabase').mockReturnValue(fakeClient as never)

    render(
      <QuizPage
        lessonId="lesson-1"
        part1Questions={makeQuestions(1, 1)}
        part2Questions={makeQuestions(2, 1)}
        bestScores={{ part1: null, part2: null }}
      />
    )
    fireEvent.click(screen.getAllByText('Bắt đầu', { selector: 'button' })[0])
    fireEvent.click(screen.getByText('a'))
    await waitFor(() => expect(screen.getByText('Hoàn thành')).toBeInTheDocument())
    fireEvent.click(screen.getByText('Hoàn thành'))

    await waitFor(() => {
      expect(screen.getByText('Không lưu được, kiểm tra kết nối mạng.')).toBeInTheDocument()
    })
    expect(screen.getByText('Thử lại')).toBeInTheDocument()
  })
})
