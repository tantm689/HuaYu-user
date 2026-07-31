'use client'

import { createBrowserSupabase } from '@/lib/supabase/browser'

export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
  async function handleSignOut() {
    const supabase = createBrowserSupabase()
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  return (
    <div>
      <div className="flex justify-end px-5 pt-4">
        <button
          type="button"
          onClick={handleSignOut}
          className="text-sm text-ink-faint underline"
        >
          Đăng xuất
        </button>
      </div>
      {children}
    </div>
  )
}
