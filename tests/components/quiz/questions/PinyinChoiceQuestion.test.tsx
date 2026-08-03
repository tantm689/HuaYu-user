import { render, screen, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom'
import { describe, it, expect, vi } from 'vitest'
import PinyinChoiceQuestion from '@/app/(protected)/books/[bookId]/lessons/[lessonId]/quiz/questions/PinyinChoiceQuestion'

const payload = { prompt: '汽車', choices: ['qì chē', 'qí chē', 'qǐ chē', 'qì chě'], correctIndex: 0 }

describe('PinyinChoiceQuestion', () => {
  it('renders the prompt and all 4 choices', () => {
    render(<PinyinChoiceQuestion payload={payload} onAnswer={vi.fn()} />)
    expect(screen.getByText('汽車')).toBeInTheDocument()
    payload.choices.forEach((choice) => {
      expect(screen.getByText(choice)).toBeInTheDocument()
    })
  })

  it('calls onAnswer(true, 0) when the correct choice is clicked', () => {
    const onAnswer = vi.fn()
    render(<PinyinChoiceQuestion payload={payload} onAnswer={onAnswer} />)
    fireEvent.click(screen.getByText('qì chē'))
    expect(onAnswer).toHaveBeenCalledWith(true, 0)
  })

  it('calls onAnswer(false, 1) when a wrong choice is clicked', () => {
    const onAnswer = vi.fn()
    render(<PinyinChoiceQuestion payload={payload} onAnswer={onAnswer} />)
    fireEvent.click(screen.getByText('qí chē'))
    expect(onAnswer).toHaveBeenCalledWith(false, 1)
  })

  it('locks choices after answering — a second click does not call onAnswer again', () => {
    const onAnswer = vi.fn()
    render(<PinyinChoiceQuestion payload={payload} onAnswer={onAnswer} />)
    fireEvent.click(screen.getByText('qí chē'))
    fireEvent.click(screen.getByText('qì chē'))
    expect(onAnswer).toHaveBeenCalledTimes(1)
  })

  it('shows the correct answer highlighted after a wrong pick', () => {
    render(<PinyinChoiceQuestion payload={payload} onAnswer={vi.fn()} />)
    fireEvent.click(screen.getByText('qí chē'))
    expect(screen.getByText('qì chē').closest('button')).toHaveClass('border-success-border')
  })
})
