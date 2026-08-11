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

  it('filters Chinese punctuation out of syllable arrays and accuracy entirely', () => {
    // Confirmed via pinyin-pro directly: punctuation like 。 is echoed back
    // verbatim as a fake "syllable" unless filtered — it must never affect
    // accuracy or appear in any syllable array.
    const result = gradeSyllables('是的。', '是的')
    expect(result.targetSyllables).toEqual(['shi', 'de'])
    expect(result.status).toBe('correct')
    expect(result.accuracy).toBe(1)
  })

  it('produces one alignment entry per target syllable, all matched for a correct reading', () => {
    const result = gradeSyllables('你好', '你好')
    expect(result.alignment).toHaveLength(2)
    expect(result.alignment[0]).toEqual({
      status: 'matched',
      targetSyllable: 'ni',
      targetSyllableToned: 'nǐ',
      transcriptSyllable: 'ni',
      transcriptSyllableToned: 'nǐ',
    })
    expect(result.alignment[1]).toEqual({
      status: 'matched',
      targetSyllable: 'hao',
      targetSyllableToned: 'hǎo',
      transcriptSyllable: 'hao',
      transcriptSyllableToned: 'hǎo',
    })
  })

  it('marks a syllable as tone-mismatch when the base syllable matches but the tone differs', () => {
    // Verified directly: 你好嗎 tones are nǐ/hǎo/má, 你好马 (a different but
    // toneless-identical reading) would need real verification - instead use
    // a constructed transcript with the same toneless syllables but swap in
    // pinyin-pro's OWN toned output for a different tone on the same base by
    // using a target/transcript pair independently confirmed to share toneless
    // syllables but differ in tone. Confirmed via pinyin-pro:
    // 你好嗎 toned: ['nǐ', 'hǎo', 'má']; 你好马 toned: ['nǐ', 'hǎo', 'mǎ']
    // (马 mǎ vs 嗎 má - same toneless "ma", different tone).
    const result = gradeSyllables('你好嗎', '你好马')
    expect(result.alignment[2].status).toBe('tone-mismatch')
    expect(result.alignment[2].targetSyllable).toBe('ma')
    expect(result.alignment[2].transcriptSyllable).toBe('ma')
    expect(result.alignment[2].targetSyllableToned).toBe('má')
    expect(result.alignment[2].transcriptSyllableToned).toBe('mǎ')
  })

  it('marks a syllable as mismatched when the toneless base syllable differs', () => {
    const result = gradeSyllables('早安', '晚安')
    expect(result.alignment).toHaveLength(2)
    expect(result.alignment[0].status).toBe('mismatched')
    expect(result.alignment[0].targetSyllable).toBe('zao')
    expect(result.alignment[0].transcriptSyllable).toBe('wan')
    expect(result.alignment[1].status).toBe('matched')
  })

  it('marks a target syllable as missing (null transcript fields) when the transcript is empty', () => {
    const result = gradeSyllables('你好', '')
    expect(result.alignment).toHaveLength(2)
    expect(result.alignment[0]).toEqual({
      status: 'missing',
      targetSyllable: 'ni',
      targetSyllableToned: 'nǐ',
      transcriptSyllable: null,
      transcriptSyllableToned: null,
    })
  })

  it('aligns a syllable missing from the MIDDLE of the transcript without cascading mismatches after it', () => {
    // Target: 我很喜歡你 (wo hen xi huan ni). Transcript omits "hen" entirely:
    // 我喜歡你 (wo xi huan ni). A correct aligner recognizes "hen" as the one
    // missing syllable and still matches "xi", "huan", "ni" against their
    // true counterparts - a naive positional comparison would instead see
    // transcript[1]='xi' against target[1]='hen' and falsely mark everything
    // after the gap as mismatched.
    const result = gradeSyllables('我很喜歡你', '我喜歡你')
    expect(result.alignment).toHaveLength(5)
    expect(result.alignment[0].status).toBe('matched') // wo
    expect(result.alignment[1].status).toBe('missing') // hen - the actual gap
    expect(result.alignment[1].transcriptSyllable).toBeNull()
    expect(result.alignment[2].status).toBe('matched') // xi - NOT mismatched
    expect(result.alignment[3].status).toBe('matched') // huan
    expect(result.alignment[4].status).toBe('matched') // ni
  })
})
