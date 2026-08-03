'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, MessageSquareText, Table2 } from 'lucide-react'
import type { Vocabulary, DialogueLineForTyping } from '@/lib/db/types'
import VocabTypingTab from './VocabTypingTab'
import SentenceTypingTab from './SentenceTypingTab'

type Mode = 'select' | 'vocab' | 'sentence'

export default function TypingPage({
  vocabulary,
  lines,
  fallbackHref,
}: {
  vocabulary: Vocabulary[]
  lines: DialogueLineForTyping[]
  fallbackHref?: string
}) {
  const [mode, setMode] = useState<Mode>('select')
  const router = useRouter()

  function handleBack() {
    if (mode !== 'select') {
      setMode('select')
      return
    }

    if (fallbackHref && typeof window !== 'undefined' && window.history.length <= 2) {
      router.push(fallbackHref)
      return
    }

    router.back()
    router.refresh()
  }

  return (
    <div>
      <button
        type="button"
        onClick={handleBack}
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-ink-faint transition-colors hover:text-brand-red"
      >
        <ArrowLeft className="h-4 w-4" strokeWidth={2.5} />
        Quay lại
      </button>

      <h1 className="mb-5 font-han-title text-2xl font-bold text-ink">Gõ phản xạ</h1>

      {mode === 'select' ? (
        <div className="flex flex-col gap-4">
          <p className="text-center font-medium text-ink-faint">
            Chọn chế độ bạn muốn luyện tập:
          </p>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => setMode('vocab')}
              className="group flex flex-col items-center gap-3 rounded-card border border-card-border bg-white p-6 shadow-sm transition-all hover:-translate-y-1 hover:bg-amber-50/50 hover:shadow-md"
            >
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-red-50 text-brand-red transition-transform group-hover:scale-110">
                <Table2 className="h-7 w-7" strokeWidth={2} />
              </div>
              <div className="text-center">
                <h2 className="font-bold text-ink text-lg">Gõ từ mới</h2>
                <p className="mt-1 text-xs text-ink-faint">
                  Luyện gõ danh sách từ vựng dưới dạng bảng Excel
                </p>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setMode('sentence')}
              className="group flex flex-col items-center gap-3 rounded-card border border-card-border bg-white p-6 shadow-sm transition-all hover:-translate-y-1 hover:bg-amber-50/50 hover:shadow-md"
            >
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-red-50 text-brand-red transition-transform group-hover:scale-110">
                <MessageSquareText className="h-7 w-7" strokeWidth={2} />
              </div>
              <div className="text-center">
                <h2 className="font-bold text-ink text-lg">Gõ câu hội thoại</h2>
                <p className="mt-1 text-xs text-ink-faint">
                  Luyện gõ lại từng câu hội thoại theo thứ tự
                </p>
              </div>
            </button>
          </div>
        </div>
      ) : mode === 'vocab' ? (
        <VocabTypingTab vocabulary={vocabulary} />
      ) : (
        <SentenceTypingTab key="sentence-tab" lines={lines} />
      )}
    </div>
  )
}
