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
  ],
}

beforeEach(() => {
  playMock.mockClear()
  pauseMock.mockClear()
})

describe('ListenTab', () => {
  it('renders every line with its Hanzi, pinyin, and translation', () => {
    render(<ListenTab dialogue={dialogue} />)
    expect(screen.getByText('你好嗎')).toBeInTheDocument()
    expect(screen.getByText('nǐ hǎo ma')).toBeInTheDocument()
    expect(screen.getByText('bạn khỏe không')).toBeInTheDocument()
    expect(screen.getByText('我很好')).toBeInTheDocument()
  })

  it('plays a line\'s audio when its card is clicked', () => {
    render(<ListenTab dialogue={dialogue} />)
    fireEvent.click(screen.getByText('你好嗎'))
    expect(playMock).toHaveBeenCalled()
  })
})
