import { describe, it, expect } from 'vitest'
import { normalizeForMatch, isExactMatch } from '@/lib/typing/normalize'

describe('normalizeForMatch', () => {
  it('trims leading and trailing whitespace', () => {
    expect(normalizeForMatch('  你好  ')).toBe('你好')
  })

  it('converts half-width punctuation to full-width', () => {
    expect(normalizeForMatch('你好,吗?')).toBe('你好，吗？')
    expect(normalizeForMatch('好.')).toBe('好。')
    expect(normalizeForMatch('好!')).toBe('好！')
    expect(normalizeForMatch('好:')).toBe('好：')
    expect(normalizeForMatch('好;')).toBe('好；')
  })

  it('leaves already-full-width punctuation unchanged', () => {
    expect(normalizeForMatch('你好，嗎？')).toBe('你好，嗎？')
  })
})

describe('isExactMatch', () => {
  it('matches identical strings', () => {
    expect(isExactMatch('你好', '你好')).toBe(true)
  })

  it('matches after normalization differences (half-width vs full-width punctuation)', () => {
    expect(isExactMatch('你好,嗎?', '你好，嗎？')).toBe(true)
  })

  it('matches after trimming stray whitespace', () => {
    expect(isExactMatch('  你好  ', '你好')).toBe(true)
  })

  it('does not match different text', () => {
    expect(isExactMatch('你好', '再見')).toBe(false)
  })
})
