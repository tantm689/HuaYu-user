import { render, screen, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom'
import { describe, it, expect, vi } from 'vitest'
import FillBlankQuestion from '@/app/(protected)/books/[bookId]/lessons/[lessonId]/quiz/questions/FillBlankQuestion'

const payload = {
  contextSentence: '你今天要做什麼？',
  sentence: '我 ___ 學校。',
  choices: ['去', '很', '在', '和'],
  correctIndex: 0,
}

describe('FillBlankQuestion', () => {
  it('renders the context sentence, the blanked sentence, and all 4 choices', () => {
    render(<FillBlankQuestion payload={payload} onAnswer={vi.fn()} />)
    expect(screen.getByText('你今天要做什麼？')).toBeInTheDocument()
    expect(screen.getByText('我 ___ 學校。')).toBeInTheDocument()
    payload.choices.forEach((choice) => {
      expect(screen.getByText(choice)).toBeInTheDocument()
    })
  })

  it('calls onAnswer(true) for the correct choice', () => {
    const onAnswer = vi.fn()
    render(<FillBlankQuestion payload={payload} onAnswer={onAnswer} />)
    fireEvent.click(screen.getByText('去'))
    expect(onAnswer).toHaveBeenCalledWith(true)
  })

  it('calls onAnswer(false) for a wrong choice', () => {
    const onAnswer = vi.fn()
    render(<FillBlankQuestion payload={payload} onAnswer={onAnswer} />)
    fireEvent.click(screen.getByText('很'))
    expect(onAnswer).toHaveBeenCalledWith(false)
  })

  it('locks choices after answering', () => {
    const onAnswer = vi.fn()
    render(<FillBlankQuestion payload={payload} onAnswer={onAnswer} />)
    fireEvent.click(screen.getByText('很'))
    fireEvent.click(screen.getByText('去'))
    expect(onAnswer).toHaveBeenCalledTimes(1)
  })
})
