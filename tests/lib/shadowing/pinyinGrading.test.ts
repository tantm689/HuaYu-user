import { describe, it, expect } from 'vitest'
import { gradeSyllables } from '@/lib/shadowing/pinyinGrading'

describe('gradeSyllables', () => {
  it('grades identical pinyin as correct even when characters differ (simplified vs traditional)', () => {
    // 你好嗎 (traditional target) vs 你好吗 (simplified ASR transcript) — same syllables
    const result = gradeSyllables('你好嗎', '你好吗')
    expect(result.status).toBe('correct')
    expect(result.accuracy).toBe(1)
    expect(result.targetSyllables).toEqual(['ni', 'hao', 'ma'])
    expect(result.transcriptSyllables).toEqual(['ni', 'hao', 'ma'])
  })

  it('grades homophone pronoun swap as correct (他/她 are acoustically identical)', () => {
    const result = gradeSyllables('她們', '他们')
    expect(result.status).toBe('correct')
    expect(result.accuracy).toBe(1)
  })

  it('grades a single-syllable mismatch out of 5 as almost (accuracy 0.8)', () => {
    const result = gradeSyllables('我很喜歡你', '我很喜歡他')
    expect(result.status).toBe('almost')
    expect(result.accuracy).toBeCloseTo(0.8, 5)
  })

  it('grades a single-syllable mismatch out of 3 as incorrect (accuracy below 0.7)', () => {
    const result = gradeSyllables('早安', '晚安')
    expect(result.status).toBe('incorrect')
    expect(result.accuracy).toBeCloseTo(0.5, 5)
  })

  it('exposes toned pinyin for display without using it for grading', () => {
    const result = gradeSyllables('你好', '你好')
    expect(result.targetSyllablesToned).toEqual(['nǐ', 'hǎo'])
    expect(result.transcriptSyllablesToned).toEqual(['nǐ', 'hǎo'])
  })

  it('treats an empty transcript as fully incorrect, not a crash', () => {
    const result = gradeSyllables('你好', '')
    expect(result.status).toBe('incorrect')
    expect(result.accuracy).toBe(0)
  })
})
