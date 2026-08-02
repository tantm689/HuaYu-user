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
}

export type TypingKind = 'vocabulary' | 'dialogue_line'

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

export interface QuizAttempt {
  id: string
  user_id: string
  lesson_id: string
  part: 1 | 2
  score: number
  total: number
  created_at: string
}

export interface TypingProgress {
  id: string
  user_id: string
  kind: TypingKind
  target_id: string
  is_correct: boolean
  streak: number
  last_attempted_at: string
}
