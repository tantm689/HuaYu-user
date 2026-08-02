'use client'

import { useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'

export default function BackButton() {
  const router = useRouter()

  return (
    <button
      type="button"
      onClick={() => router.back()}
      className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-ink-faint transition-colors hover:text-brand-red"
    >
      <ArrowLeft className="h-4 w-4" strokeWidth={2.5} />
      Quay lại
    </button>
  )
}
