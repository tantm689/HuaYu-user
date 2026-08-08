import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import '@testing-library/jest-dom'
import ShadowingScreen from '@/app/(protected)/books/[bookId]/lessons/[lessonId]/dialogue/[dialogueId]/ShadowingScreen'
import type { Dialogue } from '@/lib/db/types'

const dialogue: Dialogue = {
  id: 'd1',
  order: 1,
  kind: 'dialogue',
  audio_url: null,
  lines: [
    { id: 'l1', order: 1, speaker_zh: null, text_zh: '你好嗎', pinyin: 'nǐ hǎo ma', translation_vi: 'bạn khỏe không', audio_url: null },
    { id: 'l2', order: 2, speaker_zh: null, text_zh: '我很好', pinyin: 'wǒ hěn hǎo', translation_vi: 'tôi khỏe', audio_url: null },
  ],
}

// --- MediaRecorder mock ---
let recorderInstances: any[] = []
class MockMediaRecorder {
  ondataavailable: ((e: any) => void) | null = null
  onstop: (() => void) | null = null
  state: 'inactive' | 'recording' = 'inactive'
  constructor(public stream: any) {
    recorderInstances.push(this)
  }
  start() {
    this.state = 'recording'
  }
  stop() {
    this.state = 'inactive'
    this.ondataavailable?.({ data: new Blob(['x']) })
    this.onstop?.()
  }
}
vi.stubGlobal('MediaRecorder', MockMediaRecorder)
vi.stubGlobal('URL', { createObjectURL: vi.fn(() => 'blob:mock'), revokeObjectURL: vi.fn() })

const getUserMediaMock = vi.fn().mockResolvedValue({ getTracks: () => [{ stop: vi.fn() }] })
vi.stubGlobal('navigator', { mediaDevices: { getUserMedia: getUserMediaMock } })

// --- SpeechRecognition mock ---
let lastRecognition: any = null
class MockSpeechRecognition {
  lang = ''
  continuous = false
  interimResults = false
  onresult: ((e: any) => void) | null = null
  onerror: (() => void) | null = null
  onend: (() => void) | null = null
  start = vi.fn()
  stop = vi.fn()
  constructor() {
    // eslint-disable-next-line @typescript-eslint/no-this-alias -- test double needs to capture the instance for assertions
    lastRecognition = this
  }
}
vi.stubGlobal('webkitSpeechRecognition', MockSpeechRecognition)

beforeEach(() => {
  recorderInstances = []
  lastRecognition = null
  getUserMediaMock.mockClear()
})

describe('ShadowingScreen', () => {
  it('shows the first line and disables "Phát lại ghi âm" before any recording exists', () => {
    render(<ShadowingScreen dialogue={dialogue} />)
    expect(screen.getByText('你好嗎')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Phát lại ghi âm/i })).toBeDisabled()
  })

  it('starts MediaRecorder and SpeechRecognition together when "Ghi âm" is clicked', async () => {
    render(<ShadowingScreen dialogue={dialogue} />)
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /^Ghi âm$/i }))
    })
    expect(getUserMediaMock).toHaveBeenCalled()
    expect(recorderInstances[0].state).toBe('recording')
    expect(lastRecognition.start).toHaveBeenCalled()
    expect(lastRecognition.lang).toBe('zh-TW')
  })

  it('grades automatically and shows a correct result once recording stops with a matching transcript', async () => {
    render(<ShadowingScreen dialogue={dialogue} />)
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /^Ghi âm$/i }))
    })
    act(() => {
      lastRecognition.onresult({ results: [[{ transcript: '你好嗎' }]] })
    })
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: /Dừng ghi âm/i }))
    })
    expect(screen.getByText(/Phát âm chính xác/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Phát lại ghi âm/i })).toBeEnabled()
  })
})
