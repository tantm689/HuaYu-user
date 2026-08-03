import { render, screen, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom'
import { describe, it, expect, vi } from 'vitest'
import SentenceOrderQuestion from '@/app/(protected)/books/[bookId]/lessons/[lessonId]/quiz/questions/SentenceOrderQuestion'

// words[2]="我" words[0]="去" words[1]="學校" ; correct sentence = "我去學校" = indices [2,0,1]
const payload = { words: ['去', '學校', '我'], correctOrder: [2, 0, 1] }

describe('SentenceOrderQuestion', () => {
  it('renders all words in the "remaining" area initially', () => {
    render(<SentenceOrderQuestion payload={payload} onAnswer={vi.fn()} />)
    payload.words.forEach((word) => {
      expect(screen.getByText(word)).toBeInTheDocument()
    })
  })

  it('does not show a "Kiểm tra" button until all words are picked', () => {
    render(<SentenceOrderQuestion payload={payload} onAnswer={vi.fn()} />)
    fireEvent.click(screen.getByText('我'))
    expect(screen.queryByText('Kiểm tra')).not.toBeInTheDocument()
  })

  it('calls onAnswer(true) when words are picked in the correct order and checked', () => {
    const onAnswer = vi.fn()
    render(<SentenceOrderQuestion payload={payload} onAnswer={onAnswer} />)
    fireEvent.click(screen.getByText('我'))
    fireEvent.click(screen.getByText('去'))
    fireEvent.click(screen.getByText('學校'))
    fireEvent.click(screen.getByText('Kiểm tra'))
    expect(onAnswer).toHaveBeenCalledWith(true)
  })

  it('calls onAnswer(false) when words are picked in the wrong order and checked', () => {
    const onAnswer = vi.fn()
    render(<SentenceOrderQuestion payload={payload} onAnswer={onAnswer} />)
    fireEvent.click(screen.getByText('去'))
    fireEvent.click(screen.getByText('我'))
    fireEvent.click(screen.getByText('學校'))
    fireEvent.click(screen.getByText('Kiểm tra'))
    expect(onAnswer).toHaveBeenCalledWith(false)
  })

  it('allows un-picking a word by clicking it again in the built sentence', () => {
    render(<SentenceOrderQuestion payload={payload} onAnswer={vi.fn()} />)
    fireEvent.click(screen.getByText('我'))
    fireEvent.click(screen.getByText('我')) // click again to remove from built area
    expect(screen.queryByText('Kiểm tra')).not.toBeInTheDocument()
  })
})
