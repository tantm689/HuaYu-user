'use client'

import { useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'

export default function BackButton({ fallbackHref }: { fallbackHref: string }) {
  const router = useRouter()

  function handleClick() {
    // Vào trang này trực tiếp bằng URL (mở tab mới, refresh, dán link) không để lại
    // lịch sử điều hướng trong app — router.back() khi đó thoát hẳn ra khỏi site
    // thay vì lùi về trang cha. window.history.length <= 2 nghĩa là chỉ có trang
    // hiện tại (và có thể 1 trang trước site, ví dụ URL bar) trong session history.
    if (typeof window !== 'undefined' && window.history.length <= 2) {
      router.push(fallbackHref)
      return
    }

    router.back()
    // router.back() có thể phục vụ bản Server Component đã cache trong Client-side
    // Router Cache của trang trước đó (ví dụ trang chủ với số "Ôn hôm nay" cũ), dù
    // staleTimes.dynamic đã đặt 0 cho các lần điều hướng mới qua <Link>/push. Ép
    // refresh ngay sau back để trang vừa lùi tới luôn lấy dữ liệu mới nhất từ server.
    router.refresh()
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-ink-faint transition-colors hover:text-brand-red"
    >
      <ArrowLeft className="h-4 w-4" strokeWidth={2.5} />
      Quay lại
    </button>
  )
}
