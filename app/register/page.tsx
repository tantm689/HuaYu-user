'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createBrowserSupabase } from '@/lib/supabase/browser'
import Logo from '@/components/Logo'

export default function RegisterPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [submittedEmail, setSubmittedEmail] = useState<string | null>(null)

  async function handleGoogleLogin() {
    const supabase = createBrowserSupabase()
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    })
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const supabase = createBrowserSupabase()

    const { error: authError } = await supabase.auth.signUp({ email, password })

    setLoading(false)

    if (authError) {
      setError(authError.message)
      return
    }

    // signUp() succeeds (no error) both for a brand-new email and for an
    // already-registered-but-unconfirmed one - Supabase deliberately
    // doesn't distinguish the two in the response, to avoid leaking which
    // emails already have an account. Either way the right next step is
    // the same: tell them to check that inbox for the confirmation link.
    setSubmittedEmail(email)
  }

  if (submittedEmail) {
    return (
      <div className="mx-auto flex min-h-screen max-w-[420px] flex-col justify-center gap-4 px-5 py-8 text-center">
        <div className="mb-2 flex flex-col items-center gap-3">
          <Logo />
          <h1 className="text-xl font-extrabold text-ink">Kiểm tra email của bạn</h1>
        </div>
        <p className="text-ink-faint">
          Chúng tôi đã gửi một email xác nhận tới <span className="font-semibold text-ink">{submittedEmail}</span>.
          Nhấn vào liên kết trong email để hoàn tất đăng ký, sau đó quay lại đăng nhập.
        </p>
        <Link
          href="/login"
          className="rounded-btn bg-brand-red px-4 py-3 font-extrabold text-brand-cream-text-alt shadow-[0_10px_24px_rgba(193,39,45,0.28)] transition-transform hover:-translate-y-0.5"
        >
          Đi tới trang đăng nhập
        </Link>
      </div>
    )
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-[420px] flex-col justify-center gap-4 px-5 py-8">
      <div className="mb-2 flex flex-col items-center gap-3">
        <Logo />
        <h1 className="text-xl font-extrabold text-ink">Đăng ký HuaYu</h1>
      </div>

      <button
        type="button"
        onClick={handleGoogleLogin}
        className="rounded-btn border border-card-border bg-card px-4 py-3 font-bold text-ink shadow-[0_4px_16px_rgba(120,90,40,0.05)] transition-transform hover:-translate-y-0.5"
      >
        Đăng ký với Google
      </button>

      <div className="text-center text-sm font-semibold text-ink-faint">hoặc</div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
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

        {error && <p className="text-sm font-semibold text-error-text">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="rounded-btn bg-brand-red px-4 py-3 font-extrabold text-brand-cream-text-alt shadow-[0_10px_24px_rgba(193,39,45,0.28)] transition-transform hover:-translate-y-0.5 disabled:opacity-50"
        >
          {loading ? 'Đang đăng ký...' : 'Đăng ký'}
        </button>
      </form>

      <Link href="/login" className="text-center text-sm font-semibold text-ink-faint underline">
        Đã có tài khoản? Đăng nhập
      </Link>
    </div>
  )
}
