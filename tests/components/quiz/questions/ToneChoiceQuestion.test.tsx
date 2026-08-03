import { render, screen, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom'
import { describe, it, expect, vi } from 'vitest'
import ToneChoiceQuestion from '@/app/(protected)/books/[bookId]/lessons/[lessonId]/quiz/questions/ToneChoiceQuestion'

const payload = { wordZh: '汽車', pinyinNoTone: 'qi che', choices: ['qì chē', 'qí chē', 'qǐ chē', 'qī chè'], correctIndex: 0 }

describe('ToneChoiceQuestion', () => {
  it('renders the word and all 4 pinyin choices', () => {
    render(<ToneChoiceQuestion payload={payload} onAnswer={vi.fn()} />)
    expect(screen.getByText('汽車')).toBeInTheDocument()
    payload.choices.forEach((choice) => {
      expect(screen.getByText(choice)).toBeInTheDocument()
    })
  })

  it('calls onAnswer(true, 0) for the correct tone choice', () => {
    const onAnswer = vi.fn()
    render(<ToneChoiceQuestion payload={payload} onAnswer={onAnswer} />)
    fireEvent.click(screen.getByText('qì chē'))
    expect(onAnswer).toHaveBeenCalledWith(true, 0)
  })

  it('calls onAnswer(false, 1) for a wrong tone choice', () => {
    const onAnswer = vi.fn()
    render(<ToneChoiceQuestion payload={payload} onAnswer={onAnswer} />)
    fireEvent.click(screen.getByText('qí chē'))
    expect(onAnswer).toHaveBeenCalledWith(false, 1)
  })

  it('locks choices after answering', () => {
    const onAnswer = vi.fn()
    render(<ToneChoiceQuestion payload={payload} onAnswer={onAnswer} />)
    fireEvent.click(screen.getByText('qí chē'))
    fireEvent.click(screen.getByText('qì chē'))
    expect(onAnswer).toHaveBeenCalledTimes(1)
  })
})
