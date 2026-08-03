import { render, screen, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import ListeningChoiceQuestion from '@/app/(protected)/books/[bookId]/lessons/[lessonId]/quiz/questions/ListeningChoiceQuestion'

const payload = { audioUrl: 'https://example.com/audio.mp3', choices: ['汽車', '學校', '老師', '朋友'], correctIndex: 1 }

describe('ListeningChoiceQuestion', () => {
  beforeEach(() => {
    // jsdom has no real audio playback; stub Audio.play so clicking the
    // play button doesn't throw "not implemented".
    window.HTMLMediaElement.prototype.play = vi.fn().mockResolvedValue(undefined)
  })

  it('renders a play button and all 4 choices', () => {
    render(<ListeningChoiceQuestion payload={payload} onAnswer={vi.fn()} />)
    expect(screen.getByLabelText('Phát âm thanh')).toBeInTheDocument()
    payload.choices.forEach((choice) => {
      expect(screen.getByText(choice)).toBeInTheDocument()
    })
  })

  it('calls onAnswer(true, 1) when the correct choice is clicked', () => {
    const onAnswer = vi.fn()
    render(<ListeningChoiceQuestion payload={payload} onAnswer={onAnswer} />)
    fireEvent.click(screen.getByText('學校'))
    expect(onAnswer).toHaveBeenCalledWith(true, 1)
  })

  it('calls onAnswer(false, 0) when a wrong choice is clicked', () => {
    const onAnswer = vi.fn()
    render(<ListeningChoiceQuestion payload={payload} onAnswer={onAnswer} />)
    fireEvent.click(screen.getByText('汽車'))
    expect(onAnswer).toHaveBeenCalledWith(false, 0)
  })

  it('locks choices after answering', () => {
    const onAnswer = vi.fn()
    render(<ListeningChoiceQuestion payload={payload} onAnswer={onAnswer} />)
    fireEvent.click(screen.getByText('汽車'))
    fireEvent.click(screen.getByText('學校'))
    expect(onAnswer).toHaveBeenCalledTimes(1)
  })
})
