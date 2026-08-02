'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { BookOpenText, Home } from 'lucide-react'

const tabs = [
  { href: '/home', label: 'Trang chủ', icon: Home },
  { href: '/guide', label: 'Hướng dẫn', icon: BookOpenText },
] as const

export default function BottomNav() {
  const pathname = usePathname()

  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-card-border bg-white/95 backdrop-blur-sm">
      <div className="mx-auto flex max-w-[660px] items-center">
        {tabs.map((tab) => {
          const Icon = tab.icon
          const active = pathname === tab.href || pathname.startsWith(`${tab.href}/`)
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`flex flex-1 flex-col items-center gap-1 py-2.5 text-xs font-semibold transition-colors ${
                active ? 'text-brand-red' : 'text-ink-faint hover:text-ink'
              }`}
            >
              <Icon className="h-5 w-5" strokeWidth={active ? 2.5 : 2} />
              {tab.label}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
