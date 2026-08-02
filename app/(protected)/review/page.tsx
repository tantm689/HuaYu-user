import { createServerSupabase } from '@/lib/supabase/server'
import { getDueVocabularyCards } from '@/lib/db/getDueVocabularyCards'
import BackButton from '@/components/BackButton'
import ReviewSession from './ReviewSession'

export default async function ReviewPage() {
  const supabase = await createServerSupabase()
  const dueCards = await getDueVocabularyCards(supabase)

  return (
    <div className="mx-auto max-w-[660px] px-5 py-6">
      <BackButton />

      <div className="mb-5 rounded-card border border-card-border bg-white p-6 shadow-sm">
        <h1 className="font-han-title text-2xl font-bold text-ink">Ôn hôm nay</h1>
        <p className="text-sm font-medium text-ink-faint">{dueCards.length} từ vựng đến hạn ôn</p>
      </div>

      {dueCards.length === 0 ? (
        <p className="font-semibold text-ink-faint">Không có từ nào đến hạn ôn hôm nay.</p>
      ) : (
        <ReviewSession cards={dueCards} />
      )}
    </div>
  )
}
