import { describe, it, expect, vi, beforeEach } from 'vitest'
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
})
