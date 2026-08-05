'use client'

import { useEffect, useRef, useState } from 'react'
import { RotateCcw, Settings, Shuffle, Undo2, Volume2 } from 'lucide-react'
import type { Vocabulary, VocabularyProgress } from '@/lib/db/types'
import { computeNextReview } from '@/lib/srs/leitner'
import { recordVocabularyReview } from '@/lib/db/recordVocabularyReview'
import { createBrowserSupabase } from '@/lib/supabase/browser'
import HanziStrokeOrder from '@/components/HanziStrokeOrder'
import { usePlayAudio } from '@/lib/audio/usePlayAudio'

interface FlashcardCard {
  vocabulary: Vocabulary
  progress: VocabularyProgress
}

interface FlashcardReviewerProps {
  cards: FlashcardCard[]
  onCardReviewed?: (vocabularyId: string) => void
  /** Khi truyền vào, hàng đợi của vòng hiện tại (+ thẻ đã gom cho vòng sau) được
   * lưu vào localStorage theo key này để khôi phục lại đúng tiến trình nếu người
   * dùng refresh hoặc rời trang rồi quay lại. "Đặt lại thẻ" sẽ xoá tiến trình đã lưu. */
  storageKey?: string
  /** Khi truyền vào, thay thế hoàn toàn màn "Đã ôn xong!" mặc định (kèm nút
   * Đặt lại thẻ/Quay lại thẻ trước) bằng nội dung tuỳ ý - dùng cho những nơi
   * "đặt lại/học lại ngay cùng bộ thẻ" không hợp lý, ví dụ phiên Ôn hôm nay
   * gộp từ nhiều bài theo lịch SRS. */
  renderCompletion?: () => React.ReactNode
}

interface SavedState {
  roundCardIds: string[]
  nextRoundCardIds: string[]
  /** Chỉ có khi đang bật trộn lúc lưu - thứ tự gốc để "tắt trộn" khôi phục
   * lại đúng, kể cả sau khi reload trang (nếu không lưu, originalRoundOrder
   * chỉ tồn tại trong React state và mất hẳn khi component unmount). */
  shuffleEnabled?: boolean
  originalRoundOrderIds?: string[]
}

interface HistoryEntry {
  /** State đầy đủ ngay TRƯỚC khi thẻ này được đánh giá — dùng để khôi phục UI. */
  roundCards: FlashcardCard[]
  nextRoundCards: FlashcardCard[]
  roundTotal: number
  correctCount: number
  wrongCount: number
  /** Để ghi đè lại đúng giá trị Leitner cũ vào Supabase khi undo. */
  progressId: string
  previousBox: number
  previousLearningStreak: number
  previousDueAt: string
  previousLastReviewedAt: string | null
}

function loadSavedState(storageKey: string | undefined, initialCards: FlashcardCard[]): SavedState | null {
  if (!storageKey || typeof window === 'undefined') return null

  try {
    const raw = window.localStorage.getItem(storageKey)
    if (!raw) return null

    const saved: SavedState = JSON.parse(raw)
    const byId = new Map(initialCards.map((c) => [c.vocabulary.id, c]))
    const allIds = [...saved.roundCardIds, ...saved.nextRoundCardIds]
    const valid = allIds.every((id) => byId.has(id))

    // Tiến trình đã lưu không khớp bộ thẻ hiện tại (đổi bài/đổi dữ liệu) -> bỏ qua.
    if (!valid || allIds.length === 0) return null
    return saved
  } catch {
    return null
  }
}

function shuffleCards(cards: FlashcardCard[]): FlashcardCard[] {
  const result = [...cards]
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  return result
}

