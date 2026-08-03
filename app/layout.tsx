import type { Metadata } from 'next'
import { Nunito, Noto_Serif_SC, Noto_Sans_SC } from 'next/font/google'
import './globals.css'

const nunito = Nunito({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-nunito',
})
const notoSerifSC = Noto_Serif_SC({
  subsets: ['latin'],
  weight: ['500', '600', '700'],
  variable: '--font-noto-serif-sc',
})
const notoSansSC = Noto_Sans_SC({
  subsets: ['latin'],
  weight: ['400', '500', '700'],
  variable: '--font-noto-sans-sc',
})

export const metadata: Metadata = {
  title: 'HuaYu',
  description: 'Ôn tập tiếng Trung phồn thể theo giáo trình Đương Đại',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi" className={`${nunito.variable} ${notoSerifSC.variable} ${notoSansSC.variable}`}>
      <body className="bg-cream font-ui text-ink">{children}</body>
    </html>
  )
}
