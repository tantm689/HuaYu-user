import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import VocabTypingTab from '@/app/(protected)/books/[bookId]/lessons/[lessonId]/typing/VocabTypingTab'

const vocabulary = [
  { id: 'v1', dialogue_id: 'd1', order: 1, word_zh: '你好', pinyin: 'nǐ hǎo', meaning_vi: 'xin chào', audio_url: null },
  { id: 'v2', dialogue_id: 'd1', order: 2, word_zh: '謝謝', pinyin: 'xiè xiè', meaning_vi: 'cảm ơn', audio_url: null },
]

describe('VocabTypingTab', () => {
  it('renders one row per vocabulary item showing meaning_vi, not word_zh', () => {
    render(<VocabTypingTab vocabulary={vocabulary} />)
    expect(screen.getByText('xin chào')).toBeInTheDocument()
    expect(screen.getByText('cảm ơn')).toBeInTheDocument()
    expect(screen.queryByText('你好')).not.toBeInTheDocument()
  })

  it('marks a row correct on blur when the typed word matches', async () => {
    render(<VocabTypingTab vocabulary={vocabulary} />)
    const input = screen.getByLabelText('xin chào')
    fireEvent.change(input, { target: { value: '你好' } })
    fireEvent.blur(input)

    await waitFor(() => expect(input).toHaveAttribute('data-state', 'correct'))
  })

  it('marks a row incorrect on Enter when the typed word does not match', async () => {
    render(<VocabTypingTab vocabulary={vocabulary} />)
    const input = screen.getByLabelText('cảm ơn')
    fireEvent.change(input, { target: { value: '不對' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    await waitFor(() => expect(input).toHaveAttribute('data-state', 'incorrect'))
  })

  it('allows retyping and re-grading the same row after it was marked incorrect', async () => {
    render(<VocabTypingTab vocabulary={vocabulary} />)
    const input = screen.getByLabelText('xin chào')

    fireEvent.change(input, { target: { value: 'sai' } })
    fireEvent.blur(input)
    await waitFor(() => expect(input).toHaveAttribute('data-state', 'incorrect'))

    fireEvent.change(input, { target: { value: '你好' } })
    fireEvent.blur(input)
    await waitFor(() => expect(input).toHaveAttribute('data-state', 'correct'))
  })

  it('does not grade an untouched row on blur with an empty value', async () => {
    render(<VocabTypingTab vocabulary={vocabulary} />)
    const input = screen.getByLabelText('xin chào')

    fireEvent.blur(input)

    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(input).not.toHaveAttribute('data-state')
  })
})
