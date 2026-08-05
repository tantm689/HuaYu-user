import { render, screen, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom'
import { describe, it, expect, vi } from 'vitest'
import FillBlankQuestion from '@/app/(protected)/books/[bookId]/lessons/[lessonId]/quiz/questions/FillBlankQuestion'

const payload = {
  sentence: '你今天要做什麼？我 ___ 學校。',
  choices: ['去', '很', '在', '和'],
  correctIndex: 0,
}

describe('FillBlankQuestion', () => {
  it('renders the sentence (context + blank combined) and all 4 choices', () => {
    render(<FillBlankQuestion payload={payload} onAnswer={vi.fn()} />)
    expect(screen.getByText('你今天要做什麼？我 ___ 學校。')).toBeInTheDocument()
    payload.choices.forEach((choice) => {
      expect(screen.getByText(choice)).toBeInTheDocument()
    })
  })

  it('calls onAnswer(true, 0) for the correct choice', () => {
    const onAnswer = vi.fn()
    render(<FillBlankQuestion payload={payload} onAnswer={onAnswer} />)
    fireEvent.click(screen.getByText('去'))
    expect(onAnswer).toHaveBeenCalledWith(true, 0)
  })

  it('calls onAnswer(false, 1) for a wrong choice', () => {
    const onAnswer = vi.fn()
    render(<FillBlankQuestion payload={payload} onAnswer={onAnswer} />)
    fireEvent.click(screen.getByText('很'))
    expect(onAnswer).toHaveBeenCalledWith(false, 1)
  })

  it('locks choices after answering', () => {
    const onAnswer = vi.fn()
    render(<FillBlankQuestion payload={payload} onAnswer={onAnswer} />)
    fireEvent.click(screen.getByText('很'))
    fireEvent.click(screen.getByText('去'))
    expect(onAnswer).toHaveBeenCalledTimes(1)
  })

  // The Admin app joins a context sentence and the blanked sentence with a
  // literal "\n" when they're two different speakers' turns in the
  // original dialogue - a plain <p> collapses that into one run-on line
  // (real browsers and jsdom's textContent both do this), so the sentence
  // element needs a CSS rule that actually preserves it as a line break.
  it('preserves a literal newline in the sentence as a real line break (whitespace-pre-line), not collapsed run-on text', () => {
    const twoSpeakerPayload = {
      sentence: '這是烏龍茶。臺灣人喜歡喝茶。\n開文，你們日本人___?',
      choices: ['呢', '嗎', '不', '很'],
      correctIndex: 0,
    }
    const { container } = render(<FillBlankQuestion payload={twoSpeakerPayload} onAnswer={vi.fn()} />)
    const sentenceEl = container.querySelector('p.whitespace-pre-line')
    expect(sentenceEl).not.toBeNull()
    expect(sentenceEl?.textContent).toBe('這是烏龍茶。臺灣人喜歡喝茶。\n開文，你們日本人___?')
  })
})
