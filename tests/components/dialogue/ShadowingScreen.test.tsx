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
    { id: 'l1', order: 1, speaker_zh: null, text_zh: '你好嗎', pinyin: 'nǐ hǎo ma', translation_vi: 'bạn khỏe không', audio_url: 'l1.mp3' },
    { id: 'l2', order: 2, speaker_zh: null, text_zh: '我很好', pinyin: 'wǒ hěn hǎo', translation_vi: 'tôi khỏe', audio_url: 'l2.mp3' },
  ],
}

// --- Audio mock ---
const playMock = vi.fn().mockResolvedValue(undefined)
const pauseMock = vi.fn()
const audioInstances: MockAudio[] = []

class MockAudio {
  currentTime = 0
  onended: (() => void) | null = null
  constructor(public src: string) {
    audioInstances.push(this)
  }
  play = playMock
  pause = pauseMock
}
vi.stubGlobal('Audio', MockAudio)

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
  audioInstances.length = 0
  playMock.mockClear()
  pauseMock.mockClear()
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
      lastRecognition.onend()
    })
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: /Dừng ghi âm/i }))
    })
    expect(screen.getByText(/Phát âm chính xác/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Phát lại ghi âm/i })).toBeEnabled()
  })

  it('grades correctly even when SpeechRecognition settles AFTER the user clicks stop (realistic race)', async () => {
    // In real Chrome/Edge, onresult/onend often arrive after the user has
    // already clicked "stop" - MediaRecorder.onstop must NOT grade using a
    // stale/empty transcript; grading must wait for recognition's onend.
    render(<ShadowingScreen dialogue={dialogue} />)
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /^Ghi âm$/i }))
    })

    // User clicks stop first - MediaRecorder.onstop fires immediately.
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: /Dừng ghi âm/i }))
    })

    // No result yet: grading must not have produced a stale/incorrect verdict.
    expect(screen.queryByText(/Chưa chính xác/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/Phát âm chính xác/i)).not.toBeInTheDocument()

    // SpeechRecognition catches up asynchronously, after the stop click.
    act(() => {
      lastRecognition.onresult({ results: [[{ transcript: '你好嗎' }]] })
    })
    act(() => {
      lastRecognition.onend()
    })

    expect(screen.getByText(/Phát âm chính xác/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Phát lại ghi âm/i })).toBeEnabled()
  })

  it('grades an empty transcript (not a hang) when recognition ends without any result', async () => {
    render(<ShadowingScreen dialogue={dialogue} />)
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /^Ghi âm$/i }))
    })
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: /Dừng ghi âm/i }))
    })
    // Recognition ends with no result at all (e.g. no-speech error).
    act(() => {
      lastRecognition.onend()
    })
    expect(screen.getByText(/không nghe rõ/i)).toBeInTheDocument()
  })

  it('shows the "Tự động dừng" toggle, defaulting to ON', () => {
    render(<ShadowingScreen dialogue={dialogue} />)
    const toggle = screen.getByRole('switch', { name: /Tự động dừng/i })
    expect(toggle).toHaveAttribute('aria-checked', 'true')
  })

  it('plays the current line\'s audio when the play button is clicked', () => {
    render(<ShadowingScreen dialogue={dialogue} />)
    fireEvent.click(screen.getByRole('button', { name: /^Nghe mẫu$/i }))
    expect(playMock).toHaveBeenCalled()
    expect(audioInstances[0].src).toBe('l1.mp3')
  })

  it('does not advance to the next line when auto-pause is ON and playback ends', () => {
    render(<ShadowingScreen dialogue={dialogue} />)
    fireEvent.click(screen.getByRole('button', { name: /^Nghe mẫu$/i }))
    act(() => {
      audioInstances[0].onended?.()
    })
    expect(screen.getByRole('heading', { name: '你好嗎' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: '我很好' })).not.toBeInTheDocument()
  })

  it('advances to the next line and keeps playing when auto-pause is OFF and playback ends', () => {
    render(<ShadowingScreen dialogue={dialogue} />)
    fireEvent.click(screen.getByRole('switch', { name: /Tự động dừng/i }))
    fireEvent.click(screen.getByRole('button', { name: /^Nghe mẫu$/i }))
    act(() => {
      audioInstances[0].onended?.()
    })
    expect(screen.getByText('我很好')).toBeInTheDocument()
    expect(audioInstances[1]?.src).toBe('l2.mp3')
  })

  it('does not grade or show a result when auto-pause is OFF, even after recording stops with a transcript', async () => {
    render(<ShadowingScreen dialogue={dialogue} />)
    fireEvent.click(screen.getByRole('switch', { name: /Tự động dừng/i }))

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /^Ghi âm$/i }))
    })
    act(() => {
      lastRecognition.onresult({ results: [[{ transcript: '你好嗎' }]] })
    })
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: /Dừng ghi âm/i }))
    })
    act(() => {
      lastRecognition.onend()
    })

    expect(screen.queryByText(/Phát âm chính xác/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/Chưa chính xác/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/không nghe rõ/i)).not.toBeInTheDocument()
    // Recording itself still works: replay button is enabled once stopped.
    expect(screen.getByRole('button', { name: /Phát lại ghi âm/i })).toBeEnabled()
  })

  it('pauses in-flight sample playback when recording starts during continuous mode', async () => {
    render(<ShadowingScreen dialogue={dialogue} />)
    fireEvent.click(screen.getByRole('switch', { name: /Tự động dừng/i }))

    fireEvent.click(screen.getByRole('button', { name: /^Nghe mẫu$/i }))
    expect(playMock).toHaveBeenCalled()
    pauseMock.mockClear()

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /^Ghi âm$/i }))
    })

    expect(pauseMock).toHaveBeenCalled()
  })

  it('still grades normally when auto-pause is ON (unchanged default behavior)', async () => {
    render(<ShadowingScreen dialogue={dialogue} />)
    // Toggle defaults to ON - do not click it.
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /^Ghi âm$/i }))
    })
    act(() => {
      lastRecognition.onresult({ results: [[{ transcript: '你好嗎' }]] })
    })
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: /Dừng ghi âm/i }))
    })
    act(() => {
      lastRecognition.onend()
    })
    expect(screen.getByText(/Phát âm chính xác/i)).toBeInTheDocument()
  })
})
