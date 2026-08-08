import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom'
import ListenTab from '@/app/(protected)/books/[bookId]/lessons/[lessonId]/dialogue/[dialogueId]/ListenTab'
import type { Dialogue } from '@/lib/db/types'

const playMock = vi.fn().mockResolvedValue(undefined)
const pauseMock = vi.fn()

class MockAudio {
  currentTime = 0
  onended: (() => void) | null = null
  constructor(public src: string) {}
  play = playMock
  pause = pauseMock
}

vi.stubGlobal('Audio', MockAudio)

const dialogue: Dialogue = {
  id: 'd1',
  order: 1,
  kind: 'dialogue',
  audio_url: null,
  lines: [
    { id: 'l1', order: 1, speaker_zh: '小明', text_zh: '你好嗎', pinyin: 'nǐ hǎo ma', translation_vi: 'bạn khỏe không', audio_url: 'l1.mp3' },
    { id: 'l2', order: 2, speaker_zh: '小美', text_zh: '我很好', pinyin: 'wǒ hěn hǎo', translation_vi: 'tôi khỏe', audio_url: 'l2.mp3' },
    { id: 'l3', order: 3, speaker_zh: '小明', text_zh: '謝謝', pinyin: 'xiè xiè', translation_vi: 'cảm ơn', audio_url: null },
    { id: 'l4', order: 4, speaker_zh: null, text_zh: '（旁白）', pinyin: null, translation_vi: null, audio_url: null },
  ],
}

beforeEach(() => {
  playMock.mockClear()
  pauseMock.mockClear()
})

describe('ListenTab', () => {
  it('renders every line with its Hanzi, pinyin, and translation, and shows a full-name avatar per speaker', () => {
    render(<ListenTab dialogue={dialogue} />)
    expect(screen.getByText('你好嗎')).toBeInTheDocument()
    expect(screen.getByText('nǐ hǎo ma')).toBeInTheDocument()
    expect(screen.getByText('bạn khỏe không')).toBeInTheDocument()
    expect(screen.getByText('我很好')).toBeInTheDocument()
    // Two distinct speakers, full name shown twice each as an avatar label.
    expect(screen.getAllByText('小明')).toHaveLength(2) // avatar label appears for l1 and l3
    expect(screen.getAllByText('小美')).toHaveLength(1)
  })

  it('plays a line\'s audio when its card is clicked', () => {
    render(<ListenTab dialogue={dialogue} />)
    fireEvent.click(screen.getByText('你好嗎'))
    expect(playMock).toHaveBeenCalled()
  })

  it('does not crash and disables play for a line with no audio_url', () => {
    render(<ListenTab dialogue={dialogue} />)
    const thirdLineButton = screen.getByText('謝謝').closest('button')
    expect(thirdLineButton).toBeDisabled()
    if (thirdLineButton) fireEvent.click(thirdLineButton)
    expect(playMock).not.toHaveBeenCalled()
  })

  it('shows pinyin and translation by default, and hides both when the toggle is clicked', () => {
    render(<ListenTab dialogue={dialogue} />)
    expect(screen.getByText('nǐ hǎo ma')).toBeInTheDocument()
    expect(screen.getByText('bạn khỏe không')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /Ẩn pinyin.*nghĩa|Hiện pinyin.*nghĩa/i }))

    expect(screen.queryByText('nǐ hǎo ma')).not.toBeInTheDocument()
    expect(screen.queryByText('bạn khỏe không')).not.toBeInTheDocument()
    // Hanzi always stays visible regardless of the toggle.
    expect(screen.getByText('你好嗎')).toBeInTheDocument()
  })

  it('assigns consistent alternating colors per speaker across repeated appearances', () => {
    render(<ListenTab dialogue={dialogue} />)
    const firstAvatar = screen.getAllByText('小明')[0]
    const thirdAvatar = screen.getAllByText('小明')[1]
    // Same speaker's two avatar instances must share the same background color class.
    const firstClasses = firstAvatar.className
    const thirdClasses = thirdAvatar.className
    expect(firstClasses).toBe(thirdClasses)
  })

  it('reserves the same avatar-slot space for lines with no speaker_zh, keeping bubble left edges aligned', () => {
    render(<ListenTab dialogue={dialogue} />)

    // Sanity check: the speaker-less line still renders its text and isn't skipped.
    const noSpeakerText = screen.getByText('（旁白）')
    expect(noSpeakerText).toBeInTheDocument()

    // The row's outer flex container's first child should be a same-sized (w-10) slot
    // regardless of whether the line has a speaker_zh, so bubbles stay left-aligned.
    const noSpeakerRow = noSpeakerText.closest('button')?.parentElement
    const noSpeakerFirstChild = noSpeakerRow?.firstElementChild
    expect(noSpeakerFirstChild).not.toBeNull()
    expect(noSpeakerFirstChild?.className).toContain('w-10')
    expect(noSpeakerFirstChild).toHaveAttribute('aria-hidden', 'true')

    const withSpeakerText = screen.getByText('你好嗎')
    const withSpeakerRow = withSpeakerText.closest('button')?.parentElement
    const withSpeakerFirstChild = withSpeakerRow?.firstElementChild
    expect(withSpeakerFirstChild?.className).toContain('w-10')

    // Both rows' outer containers have a structurally symmetric first child (a tag name match).
    expect(noSpeakerFirstChild?.tagName).toBe(withSpeakerFirstChild?.tagName)
  })
})
