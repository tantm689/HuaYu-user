'use client'

import { Suspense, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { createBrowserSupabase } from '@/lib/supabase/browser'

function LoginForm() {
  const searchParams = useSearchParams()
  const oauthError = searchParams.get('error')

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [mode, setMode] = useState<'sign-in' | 'sign-up'>('sign-in')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleGoogleLogin() {
    const supabase = createBrowserSupabase()
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    })
  }

  async function handleEmailSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const supabase = createBrowserSupabase()

    const { error: authError } =
      mode === 'sign-in'
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password })

    setLoading(false)

    if (authError) {
      setError(authError.message)
      return
    }

    window.location.href = '/home'
  }

  const displayError = error ?? oauthError

  return (
    <div className="mx-auto flex min-h-screen max-w-[420px] flex-col justify-center gap-4 px-5 py-8">
      <div className="mb-2 flex flex-col items-center gap-3">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-red font-han-title text-2xl font-bold text-brand-cream-text shadow-[0_3px_10px_rgba(193,39,45,0.28)]">
          易
        </div>
        <h1 className="text-xl font-extrabold text-ink">Đăng nhập TaiwaneseEasy</h1>
      </div>

      <button
        type="button"
        onClick={handleGoogleLogin}
        className="rounded-btn border border-card-border bg-card px-4 py-3 font-bold text-ink shadow-[0_4px_16px_rgba(120,90,40,0.05)] transition-transform hover:-translate-y-0.5"
      >
        Đăng nhập với Google
      </button>

      <div className="text-center text-sm font-semibold text-ink-faint">hoặc</div>

      <form onSubmit={handleEmailSubmit} className="flex flex-col gap-3">
        <input
          type="email"
          required
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="rounded-btn border border-card-border bg-card px-4 py-3 text-ink placeholder:text-ink-faint"
        />
        <input
          type="password"
          required
          minLength={6}
          placeholder="Mật khẩu"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="rounded-btn border border-card-border bg-card px-4 py-3 text-ink placeholder:text-ink-faint"
        />

        {displayError && <p className="text-sm font-semibold text-error-text">{displayError}</p>}

        <button
          type="submit"
          disabled={loading}
          className="rounded-btn bg-brand-red px-4 py-3 font-extrabold text-brand-cream-text-alt shadow-[0_10px_24px_rgba(193,39,45,0.28)] transition-transform hover:-translate-y-0.5 disabled:opacity-50"
        >
          {mode === 'sign-in' ? 'Đăng nhập' : 'Đăng ký'}
        </button>
      </form>

      <button
        type="button"
        onClick={() => setMode(mode === 'sign-in' ? 'sign-up' : 'sign-in')}
        className="text-sm font-semibold text-ink-faint underline"
      >
        {mode === 'sign-in' ? 'Chưa có tài khoản? Đăng ký' : 'Đã có tài khoản? Đăng nhập'}
      </button>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  )
}
