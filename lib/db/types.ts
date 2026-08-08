export type LessonStatus = 'draft' | 'published'

export interface Book {
  id: string
  title: string
  volume: string | null
  created_at: string
}

export interface Lesson {
  id: string
  book_id: string
  lesson_no: number
  title_zh: string
  title_vi: string
  theme: string | null
  status: LessonStatus
  created_at: string
  grammar_markdown: string | null
  objectives: string[]
}

// Lesson list rows (e.g. book-level lesson listings) intentionally omit the
// potentially-large grammar_markdown text column and objectives - they're
// only selected when fetching a single lesson's full detail, not for every
// row in a list.
export type LessonListItem = Omit<Lesson, 'grammar_markdown' | 'objectives'>

export interface Vocabulary {
  id: string
  dialogue_id: string
  order: number
  word_zh: string
  pinyin: string | null
  meaning_vi: string | null
  audio_url: string | null
}

export interface DialogueLineForTyping {
  id: string
  text_zh: string
  translation_vi: string | null
  audio_url: string | null
}

export interface DialogueVocabulary {
  dialogue_id: string
  dialogue_order: number
  words: Vocabulary[]
}

export interface VocabularyProgress {
  id: string
  user_id: string
  vocabulary_id: string
  box: number
  learning_streak: number
  due_at: string
  last_reviewed_at: string | null
  created_at: string
}

export type QuizQuestionType =
  | 'pinyin_choice'
  | 'listening_choice'
  | 'tone_choice'
  | 'matching'
  | 'fill_blank'
  | 'sentence_order'

export interface PinyinChoicePayload {
  prompt: string
  choices: string[]
  correctIndex: number
}

export interface ListeningChoicePayload {
  audioUrl: string
  choices: string[]
  correctIndex: number
}

export interface ToneChoicePayload {
  wordZh: string
  pinyinNoTone: string
  choices: string[]
  correctIndex: number
}

export interface MatchingPayload {
  pairs: { left: string; right: string }[]
}

export interface FillBlankPayload {
  // One single passage (context sentence + blanked sentence already
  // combined into one string by the Admin app) - displayed verbatim, no
  // separate context field to stitch together for rendering.
  sentence: string
  choices: string[]
  correctIndex: number
}

export interface SentenceOrderPayload {
  words: string[]
  correctOrder: number[]
}

export type QuizQuestionPayload =
  | PinyinChoicePayload
  | ListeningChoicePayload
  | ToneChoicePayload
  | MatchingPayload
  | FillBlankPayload
  | SentenceOrderPayload

export interface QuizQuestion {
  id: string
  lesson_id: string
  part: 1 | 2
  type: QuizQuestionType
  order: number
  payload: QuizQuestionPayload
}

export type DialogueKind = 'dialogue' | 'passage'

export interface DialogueLine {
  id: string
  order: number
  speaker_zh: string | null
  text_zh: string
  pinyin: string | null
  translation_vi: string | null
  audio_url: string | null
}

export interface Dialogue {
  id: string
  order: number
  kind: DialogueKind
  audio_url: string | null
  lines: DialogueLine[]
}
