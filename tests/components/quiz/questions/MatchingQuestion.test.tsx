import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import { describe, it, expect, vi } from 'vitest'
import MatchingQuestion from '@/app/(protected)/books/[bookId]/lessons/[lessonId]/quiz/questions/MatchingQuestion'

const payload = {
  pairs: [
    { left: '汽車', right: 'xe hơi' },
    { left: '學校', right: 'trường học' },
    { left: '老師', right: 'giáo viên' },
    { left: '朋友', right: 'bạn bè' },
    { left: '書', right: 'sách' },
  ],
}

describe('MatchingQuestion', () => {
  it('renders all 5 left items and all 5 right items', () => {
    render(<MatchingQuestion payload={payload} onAnswer={vi.fn()} />)
    payload.pairs.forEach((pair) => {
      expect(screen.getByText(pair.left)).toBeInTheDocument()
      expect(screen.getByText(pair.right)).toBeInTheDocument()
    })
  })

  it('locks a pair green when a correct left+right combination is selected', async () => {
    render(<MatchingQuestion payload={payload} onAnswer={vi.fn()} />)
    fireEvent.click(screen.getByText('汽車'))
    fireEvent.click(screen.getByText('xe hơi'))
    await waitFor(() => {
      expect(screen.getByText('汽車').closest('button')).toHaveClass('border-success-border')
    })
  })

  it('calls onAnswer(true) once all 5 pairs are matched correctly with no wrong attempts', async () => {
    const onAnswer = vi.fn()
    render(<MatchingQuestion payload={payload} onAnswer={onAnswer} />)
    for (const pair of payload.pairs) {
      fireEvent.click(screen.getByText(pair.left))
      fireEvent.click(screen.getByText(pair.right))
      await waitFor(() => {
        expect(screen.getByText(pair.left).closest('button')).toHaveClass('border-success-border')
      })
    }
    expect(onAnswer).toHaveBeenCalledWith(true, 0)
  })

  it('calls onAnswer(false, 1) once all pairs are eventually matched but a wrong attempt happened along the way', async () => {
    const onAnswer = vi.fn()
    render(<MatchingQuestion payload={payload} onAnswer={onAnswer} />)

    // Wrong attempt: 汽車 matched with the wrong right-side text.
    fireEvent.click(screen.getByText('汽車'))
    fireEvent.click(screen.getByText('trường học'))
    await waitFor(() => {
      expect(screen.getByText('汽車').closest('button')).not.toBeDisabled()
    })

    // Now match all 5 correctly.
    for (const pair of payload.pairs) {
      fireEvent.click(screen.getByText(pair.left))
      fireEvent.click(screen.getByText(pair.right))
      await waitFor(() => {
        expect(screen.getByText(pair.left).closest('button')).toHaveClass('border-success-border')
      })
    }

    expect(onAnswer).toHaveBeenCalledWith(true, 1)
    expect(onAnswer).toHaveBeenCalledTimes(1)
  })

  it('allows matching bidirectionally by selecting right item first, then left item', async () => {
    render(<MatchingQuestion payload={payload} onAnswer={vi.fn()} />)
    fireEvent.click(screen.getByText('xe hơi')) // right item first
    fireEvent.click(screen.getByText('汽車')) // left item second
    await waitFor(() => {
      expect(screen.getByText('汽車').closest('button')).toHaveClass('border-success-border')
      expect(screen.getByText('xe hơi').closest('button')).toHaveClass('border-success-border')
    })
  })
})