export default function FlashcardReviewer({
  cards: initialCards,
  onCardReviewed,
  storageKey,
  renderCompletion,
}: FlashcardReviewerProps) {
  // Luôn khởi tạo bằng initialCards (khớp với SSR, nơi không có window/localStorage) —
  // tiến trình đã lưu (nếu có) chỉ được áp dụng SAU KHI mount, trong useEffect bên dưới.
  // Đọc localStorage ngay trong lazy initializer sẽ làm client hydrate khác server,
  // gây lỗi "Hydration failed" khi có tiến trình cũ lưu sẵn trên trình duyệt.
  const playAudio = usePlayAudio()
  const [roundCards, setRoundCards] = useState<FlashcardCard[]>(initialCards)
  const [nextRoundCards, setNextRoundCards] = useState<FlashcardCard[]>([])
  const [roundTotal, setRoundTotal] = useState(initialCards.length)
  const [correctCount, setCorrectCount] = useState(0)
  const [wrongCount, setWrongCount] = useState(0)
  const [showRoundSummary, setShowRoundSummary] = useState(false)
  const [pendingNextRound, setPendingNextRound] = useState<FlashcardCard[] | null>(null)
  const [showSettings, setShowSettings] = useState(false)

  const [flipped, setFlipped] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [lastAttempt, setLastAttempt] = useState<boolean | null>(null)
  const [feedback, setFeedback] = useState<'correct' | 'wrong' | null>(null)
  const [skipNextSync, setSkipNextSync] = useState(false)
  const [history, setHistory] = useState<HistoryEntry[]>([])
  const [undoing, setUndoing] = useState(false)
  const [shuffleEnabled, setShuffleEnabled] = useState(false)
  // Thứ tự gốc (chưa trộn) của roundCards, chụp lại ngay trước khi bật trộn lần đầu
  // trong vòng hiện tại — dùng để khôi phục đúng thứ tự khi tắt trộn.
  const [originalRoundOrder, setOriginalRoundOrder] = useState<FlashcardCard[] | null>(null)

  const settingsRef = useRef<HTMLDivElement>(null)
  // Bắt đầu là false: chặn effect đồng bộ-lên-localStorage ghi đè tiến trình đã lưu
  // bằng initialCards (giá trị khởi tạo tạm dùng để khớp SSR) cho đến khi effect
  // khôi phục bên dưới chạy xong và bật cờ này lên true trong CÙNG một lần cập nhật.
  const [hasRestored, setHasRestored] = useState(false)

  const roundHasCards = roundCards.length > 0
  const allDone = !roundHasCards && nextRoundCards.length === 0 && !showRoundSummary

  // Khôi phục tiến trình đã lưu SAU KHI mount (không trong lazy initializer của
  // useState) để lần render đầu tiên trên client khớp với server, tránh lỗi
  // "Hydration failed" khi trình duyệt đã có tiến trình cũ lưu trong localStorage.
  useEffect(() => {
    const byId = new Map(initialCards.map((c) => [c.vocabulary.id, c]))
    const saved = loadSavedState(storageKey, initialCards)

    if (saved) {
      const restoredRoundCards = saved.roundCardIds.map((id) => byId.get(id)!)
      const restoredNextRoundCards = saved.nextRoundCardIds.map((id) => byId.get(id)!)
      const shouldSkipToNextRound = restoredRoundCards.length === 0 && restoredNextRoundCards.length > 0

      const finalRoundCards = shouldSkipToNextRound ? restoredNextRoundCards : restoredRoundCards
      const finalNextRoundCards = shouldSkipToNextRound ? [] : restoredNextRoundCards
      const finalRoundTotal = shouldSkipToNextRound
        ? restoredNextRoundCards.length
        : finalRoundCards.length + finalNextRoundCards.length

      setRoundCards(finalRoundCards)
      setNextRoundCards(finalNextRoundCards)
      setRoundTotal(finalRoundTotal)
      setCorrectCount(shouldSkipToNextRound ? 0 : finalRoundTotal - finalRoundCards.length - finalNextRoundCards.length)
      setWrongCount(shouldSkipToNextRound ? 0 : finalNextRoundCards.length)

      if (!shouldSkipToNextRound && saved.shuffleEnabled && saved.originalRoundOrderIds) {
        setShuffleEnabled(true)
        setOriginalRoundOrder(saved.originalRoundOrderIds.map((id) => byId.get(id)!))
      }
    }

    setHasRestored(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!showSettings) return
    function handleClickOutside(e: MouseEvent) {
      if (settingsRef.current && !settingsRef.current.contains(e.target as Node)) {
        setShowSettings(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showSettings])

  useEffect(() => {
    if (!storageKey || typeof window === 'undefined') return
    if (!hasRestored) return // Chưa khôi phục xong -> chưa ghi, tránh đè tiến trình đã lưu.
    if (skipNextSync) {
      setSkipNextSync(false)
      return
    }
    if (allDone) {
      window.localStorage.removeItem(storageKey)
      return
    }
    const state: SavedState = {
      roundCardIds: roundCards.map((c) => c.vocabulary.id),
      nextRoundCardIds: nextRoundCards.map((c) => c.vocabulary.id),
      ...(shuffleEnabled && originalRoundOrder
        ? { shuffleEnabled: true, originalRoundOrderIds: originalRoundOrder.map((c) => c.vocabulary.id) }
        : {}),
    }
    window.localStorage.setItem(storageKey, JSON.stringify(state))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roundCards, nextRoundCards, allDone, storageKey, hasRestored, shuffleEnabled, originalRoundOrder])

  function resetSession() {
    if (storageKey && typeof window !== 'undefined') {
      window.localStorage.removeItem(storageKey)
      setSkipNextSync(true)
    }
    setRoundCards(initialCards)
    setNextRoundCards([])
    setRoundTotal(initialCards.length)
    setCorrectCount(0)
    setWrongCount(0)
    setShowRoundSummary(false)
    setPendingNextRound(null)
    setFlipped(false)
    setSaveError(null)
    setLastAttempt(null)
    setFeedback(null)
    setHistory([])
    setShuffleEnabled(false)
    setOriginalRoundOrder(null)
  }

  function startNextRound(cards: FlashcardCard[]) {
    setRoundCards(cards)
    setNextRoundCards([])
    setRoundTotal(cards.length)
    setCorrectCount(0)
    setWrongCount(0)
    setShowRoundSummary(false)
    setPendingNextRound(null)
    setShuffleEnabled(false)
    setOriginalRoundOrder(null)
  }

  function toggleShuffle() {
    setShuffleEnabled((enabled) => {
      const next = !enabled

      if (next) {
        // Bật trộn: trộn toàn bộ hàng đợi còn lại, kể cả thẻ đang xem.
        setOriginalRoundOrder(roundCards)
        setRoundCards((prev) => shuffleCards(prev))
      } else if (originalRoundOrder) {
        // Tắt trộn: khôi phục đúng thẻ đang xem lúc BẬT trộn lên lại đầu
        // hàng đợi (originalRoundOrder[0] - không phải thẻ đang hiện lúc
        // tắt, thẻ đó chỉ là kết quả tạm của việc trộn), các thẻ còn lại
        // theo đúng thứ tự gốc sau nó - loại bỏ các thẻ đã bị rút khỏi
        // hàng đợi (đã trả lời đúng) trong lúc đang trộn.
        const currentIds = new Set(roundCards.map((c) => c.vocabulary.id))
        const reordered = originalRoundOrder.filter((c) => currentIds.has(c.vocabulary.id))
        setRoundCards(reordered)
        setOriginalRoundOrder(null)
      }

      return next
    })
  }

  useEffect(() => {
    if (allDone || saving || showRoundSummary) return

    function handleKeyDown(e: KeyboardEvent) {
      if (e.code === 'Space') {
        e.preventDefault()
        setFlipped((f) => !f)
        return
      }
      if (!flipped || saveError) return
      if (e.code === 'ArrowLeft') {
        e.preventDefault()
        handleAnswer(false)
      } else if (e.code === 'ArrowRight') {
        e.preventDefault()
        handleAnswer(true)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flipped, saveError, allDone, saving, showRoundSummary])

  if (allDone) {
    if (renderCompletion) return <>{renderCompletion()}</>

    return (
      <div className="rounded-card border border-card-border bg-white p-8 text-center shadow-sm">
        <p className="font-han-title text-xl font-bold text-ink">Đã ôn xong!</p>
        <p className="mt-1 text-sm font-medium text-ink-faint">Quay lại sau khi có thẻ mới đến hạn.</p>
        <div className="mt-4 flex items-center justify-center gap-2">
          {history.length > 0 && (
            <button
              type="button"
              disabled={undoing}
              onMouseDown={(e) => e.preventDefault()}
              onClick={handleUndo}
              className="inline-flex items-center gap-1.5 rounded-btn border border-card-border bg-white px-4 py-2 text-sm font-semibold text-ink transition-colors hover:bg-accent-bg disabled:opacity-50"
            >
              <Undo2 className="h-4 w-4" strokeWidth={2.25} />
              Quay lại thẻ trước
            </button>
          )}
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={resetSession}
            className="inline-flex items-center gap-1.5 rounded-btn border border-card-border bg-accent-bg px-4 py-2 text-sm font-semibold text-ink transition-colors hover:bg-amber-100"
          >
            <RotateCcw className="h-4 w-4" strokeWidth={2.25} />
            Đặt lại thẻ
          </button>
        </div>
      </div>
    )
  }

  if (showRoundSummary && pendingNextRound) {
    const totalMastered = initialCards.length - pendingNextRound.length
    const percent = initialCards.length > 0 ? Math.round((totalMastered / initialCards.length) * 100) : 0
    const stillLearning = pendingNextRound.length
    const circumference = 2 * Math.PI * 54

    return (
      <div className="mx-auto w-full max-w-lg rounded-card border border-card-border bg-white p-10 text-center shadow-sm">
        <p className="font-han-title text-2xl font-bold text-ink">Tiến độ của bạn</p>

        <div className="relative mx-auto my-8 h-44 w-44">
          <svg viewBox="0 0 120 120" className="h-44 w-44 -rotate-90">
            <circle cx="60" cy="60" r="54" fill="none" stroke="#EFE4CE" strokeWidth="12" />
            <circle
              cx="60"
              cy="60"
              r="54"
              fill="none"
              stroke="#7FBF8C"
              strokeWidth="12"
              strokeDasharray={circumference}
              strokeDashoffset={circumference - (percent / 100) * circumference}
              strokeLinecap="round"
            />
          </svg>
          <span className="absolute inset-0 flex items-center justify-center font-han-title text-4xl font-bold text-ink">
            {percent}%
          </span>
        </div>

        <div className="mx-auto flex max-w-sm flex-col gap-2.5">
          <div className="flex items-center justify-between rounded-pill border border-success-border bg-success-bg px-5 py-2.5">
            <span className="text-sm font-semibold text-success-text">Đã thuộc</span>
            <span className="text-sm font-bold text-success-text">{totalMastered}</span>
          </div>
          <div className="flex items-center justify-between rounded-pill border border-error-border bg-error-bg px-5 py-2.5">
            <span className="text-sm font-semibold text-error-text">Chưa thuộc</span>
            <span className="text-sm font-bold text-error-text">{stillLearning}</span>
          </div>
        </div>

        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => startNextRound(pendingNextRound)}
          className="mx-auto mt-8 block w-full max-w-sm rounded-btn bg-brand-red px-6 py-3 font-semibold text-white shadow-sm transition-colors hover:bg-brand-red-dark"
        >
          Tiếp tục với {stillLearning} từ chưa thuộc
        </button>

        <div className="mx-auto mt-3 flex items-center justify-center gap-4">
          {history.length > 0 && (
            <button
              type="button"
              disabled={undoing}
              onMouseDown={(e) => e.preventDefault()}
              onClick={handleUndo}
              className="flex items-center justify-center gap-1.5 text-sm font-semibold text-ink-faint transition-colors hover:text-brand-red disabled:opacity-50"
            >
              <Undo2 className="h-3.5 w-3.5" strokeWidth={2.25} />
              Quay lại thẻ trước
            </button>
          )}
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={resetSession}
            className="flex items-center justify-center gap-1.5 text-sm font-semibold text-ink-faint transition-colors hover:text-brand-red"
          >
            <RotateCcw className="h-3.5 w-3.5" strokeWidth={2.25} />
            Đặt lại thẻ
          </button>
        </div>
      </div>
    )
  }

  const { vocabulary, progress } = roundCards[0]
  // word_zh đôi khi chứa chú thích viết khác đi kèm trong ngoặc (ví dụ
  // "臺灣 (=台湾)") - animation viết chữ chỉ nên vẽ chữ Hán chính, không vẽ
  // cả phần chú thích (kể cả chữ Hán bên trong ngoặc, như "台湾" ở ví dụ
  // trên). Bỏ mọi nội dung trong ngoặc (thường/full-width) trước, rồi mới
  // lọc còn lại chỉ giữ ký tự thuộc khối Unicode CJK để tách thành từng
  // ký tự cho HanziStrokeOrder. Chữ hiển thị to ở mặt trước thẻ vẫn dùng
  // nguyên vocabulary.word_zh, không qua bộ lọc này.
  const characters = [...vocabulary.word_zh.replace(/[（(][^）)]*[）)]/g, '')].filter((char) =>
    /[一-鿿㐀-䶿]/.test(char)
  )

  function goToNext(vocabularyId: string, correct: boolean, updatedCard: FlashcardCard, entry: HistoryEntry) {
    const remaining = roundCards.slice(1)
    const upcomingNextRound = correct ? nextRoundCards : [...nextRoundCards, updatedCard]

    setHistory((h) => [...h, entry])

    if (remaining.length === 0 && upcomingNextRound.length > 0) {
      // Vòng hiện tại vừa xong, còn thẻ chưa thuộc -> hiện màn tổng kết trước,
      // vòng mới (chỉ gồm các thẻ chưa thuộc) bắt đầu khi người dùng bấm tiếp tục.
      setRoundCards([])
      setNextRoundCards(upcomingNextRound)
      if (correct) {
        setCorrectCount((n) => n + 1)
      } else {
        setWrongCount((n) => n + 1)
      }
      setPendingNextRound(upcomingNextRound)
      setShowRoundSummary(true)
    } else {
      setRoundCards(remaining)
      setNextRoundCards(upcomingNextRound)
      if (correct) {
        setCorrectCount((n) => n + 1)
      } else {
        setWrongCount((n) => n + 1)
      }
    }

    setFlipped(false)
    setSaveError(null)
    setLastAttempt(null)
    onCardReviewed?.(vocabularyId)
    // Nút Đúng/Sai vừa bấm bị unmount ngay sau đó, nhưng trình duyệt vẫn coi
    // focus "thuộc về" phần tử cũ tại vị trí đó cho đến khi có gì khác được
    // focus — khiến phím Space kế tiếp bị hiểu là "bấm lại nút" thay vì bubble
    // lên listener toàn cục. Trả focus về thẻ để Space luôn lật thẻ như mong đợi.
    if (typeof document !== 'undefined') {
      ;(document.activeElement as HTMLElement | null)?.blur?.()
    }
  }

  async function handleAnswer(correct: boolean) {
    const card = roundCards[0]
    setLastAttempt(correct)
    setSaving(true)
    setSaveError(null)
    setFeedback(correct ? 'correct' : 'wrong')
    const next = computeNextReview({ box: card.progress.box, learning_streak: card.progress.learning_streak }, correct)

    const entry: HistoryEntry = {
      roundCards,
      nextRoundCards,
      roundTotal,
      correctCount,
      wrongCount,
      progressId: card.progress.id,
      previousBox: card.progress.box,
      previousLearningStreak: card.progress.learning_streak,
      previousDueAt: card.progress.due_at,
      previousLastReviewedAt: card.progress.last_reviewed_at,
    }

    try {
      const supabase = createBrowserSupabase()
      await recordVocabularyReview(supabase, card.progress.id, next)
      const updatedCard: FlashcardCard = { ...card, progress: { ...card.progress, ...next } }
      window.setTimeout(() => {
        goToNext(card.vocabulary.id, correct, updatedCard, entry)
        setFeedback(null)
        // Chỉ mở khoá nút Đúng/Sai SAU KHI đã thực sự chuyển sang thẻ kế —
        // đặt setSaving(false) ở finally bên dưới (chạy ngay sau khi lưu
        // Supabase xong) từng để hở 500ms mà nút không bị disable trong lúc
        // chờ animation, nên bấm nhanh liên tiếp trên cùng 1 thẻ gọi
        // goToNext() nhiều lần và làm roundTotal/doneInRound vượt quá số
        // thẻ thực có (ví dụ "20/15").
        setSaving(false)
      }, 500)
    } catch {
      setSaveError('Không lưu được, kiểm tra kết nối mạng.')
      setFeedback(null)
      setSaving(false)
    }
  }

  async function handleUndo() {
    if (history.length === 0 || undoing) return
    const entry = history[history.length - 1]

    setUndoing(true)
    try {
      const supabase = createBrowserSupabase()
      await supabase
        .from('vocabulary_progress')
        .update({
          box: entry.previousBox,
          learning_streak: entry.previousLearningStreak,
          due_at: entry.previousDueAt,
          last_reviewed_at: entry.previousLastReviewedAt,
        })
        .eq('id', entry.progressId)

      setHistory((h) => h.slice(0, -1))
      setRoundCards(entry.roundCards)
      setNextRoundCards(entry.nextRoundCards)
      setRoundTotal(entry.roundTotal)
      setCorrectCount(entry.correctCount)
      setWrongCount(entry.wrongCount)
      setShowRoundSummary(false)
      setPendingNextRound(null)
      setFlipped(false)
      setSaveError(null)
      setLastAttempt(null)
      setFeedback(null)
    } catch {
      setSaveError('Không hoàn tác được, kiểm tra kết nối mạng.')
    } finally {
      setUndoing(false)
    }
  }

  const doneInRound = correctCount + wrongCount

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="flex w-full max-w-2xl items-center gap-3">
        <span className="shrink-0 rounded-pill border border-error-border bg-error-bg px-2.5 py-0.5 text-xs font-bold text-error-text">
          {wrongCount}
        </span>

        <div className="flex flex-1 items-center gap-3">
          <div className="h-2 flex-1 overflow-hidden rounded-pill bg-accent-bg">
            <div
              className="h-full rounded-pill bg-brand-gold transition-[width] duration-500 ease-out"
              style={{ width: `${roundTotal > 0 ? (doneInRound / roundTotal) * 100 : 0}%` }}
            />
          </div>
          <span className="shrink-0 text-xs font-semibold text-ink-faint">
            {doneInRound}/{roundTotal}
          </span>
        </div>

        <span className="shrink-0 rounded-pill border border-success-border bg-success-bg px-2.5 py-0.5 text-xs font-bold text-success-text">
          {correctCount}
        </span>
      </div>

      <div className="[perspective:1600px] w-full max-w-2xl">
        <div
          role="button"
          tabIndex={0}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => setFlipped((f) => !f)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              setFlipped((f) => !f)
            }
          }}
          aria-label={flipped ? 'Lật lại mặt trước' : 'Lật thẻ để xem đáp án'}
          className={`relative h-96 w-full cursor-pointer rounded-card outline outline-4 transition-[outline-color] duration-300 [transform-style:preserve-3d] will-change-transform ${
            feedback === 'correct'
              ? 'outline-success-border'
              : feedback === 'wrong'
                ? 'outline-error-border'
                : 'outline-transparent'
          }`}
          style={{
            transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
            transition: 'transform 500ms ease',
          }}
        >
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 rounded-card border border-card-border bg-accent-bg p-8 shadow-sm [backface-visibility:hidden]">
            {vocabulary.audio_url && (
              <span
                role="button"
                tabIndex={0}
                onMouseDown={(e) => e.preventDefault()}
                onClick={(e) => {
                  e.stopPropagation()
                  playAudio(vocabulary.audio_url!)
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.stopPropagation()
                    e.preventDefault()
                    playAudio(vocabulary.audio_url!)
                  }
                }}
                aria-label="Phát âm thanh"
                className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-white/70 text-brand-red transition-colors hover:bg-white"
              >
                <Volume2 className="h-4 w-4" strokeWidth={2} />
              </span>
            )}
            <p className="font-han-title text-5xl font-bold text-ink">{vocabulary.word_zh}</p>
          </div>

          <div
            className="absolute inset-0 flex flex-col items-center justify-center gap-3 overflow-y-auto rounded-card border border-card-border bg-white p-6 shadow-sm [backface-visibility:hidden]"
            style={{ transform: 'rotateY(180deg)' }}
          >
            <div className="text-center">
              {vocabulary.pinyin && <p className="text-2xl font-bold text-ink">{vocabulary.pinyin}</p>}
              {vocabulary.meaning_vi && <p className="mt-1 text-xl font-bold text-ink">{vocabulary.meaning_vi}</p>}
            </div>

            <div className="flex flex-wrap justify-center gap-2" onClick={(e) => e.stopPropagation()}>
              {flipped &&
                characters.map((char, i) => (
                  <HanziStrokeOrder
                    key={`${vocabulary.id}-${i}`}
                    character={char}
                    size={characters.length <= 2 ? 140 : characters.length === 3 ? 115 : characters.length === 4 ? 95 : 80}
                  />
                ))}
            </div>
          </div>
        </div>
      </div>

      <div className="flex w-full max-w-2xl items-center justify-between">
        {history.length > 0 ? (
          <button
            type="button"
            disabled={undoing}
            onMouseDown={(e) => e.preventDefault()}
            onClick={handleUndo}
            aria-label="Quay lại thẻ trước"
            title="Quay lại thẻ trước"
            className="flex items-center justify-center rounded-full border border-card-border bg-white p-2.5 text-ink-faint shadow-sm transition-colors hover:bg-accent-bg hover:text-brand-red disabled:opacity-50"
          >
            <Undo2 className="h-4 w-4" strokeWidth={2.25} />
          </button>
        ) : (
          <span />
        )}

        <p className="text-xs font-medium text-ink-faint">
          Nhấn <kbd className="rounded border border-card-border bg-accent-bg px-1.5 py-0.5">Space</kbd> để lật thẻ,{' '}
          <kbd className="rounded border border-card-border bg-accent-bg px-1.5 py-0.5">←</kbd>/
          <kbd className="rounded border border-card-border bg-accent-bg px-1.5 py-0.5">→</kbd> để đánh giá
        </p>

        <div className="relative shrink-0" ref={settingsRef}>
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => setShowSettings((s) => !s)}
            aria-label="Cài đặt"
            title="Cài đặt"
            className="flex items-center justify-center rounded-full border border-card-border bg-white p-2.5 text-ink-faint shadow-sm transition-colors hover:bg-accent-bg hover:text-brand-red"
          >
            <Settings className="h-4 w-4" strokeWidth={2.25} />
          </button>

          {showSettings && (
            <div className="absolute bottom-full right-0 z-10 mb-2 w-48 rounded-card-sm border border-card-border bg-white py-1.5 shadow-md">
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={toggleShuffle}
                className="flex w-full items-center justify-between gap-2 px-4 py-2 text-left text-sm font-medium text-ink transition-colors hover:bg-accent-bg"
              >
                <span className="flex items-center gap-2">
                  <Shuffle className="h-4 w-4" strokeWidth={2} />
                  Trộn thẻ
                </span>
                <span
                  className={`flex h-5 w-9 shrink-0 items-center rounded-pill px-0.5 transition-colors ${
                    shuffleEnabled ? 'justify-end bg-brand-red' : 'justify-start bg-card-border'
                  }`}
                >
                  <span className="h-4 w-4 rounded-full bg-white shadow-sm" />
                </span>
              </button>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  resetSession()
                  setShowSettings(false)
                }}
                className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm font-medium text-ink transition-colors hover:bg-accent-bg"
              >
                <RotateCcw className="h-4 w-4" strokeWidth={2} />
                Đặt lại thẻ
              </button>
            </div>
          )}
        </div>
      </div>

      {saveError && (
        <p role="alert" className="text-sm font-semibold text-error-text">
          {saveError}
        </p>
      )}

      {flipped &&
        (saveError ? (
          <button
            type="button"
            disabled={saving}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => handleAnswer(lastAttempt!)}
            className="rounded-btn border border-error-border bg-error-bg px-6 py-2.5 font-semibold text-error-text shadow-sm transition-colors hover:bg-red-100 disabled:opacity-50"
          >
            Thử lại
          </button>
        ) : (
          <div className="flex gap-3">
            <button
              type="button"
              disabled={saving}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => handleAnswer(false)}
              className="rounded-btn border border-error-border bg-error-bg px-6 py-2.5 font-semibold text-error-text shadow-sm transition-colors hover:bg-red-100 disabled:opacity-50"
            >
              ← Chưa thuộc
            </button>
            <button
              type="button"
              disabled={saving}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => handleAnswer(true)}
              className="rounded-btn border border-success-border bg-success-bg px-6 py-2.5 font-semibold text-success-text shadow-sm transition-colors hover:bg-green-100 disabled:opacity-50"
            >
              Đã thuộc →
            </button>
          </div>
        ))}
    </div>
  )
}
