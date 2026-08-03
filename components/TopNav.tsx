'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { BookOpenText, Home, LogOut } from 'lucide-react'
import Logo from '@/components/Logo'
import { createBrowserSupabase } from '@/lib/supabase/browser'

const tabs = [
  { href: '/home', label: 'Trang chủ', icon: Home },
  { href: '/guide', label: 'Hướng dẫn', icon: BookOpenText },
] as const

export default function TopNav() {
  const pathname = usePathname()
  const [email, setEmail] = useState<string | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const supabase = createBrowserSupabase()
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? null))
  }, [])

  useEffect(() => {
    if (!menuOpen) return
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [menuOpen])

  async function handleSignOut() {
    const supabase = createBrowserSupabase()
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  const initial = email ? email[0].toUpperCase() : '?'

  return (
    <nav className="sticky top-0 z-20 border-b border-card-border bg-white/95 backdrop-blur-sm">
      <div className="mx-auto flex max-w-[660px] items-center gap-4 px-5 py-3">
        <Link href="/home" className="flex items-center gap-2.5">
          <Logo size="sm" />
          <span className="font-han-title text-lg font-bold text-ink">HuaYu</span>
        </Link>

        <div className="flex flex-1 items-center gap-1">
          {tabs.map((tab) => {
            const Icon = tab.icon
            const active = pathname === tab.href || pathname.startsWith(`${tab.href}/`)
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={`flex items-center gap-1.5 rounded-btn px-3 py-1.5 text-sm font-semibold transition-colors ${
                  active ? 'bg-red-50 text-brand-red' : 'text-ink-faint hover:text-ink'
                }`}
              >
                <Icon className="h-4 w-4" strokeWidth={active ? 2.5 : 2} />
                {tab.label}
              </Link>
            )
          })}
        </div>

        <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            onMouseDown={(e) => e.preventDefault()}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-red text-sm font-bold text-brand-cream-text transition-transform hover:-translate-y-0.5"
          >
            {initial}
          </button>

          {menuOpen && (
            <div className="absolute right-0 top-full mt-2 w-64 rounded-card border border-card-border bg-white p-2 shadow-lg">
              {email && (
                <div className="border-b border-card-border px-3 py-2.5">
                  <p className="truncate text-sm font-semibold text-ink">{email}</p>
                </div>
              )}
              <button
                type="button"
                onClick={handleSignOut}
                onMouseDown={(e) => e.preventDefault()}
                className="mt-1 flex w-full items-center gap-2 rounded-btn px-3 py-2 text-left text-sm font-semibold text-brand-red transition-colors hover:bg-red-50"
              >
                <LogOut className="h-4 w-4" strokeWidth={2.5} />
                Đăng xuất
              </button>
            </div>
          )}
        </div>
      </div>
    </nav>
  )
}
