import Link from 'next/link'
import { ChevronRight, MessageCircle } from 'lucide-react'
import { dialogueDisplayNames } from '@/lib/db/dialogueDisplayName'
import type { DialogueKind } from '@/lib/db/types'

export default function DialoguePickerList({
  dialogues,
  bookId,
  lessonId,
}: {
  dialogues: { id: string; kind: DialogueKind }[]
  bookId: string
  lessonId: string
}) {
  if (dialogues.length === 0) {
    return <p className="text-center font-medium text-ink-faint">Chưa có bài hội thoại nào.</p>
  }

  const names = dialogueDisplayNames(dialogues)

  return (
    <ul className="flex flex-col gap-3">
      {dialogues.map((dialogue, index) => (
        <li key={dialogue.id}>
          <Link
            href={`/books/${bookId}/lessons/${lessonId}/dialogue/${dialogue.id}`}
            className="group flex items-center gap-4 rounded-card-sm border border-card-border bg-white px-5 py-4 shadow-sm transition-all hover:-translate-y-0.5 hover:bg-amber-50/50 hover:shadow-md"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-50 text-brand-red">
              <MessageCircle className="h-5 w-5" strokeWidth={2} />
            </span>
            <span className="flex-1 font-bold text-ink">{names[index]}</span>
            <ChevronRight className="h-5 w-5 shrink-0 text-slate-400 transition-transform group-hover:translate-x-0.5" strokeWidth={2} />
          </Link>
        </li>
      ))}
    </ul>
  )
}
