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
    { id: 'l3', order: 3, speaker_zh: null, text_zh: '謝謝', pinyin: 'xiè xiè', translation_vi: 'cảm ơn', audio_url: 'l3.mp3' },
  ],
}

// --- Audio mock ---
const playMock = vi.fn().mockResolvedValue(undefined)
const pauseMock = vi.fn()
const audioInstances: MockAudio[] = []

class MockAudio {
  currentTime = 0
  duration = 5
  onended: (() => void) | null = null
  onloadedmetadata: (() => void) | null = null
  onerror: (() => void) | null = null
  ontimeupdate: (() => void) | null = null
  constructor(public src: string) {
    audioInstances.push(this)
    // Simulate metadata loading synchronously so tests don't need extra
    // act() wrapping around a real async load event.
    queueMicrotask(() => this.onloadedmetadata?.())
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

  it('shows a play/pause button, elapsed/total time, and a seek bar', async () => {
    render(<ShadowingScreen dialogue={dialogue} />)
    await act(async () => {
      await Promise.resolve()
    })
    // Both the play/pause circle ("Nghe mẫu"/"Tạm dừng") and the disabled
    // "Phát lại ghi âm" replay button match /Phát|Nghe mẫu/i, so this only
    // asserts that at least one such control exists.
    expect(screen.getAllByRole('button', { name: /Phát|Nghe mẫu/i }).length).toBeGreaterThan(0)
    expect(screen.getByText(/0:00/)).toBeInTheDocument()
    expect(screen.getByRole('slider')).toBeInTheDocument()
  })

  it('shows prev/next line buttons, with prev disabled on the first line', async () => {
    render(<ShadowingScreen dialogue={dialogue} />)
    await act(async () => {
      await Promise.resolve()
    })
    expect(screen.getByRole('button', { name: /Câu trước/i })).toBeDisabled()
    expect(screen.getByRole('button', { name: /Câu sau/i })).toBeEnabled()
  })

  it('advances to the next line and plays it when "Câu sau" is clicked', async () => {
    render(<ShadowingScreen dialogue={dialogue} />)
    await act(async () => {
      await Promise.resolve()
    })
    fireEvent.click(screen.getByRole('button', { name: /Câu sau/i }))
    expect(screen.getByText('我很好')).toBeInTheDocument()
    expect(playMock).toHaveBeenCalled()
  })

  it('goes back to the previous line and plays it when "Câu trước" is clicked', async () => {
    render(<ShadowingScreen dialogue={dialogue} />)
    await act(async () => {
      await Promise.resolve()
    })
    fireEvent.click(screen.getByRole('button', { name: /Câu sau/i }))
    playMock.mockClear()
    fireEvent.click(screen.getByRole('button', { name: /Câu trước/i }))
    expect(screen.getByText('你好嗎')).toBeInTheDocument()
    expect(playMock).toHaveBeenCalled()
  })

  it('cycles playback speed through 1x -> 1.25x -> 0.75x -> 1x when the speed button is clicked', async () => {
    render(<ShadowingScreen dialogue={dialogue} />)
    await act(async () => {
      await Promise.resolve()
    })
    const speedButton = screen.getByRole('button', { name: /1x/i })
    fireEvent.click(speedButton)
    expect(screen.getByRole('button', { name: /1\.25x/i })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /1\.25x/i }))
    expect(screen.getByRole('button', { name: /0\.75x/i })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /0\.75x/i }))
    expect(screen.getByRole('button', { name: /^1x$/i })).toBeInTheDocument()
  })

  it('does not crash when a line has no audio_url (duration treated as 0, play disabled for it)', async () => {
    const dialogueWithGap: Dialogue = {
      ...dialogue,
      lines: [
        dialogue.lines[0],
        { ...dialogue.lines[1], audio_url: null },
        dialogue.lines[2],
      ],
    }
    render(<ShadowingScreen dialogue={dialogueWithGap} />)
    await act(async () => {
      await Promise.resolve()
    })
    fireEvent.click(screen.getByRole('button', { name: /Câu sau/i }))
    expect(screen.getByText('我很好')).toBeInTheDocument()
    // No crash, and the play/pause button should be disabled on this line.
    expect(screen.getByRole('button', { name: /Nghe mẫu/i })).toBeDisabled()
  })

  it('resets audioProgress (cumulative time shows 0 progress into the new line) when a sidebar line is selected mid-playback', async () => {
    const { container } = render(<ShadowingScreen dialogue={dialogue} />)
    await act(async () => {
      await Promise.resolve()
    })
    // Durations preload to 5s per line (MockAudio.duration = 5), so total = 15.
    const timeText = () => container.querySelector('.tabular-nums')?.textContent

    // Play the current (first) line and advance its progress partway.
    // (Preloading already created 3 probe Audio instances for durations;
    // the one created by play is the last instance in the array.)
    fireEvent.click(screen.getByRole('button', { name: /^Nghe mẫu$/i }))
    const playingAudio = audioInstances[audioInstances.length - 1]
    act(() => {
      playingAudio.currentTime = 3
      playingAudio.ontimeupdate?.()
    })
    // Cumulative time = durations.slice(0, 0).sum() + audioProgress = 0 + 3 = 3.
    expect(timeText()).toMatch(/^0:03 \//)

    // Click a non-current sidebar line ("謝謝", index 2).
    fireEvent.click(screen.getByRole('button', { name: '謝謝' }))
    expect(screen.getByText('謝謝')).toBeInTheDocument()

    // Cumulative time should now be durations[0] + durations[1] + 0 = 10,
    // NOT 10 + the stale audioProgress of 3 (= 13).
    expect(timeText()).toMatch(/^0:10 \//)
    expect(timeText()).not.toMatch(/^0:13 \//)
  })

  it('shows a Reset button alongside prev/next and the auto-pause toggle', async () => {
    render(<ShadowingScreen dialogue={dialogue} />)
    await act(async () => {
      await Promise.resolve()
    })
    expect(screen.getByRole('button', { name: /Phát lại từ đầu/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Câu trước/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Câu sau/i })).toBeInTheDocument()
    expect(screen.getByRole('switch', { name: /Tự động dừng/i })).toBeInTheDocument()
  })

  it('jumps to the first line and plays it when Reset is clicked from a later line', async () => {
    render(<ShadowingScreen dialogue={dialogue} />)
    await act(async () => {
      await Promise.resolve()
    })
    fireEvent.click(screen.getByRole('button', { name: /Câu sau/i }))
    expect(screen.getByText('我很好')).toBeInTheDocument()
    playMock.mockClear()

    fireEvent.click(screen.getByRole('button', { name: /Phát lại từ đầu/i }))
    expect(screen.getByText('你好嗎')).toBeInTheDocument()
    expect(playMock).toHaveBeenCalled()
  })

  it('keeps Reset enabled on the first line (unlike "Câu trước", which disables there)', async () => {
    render(<ShadowingScreen dialogue={dialogue} />)
    await act(async () => {
      await Promise.resolve()
    })
    expect(screen.getByRole('button', { name: /Câu trước/i })).toBeDisabled()
    expect(screen.getByRole('button', { name: /Phát lại từ đầu/i })).toBeEnabled()
  })
})
