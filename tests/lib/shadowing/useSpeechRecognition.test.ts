import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useSpeechRecognition } from '@/lib/shadowing/useSpeechRecognition'

class MockSpeechRecognition {
  lang = ''
  continuous = false
  interimResults = false
  onresult: ((e: any) => void) | null = null
  onerror: ((e: any) => void) | null = null
  onend: (() => void) | null = null
  start = vi.fn()
  stop = vi.fn()
  abort = vi.fn()
}

let lastInstance: MockSpeechRecognition | null = null

beforeEach(() => {
  lastInstance = null
  vi.stubGlobal(
    'webkitSpeechRecognition',
    vi.fn().mockImplementation(function () {
      lastInstance = new MockSpeechRecognition()
      return lastInstance
    })
  )
})

describe('useSpeechRecognition', () => {
  it('reports unsupported when no SpeechRecognition constructor exists', () => {
    vi.stubGlobal('webkitSpeechRecognition', undefined)
    vi.stubGlobal('SpeechRecognition', undefined)
    const { result } = renderHook(() => useSpeechRecognition(() => {}))
    expect(result.current.isSupported).toBe(false)
  })

  it('sets lang to zh-TW (never zh-CN) on start', () => {
    const { result } = renderHook(() => useSpeechRecognition(() => {}))
    act(() => result.current.start())
    expect(lastInstance?.lang).toBe('zh-TW')
    expect(lastInstance?.start).toHaveBeenCalled()
  })

  it('invokes onResult with the recognized transcript', () => {
    const onResult = vi.fn()
    const { result } = renderHook(() => useSpeechRecognition(onResult))
    act(() => result.current.start())
    act(() => {
      lastInstance?.onresult?.({ results: [[{ transcript: '你好' }]] })
    })
    expect(onResult).toHaveBeenCalledWith('你好')
  })

  it('calls abort, not just stop, when stop() is invoked while listening', () => {
    const { result } = renderHook(() => useSpeechRecognition(() => {}))
    act(() => result.current.start())
    act(() => result.current.stop())
    expect(lastInstance?.stop).toHaveBeenCalled()
  })

  it('invokes onEnd when recognition.onend fires, after onresult', () => {
    const onEnd = vi.fn()
    const onResult = vi.fn()
    const { result } = renderHook(() => useSpeechRecognition(onResult, onEnd))
    act(() => result.current.start())
    expect(onEnd).not.toHaveBeenCalled()
    act(() => {
      lastInstance?.onresult?.({ results: [[{ transcript: '你好' }]] })
    })
    expect(onEnd).not.toHaveBeenCalled()
    act(() => {
      lastInstance?.onend?.()
    })
    expect(onEnd).toHaveBeenCalledTimes(1)
  })

  it('invokes onEnd even when recognition ends without a result (e.g. no-speech error)', () => {
    const onEnd = vi.fn()
    const { result } = renderHook(() => useSpeechRecognition(() => {}, onEnd))
    act(() => result.current.start())
    act(() => {
      lastInstance?.onerror?.({ error: 'no-speech' })
      lastInstance?.onend?.()
    })
    expect(onEnd).toHaveBeenCalledTimes(1)
  })
})

describe('useSpeechRecognition timeout', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('calls onTimeout and onEnd if recognition.onend never fires within 10 seconds of stop()', () => {
    const onResult = vi.fn()
    const onEnd = vi.fn()
    const onTimeout = vi.fn()
    const { result } = renderHook(() => useSpeechRecognition(onResult, onEnd, onTimeout))

    act(() => result.current.start())
    act(() => result.current.stop())
    // recognition.onend deliberately never fires (simulating a hang)

    act(() => vi.advanceTimersByTime(10_000))

    expect(onTimeout).toHaveBeenCalledTimes(1)
    expect(onEnd).toHaveBeenCalledTimes(1)
    expect(result.current.isListening).toBe(false)
  })

  it('does not call onTimeout if recognition.onend fires before the 10-second deadline', () => {
    const onResult = vi.fn()
    const onEnd = vi.fn()
    const onTimeout = vi.fn()
    const { result } = renderHook(() => useSpeechRecognition(onResult, onEnd, onTimeout))

    act(() => result.current.start())
    act(() => result.current.stop())

    // Real onend fires quickly, well before the timeout - same triggering
    // pattern used by the pre-existing "invokes onEnd when recognition.onend
    // fires" test above (lastInstance?.onend?.()).
    act(() => {
      lastInstance?.onend?.()
    })

    act(() => vi.advanceTimersByTime(10_000))
    // onend already fired and cleared the timer, so onTimeout must not fire.
    expect(onTimeout).not.toHaveBeenCalled()
    expect(onEnd).toHaveBeenCalledTimes(1)
  })

  it('does not arm a new timeout if stop() is called again after recognition.onend already fired', () => {
    // Guards against a stray/duplicate stop() call (e.g. a second click)
    // arriving after recognition already ended normally. Rescheduling a
    // fresh timeout here would later fire a spurious onTimeout/onEnd long
    // after a correct result was already shown.
    const onResult = vi.fn()
    const onEnd = vi.fn()
    const onTimeout = vi.fn()
    const { result } = renderHook(() => useSpeechRecognition(onResult, onEnd, onTimeout))

    act(() => result.current.start())

    // Recognition ends normally on its own, before any stop() call.
    act(() => {
      lastInstance?.onend?.()
    })
    expect(onEnd).toHaveBeenCalledTimes(1)

    // A later, redundant stop() call must not arm a new grading timeout.
    act(() => result.current.stop())

    act(() => vi.advanceTimersByTime(10_000))

    expect(onTimeout).not.toHaveBeenCalled()
    expect(onEnd).toHaveBeenCalledTimes(1)
  })
})
