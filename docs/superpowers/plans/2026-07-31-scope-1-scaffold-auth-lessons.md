# Scope 1: Scaffold + Auth + Danh sách bài học — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **ĐIỂM DỪNG BẮT BUỘC:** Đây là 1 trong 6 scope độc lập của User App (xem `docs/superpowers/specs/2026-07-31-user-app-design.md`). Sau khi hoàn thành TOÀN BỘ plan này (mọi task DONE, final review sạch), DỪNG LẠI và báo cáo cho người dùng kiểm tra/duyệt trực tiếp trên trình duyệt trước khi bắt đầu Scope 2. Không tự động chuyển sang viết/thực thi plan tiếp theo.

**Goal:** Dựng khung dự án Next.js mới từ số 0, có đăng nhập Supabase Auth thật (Google OAuth + email/password) hoạt động, và hiển thị được danh sách sách (books) → bài học `published` (lessons) đọc từ cùng Supabase project với Admin CMS.

**Architecture:** Next.js App Router (route groups `(auth)`/`(protected)`), cookie-based SSR Supabase Auth qua `@supabase/ssr` (giống hệt pattern Admin: `middleware.ts` redirect chưa đăng nhập về `/login`, mọi Route Handler tự `getUser()` để xác thực), UI đọc dữ liệu `books`/`lessons` (`status = 'published'`) trực tiếp qua Supabase JS client ở Server Component (không cần route API trung gian cho dữ liệu đọc thuần).

**Tech Stack:** Next.js 16.2.11, React 19.2.4, TypeScript 5, Tailwind CSS 4, `@supabase/ssr` 0.12.3, `@supabase/supabase-js` 2.110.8 — pin đúng version Admin đang dùng để tránh lệch hành vi giữa 2 repo.

## Global Constraints

- Repo: `E:\TaiwaneseEasy\TaiwaneseEasy-user` — hiện HOÀN TOÀN TRỐNG (không `package.json`, không `.git`). Task 1 khởi tạo từ đầu, bao gồm cả `git init`.
- Cùng 1 Supabase project với `TaiwaneseEasy-admin` — KHÔNG tạo project Supabase mới. Cần `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` giống hệt giá trị trong `E:\TaiwaneseEasy\TaiwaneseEasy-admin\.env.local` (không phải service-role key — User App chỉ dùng anon key, không có service-role key nào trong repo này).
- Auth: 2 phương thức — Google OAuth và email/password — theo spec mục 2. `auth.uid()` là khóa cho mọi bảng progress cá nhân (các bảng đó thuộc Scope 2, chưa tạo trong plan này).
- Đọc dữ liệu content (`books`/`lessons`/...) qua **anon key + RLS**, chỉ được thấy `lessons.status = 'published'` — RLS cho việc này đã tồn tại sẵn ở phía Supabase (được thiết lập khi build Admin CMS), plan này KHÔNG tạo/sửa RLS.
- KHÔNG cài đặt bất kỳ tính năng nào thuộc Scope 2-6 (SRS, quiz, gõ phản xạ, shadowing) — chỉ scaffold + auth + đọc danh sách.
- **Style: theo Design System đã chốt** tại `docs/superpowers/specs/2026-07-31-design-system.md` (tham khảo mockup `E:\TaiwaneseEasy\theme tham khảo\`) — Tailwind 4 theme tokens (`@theme` trong `globals.css`: `bg-cream`, `bg-card`, `bg-brand-red`, `font-ui`, `font-han-title`, `rounded-card`, v.v.), KHÔNG dùng Tailwind generic color (`gray-500`, `black`...) hay cài shadcn/`@base-ui/react` trong scope này.

---

## File Structure

```
TaiwaneseEasy-user/
├── package.json
├── tsconfig.json
├── next.config.mjs
├── postcss.config.mjs
├── eslint.config.mjs
├── middleware.ts                        # Task 3 — bảo vệ route (protected)
├── .env.local                           # Task 1 — KHÔNG commit (gitignore)
├── .env.local.example                   # Task 1 — commit, giá trị placeholder
├── .gitignore
├── app/
│   ├── globals.css
│   ├── layout.tsx                       # Root layout
│   ├── page.tsx                         # "/" — redirect: có session → /home, chưa → /login
│   ├── login/
│   │   └── page.tsx                     # Task 3 — form đăng nhập (Google + email/password)
│   ├── auth/
│   │   └── callback/
│   │       └── route.ts                 # Task 3 — OAuth callback handler
│   └── (protected)/
│       ├── home/
│       │   └── page.tsx                 # Task 5 — trang chủ: danh sách books
│       └── books/
│           └── [bookId]/
│               └── page.tsx             # Task 5 — danh sách lessons published của 1 book
├── lib/
│   ├── supabase/
│   │   ├── browser.ts                   # Task 2 — createBrowserSupabase()
│   │   ├── server.ts                    # Task 2 — createServerSupabase() (Server Component, đọc cookie)
│   │   └── middleware.ts                # Task 3 — updateSession() + shouldRedirectToLogin()
│   └── db/
│       ├── types.ts                     # Task 4 — Book, Lesson (subset khớp Admin's lib/db/types.ts)
│       ├── getPublishedBooks.ts         # Task 5 — list books có ít nhất 1 lesson published
│       └── getPublishedLessons.ts       # Task 5 — list lessons published của 1 book
└── tests/
    ├── lib/supabase/middleware.test.ts  # Task 3
    └── lib/db/
        ├── getPublishedBooks.test.ts     # Task 5
        └── getPublishedLessons.test.ts   # Task 5
```

**Trách nhiệm từng file:**
- `lib/supabase/browser.ts` — client Supabase cho Client Component (form đăng nhập, nút "Đăng xuất").
- `lib/supabase/server.ts` — client Supabase cho Server Component/Route Handler đọc cookie hiện tại (khác Admin: Admin's `server.ts` dùng `service-role key` bypass RLS vì Admin cần ghi mọi thứ; User App's `server.ts` dùng **anon key + cookie của user đăng nhập** để RLS áp dụng đúng theo `auth.uid()` của người dùng đó).
- `lib/supabase/middleware.ts` — logic chuyển hướng `/login` khi chưa đăng nhập, y hệt pattern Admin.
- `lib/db/getPublishedBooks.ts` / `getPublishedLessons.ts` — 2 hàm đọc dữ liệu content thuần, không phụ thuộc gì vào Scope 2-6.

## Interfaces

**Produces (dùng bởi Scope 2-6 sau này):**
- `createBrowserSupabase(): SupabaseClient` từ `lib/supabase/browser.ts`
- `createServerSupabase(): Promise<SupabaseClient>` từ `lib/supabase/server.ts` (async vì phải `await cookies()` — xem Task 2)
- `type Book = { id: string; title: string; volume: string | null }` từ `lib/db/types.ts`
- `type Lesson = { id: string; book_id: string; lesson_no: number; title_zh: string; title_vi: string; theme: string | null; status: 'draft' | 'published' }` từ `lib/db/types.ts`
- Route `(protected)/books/[bookId]/page.tsx` — điểm mà Scope 3-6 sẽ thêm link "vào bài học" trỏ tới `(protected)/lessons/[lessonId]/page.tsx` (chưa tạo trong scope này)

---

### Task 1: Scaffold dự án Next.js

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.mjs`, `postcss.config.mjs`, `eslint.config.mjs`, `.gitignore`, `.env.local.example`, `app/globals.css`, `app/layout.tsx`, `app/page.tsx`

**Interfaces:**
- Produces: dự án Next.js chạy được (`npm run dev` phục vụ trang trắng tại `/`), Tailwind 4 hoạt động, TypeScript strict mode bật.

- [ ] **Step 1: Khởi tạo git**

```bash
cd "E:\TaiwaneseEasy\TaiwaneseEasy-user"
git init
```

- [ ] **Step 2: Tạo `package.json`**

```json
{
  "name": "taiwaneseeasy-user",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint",
    "test": "vitest run"
  },
  "dependencies": {
    "@supabase/ssr": "^0.12.3",
    "@supabase/supabase-js": "^2.110.8",
    "next": "16.2.11",
    "react": "19.2.4",
    "react-dom": "19.2.4"
  },
  "devDependencies": {
    "@tailwindcss/postcss": "^4",
    "@testing-library/jest-dom": "^7.0.0",
    "@testing-library/react": "^16.3.2",
    "@types/node": "^20",
    "@types/react": "^19",
    "@types/react-dom": "^19",
    "@vitejs/plugin-react": "^6.0.4",
    "eslint": "^9",
    "eslint-config-next": "16.2.11",
    "jsdom": "^29.1.1",
    "tailwindcss": "^4",
    "typescript": "^5",
    "vitest": "^4.1.10"
  }
}
```

- [ ] **Step 3: Cài dependencies**

```bash
npm install
```

Expected: `node_modules/` được tạo, không lỗi peer-dependency nghiêm trọng (cảnh báo nhỏ có thể bỏ qua).

- [ ] **Step 4: Tạo `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2017",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 5: Tạo `next.config.mjs`**

```js
/** @type {import('next').NextConfig} */
const nextConfig = {}

export default nextConfig
```

- [ ] **Step 6: Tạo `postcss.config.mjs`**

```js
const config = {
  plugins: {
    '@tailwindcss/postcss': {},
  },
}

export default config
```

- [ ] **Step 7: Tạo `eslint.config.mjs`** (pattern giống hệt Admin — `eslint/config`'s `defineConfig`/`globalIgnores`, không dùng `FlatCompat` cũ)

```js
import { defineConfig, globalIgnores } from 'eslint/config'
import nextVitals from 'eslint-config-next/core-web-vitals'
import nextTs from 'eslint-config-next/typescript'

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([
    '.next/**',
    'out/**',
    'build/**',
    'next-env.d.ts',
  ]),
  {
    files: ['tests/**/*.ts', 'tests/**/*.tsx'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
])

export default eslintConfig
```

- [ ] **Step 8: Verify `eslint` package đã đúng version hỗ trợ `eslint/config`**

`package.json` (Step 2) đã khai `"eslint": "^9"` — đủ cho `eslint/config` export, không cần cài thêm gói nào khác.

- [ ] **Step 9: Tạo `.gitignore`**

```
node_modules/
.next/
.env.local
*.tsbuildinfo
next-env.d.ts
```

- [ ] **Step 10: Tạo `.env.local.example`**

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

- [ ] **Step 11: Tạo `app/globals.css`** (design tokens theo `docs/superpowers/specs/2026-07-31-design-system.md` — tham khảo từ mockup `E:\TaiwaneseEasy\theme tham khảo\`)

```css
@import "tailwindcss";

@theme {
  --color-cream: #FBF6EC;
  --color-card: #FFFDF8;
  --color-card-border: #EFE4CE;
  --color-accent-bg: #FBF4E4;
  --color-accent-border: #EFE1C4;

  --color-brand-red: #C1272D;
  --color-brand-red-dark: #A21E23;
  --color-brand-gold: #D4AF37;
  --color-brand-cream-text: #FFF3DC;
  --color-brand-cream-text-alt: #FFF6E4;

  --color-ink: #2B2622;
  --color-ink-muted: #7C7263;
  --color-ink-faint: #9A8F7E;
  --color-ink-fainter: #A89C88;
  --color-ink-pinyin: #B9AD98;
  --color-ink-gold-text: #B08D2E;

  --color-success-bg: #EAF6EC;
  --color-success-border: #7FBF8C;
  --color-success-text: #2E6B3A;
  --color-error-bg: #FCECEC;
  --color-error-border: #E09A9A;
  --color-error-text: #B23A3A;

  --font-ui: var(--font-nunito), system-ui, sans-serif;
  --font-han-title: var(--font-noto-serif-sc), serif;
  --font-han-body: var(--font-noto-sans-sc), sans-serif;

  --radius-card: 24px;
  --radius-card-sm: 22px;
  --radius-btn: 18px;
  --radius-pill: 999px;
}
```

- [ ] **Step 12: Tạo `app/layout.tsx`** (import font Google qua `next/font/google`, KHÔNG dùng `<link>` thủ công — tránh render-blocking)

```tsx
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
  title: 'TaiwaneseEasy',
  description: 'Ôn tập tiếng Trung phồn thể theo giáo trình Đương Đại',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi" className={`${nunito.variable} ${notoSerifSC.variable} ${notoSansSC.variable}`}>
      <body className="bg-cream font-ui text-ink">{children}</body>
    </html>
  )
}
```

- [ ] **Step 13: Tạo `app/page.tsx`** (trang gốc rỗng tạm thời — Task 3 sẽ thêm logic redirect)

```tsx
export default function RootPage() {
  return <div className="p-8">TaiwaneseEasy User App</div>
}
```

- [ ] **Step 14: Chạy dev server để xác nhận scaffold hoạt động**

Run: `npm run dev`
Expected: server khởi động không lỗi, mở `http://localhost:3000` thấy chữ "TaiwaneseEasy User App". Dừng server (Ctrl+C) sau khi xác nhận.

- [ ] **Step 15: Commit**

```bash
git add -A
git commit -m "chore: scaffold Next.js 16 + TypeScript + Tailwind 4 project"
```

---

### Task 2: Cấu hình Supabase client (browser + server)

**Files:**
- Create: `lib/supabase/browser.ts`, `lib/supabase/server.ts`

**Interfaces:**
- Consumes: biến môi trường `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (từ `.env.local`, Task này yêu cầu người dùng điền giá trị thật).
- Produces: `createBrowserSupabase(): SupabaseClient` (dùng ở Task 3 cho form login), `createServerSupabase(): Promise<SupabaseClient>` (dùng ở Task 3 cho callback route, Task 5 cho Server Component đọc `books`/`lessons`).

- [ ] **Step 1: Lấy giá trị Supabase thật từ Admin repo và điền `.env.local`**

Đọc `E:\TaiwaneseEasy\TaiwaneseEasy-admin\.env.local`, copy đúng 2 dòng `NEXT_PUBLIC_SUPABASE_URL` và `NEXT_PUBLIC_SUPABASE_ANON_KEY` (KHÔNG copy `SUPABASE_SERVICE_ROLE_KEY` — User App không cần và không nên có key này) sang file mới:

```bash
touch "E:\TaiwaneseEasy\TaiwaneseEasy-user\.env.local"
```

Rồi điền thủ công 2 dòng đó vào file (file này đã bị gitignore ở Task 1, an toàn để chứa secret thật).

- [ ] **Step 2: Tạo `lib/supabase/browser.ts`**

```ts
import { createBrowserClient } from '@supabase/ssr'

export function createBrowserSupabase() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```

- [ ] **Step 3: Tạo `lib/supabase/server.ts`**

Khác với Admin (dùng service-role key bypass RLS), User App phải đọc cookie phiên đăng nhập của chính người dùng để RLS áp dụng đúng `auth.uid()`:

```ts
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createServerSupabase() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet) => {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options)
            })
          } catch {
            // Server Component không được phép set cookie (chỉ Route Handler/Server Action
            // mới ghi được) — bỏ qua an toàn, middleware.ts sẽ refresh session thay.
          }
        },
      },
    }
  )
}
```

- [ ] **Step 4: Verify TypeScript biên dịch sạch**

Run: `npx tsc --noEmit`
Expected: không lỗi.

- [ ] **Step 5: Commit**

```bash
git add lib/supabase/browser.ts lib/supabase/server.ts
git commit -m "feat: add Supabase browser/server client factories"
```

---

### Task 3: Auth — đăng nhập Google + email/password, middleware bảo vệ route

**Files:**
- Create: `lib/supabase/middleware.ts`, `middleware.ts`, `app/login/page.tsx`, `app/auth/callback/route.ts`, `app/(protected)/home/page.tsx` (placeholder tạm, Task 5 sẽ thay nội dung thật)
- Modify: `app/page.tsx`
- Test: `tests/lib/supabase/middleware.test.ts`

**Interfaces:**
- Consumes: `createServerSupabase` (Task 2, dùng gián tiếp qua `@supabase/ssr`'s `createServerClient` trực tiếp trong middleware — middleware chạy ngoài Server Component context nên không dùng `next/headers`' `cookies()`, phải tự đọc `NextRequest.cookies`, giống hệt cách Admin làm).
- Produces: route `/login` (public), route group `(protected)/*` (chặn user chưa đăng nhập, redirect `/login`), route `/auth/callback` (OAuth redirect target).

- [ ] **Step 1: Viết test cho `shouldRedirectToLogin`**

```ts
// tests/lib/supabase/middleware.test.ts
import { describe, it, expect } from 'vitest'
import { shouldRedirectToLogin } from '@/lib/supabase/middleware'
import type { User } from '@supabase/supabase-js'

const fakeUser = { id: 'u1' } as User

describe('shouldRedirectToLogin', () => {
  it('returns true when user is null and path is not /login', () => {
    expect(shouldRedirectToLogin(null, '/home')).toBe(true)
  })

  it('returns false when user is null but path is /login', () => {
    expect(shouldRedirectToLogin(null, '/login')).toBe(false)
  })

  it('returns false when user is present', () => {
    expect(shouldRedirectToLogin(fakeUser, '/home')).toBe(false)
  })

  it('returns false for /auth/callback even when user is null', () => {
    expect(shouldRedirectToLogin(null, '/auth/callback')).toBe(false)
  })
})
```

- [ ] **Step 2: Chạy test, xác nhận fail vì file chưa tồn tại**

Run: `npx vitest run tests/lib/supabase/middleware.test.ts`
Expected: FAIL — "Cannot find module '@/lib/supabase/middleware'"

- [ ] **Step 3: Tạo `vitest.config.ts` (cần cho Step 2 chạy được — quên ở Task 1 vì chưa có test nào)**

```ts
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'node:path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
})
```

Chạy lại Step 2 sau khi tạo file này.

- [ ] **Step 4: Tạo `lib/supabase/middleware.ts`**

```ts
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import type { User } from '@supabase/supabase-js'

const PUBLIC_PATH_PREFIXES = ['/login', '/auth/callback']

export function shouldRedirectToLogin(user: User | null, pathname: string): boolean {
  if (PUBLIC_PATH_PREFIXES.some((prefix) => pathname.startsWith(prefix))) return false
  return user === null
}

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (shouldRedirectToLogin(user, request.nextUrl.pathname)) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  return response
}
```

- [ ] **Step 5: Chạy test lại, xác nhận pass**

Run: `npx vitest run tests/lib/supabase/middleware.test.ts`
Expected: PASS (4/4)

- [ ] **Step 6: Tạo `middleware.ts` ở gốc repo**

```ts
import type { NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

export async function middleware(request: NextRequest) {
  return updateSession(request)
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
```

- [ ] **Step 7: Tạo `app/auth/callback/route.ts`** (OAuth redirect target — Google login quay lại đây với `code`, đổi lấy session)

```ts
import { NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')

  if (code) {
    const supabase = await createServerSupabase()
    await supabase.auth.exchangeCodeForSession(code)
  }

  return NextResponse.redirect(`${origin}/home`)
}
```

- [ ] **Step 8: Tạo `app/login/page.tsx`** (Client Component — form email/password + nút Google)

```tsx
'use client'

import { useState } from 'react'
import { createBrowserSupabase } from '@/lib/supabase/browser'

export default function LoginPage() {
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

        {error && <p className="text-sm font-semibold text-error-text">{error}</p>}

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
```

- [ ] **Step 9: Tạo placeholder `app/(protected)/home/page.tsx`** (Task 5 sẽ thay nội dung thật — bước này chỉ để xác nhận route group + middleware hoạt động)

```tsx
export default function HomePage() {
  return <div className="p-8">Trang chủ (placeholder — Task 5 sẽ hoàn thiện)</div>
}
```

- [ ] **Step 10: Sửa `app/page.tsx`** để redirect theo trạng thái đăng nhập

```tsx
import { redirect } from 'next/navigation'
import { createServerSupabase } from '@/lib/supabase/server'

export default async function RootPage() {
  const supabase = await createServerSupabase()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  redirect(user ? '/home' : '/login')
}
```

- [ ] **Step 11: Test thủ công trên trình duyệt**

Run: `npm run dev`, mở `http://localhost:3000`.
Expected: redirect ngay tới `/login`, thấy form + nút Google. Thử đăng ký 1 tài khoản email/password thật → sau khi submit, redirect tới `/home`, thấy "Trang chủ (placeholder...)". Mở lại `http://localhost:3000` → redirect thẳng `/home` (không qua `/login` nữa, vì đã có session).

Nếu nút Google chưa hoạt động (chưa cấu hình Google OAuth provider trong Supabase Dashboard) — đây là bước cấu hình phía Supabase Dashboard, KHÔNG phải lỗi code. Ghi chú lại cho người dùng tự bật provider đó trong Supabase Dashboard → Authentication → Providers → Google (cần Google Cloud OAuth Client ID/Secret) nếu chưa từng làm.

- [ ] **Step 12: Commit**

```bash
git add -A
git commit -m "feat: add Supabase Auth (Google + email/password) with protected route middleware"
```

---

### Task 4: Kiểu dữ liệu cho `Book`/`Lesson`

**Files:**
- Create: `lib/db/types.ts`

**Interfaces:**
- Produces: `type Book`, `type Lesson`, `type LessonStatus` — dùng bởi Task 5 và mọi scope sau (Scope 3-6 sẽ mở rộng file này thêm `Dialogue`, `DialogueLine`, `VocabularyEntry`, `QuizQuestion`, ... khi cần).

- [ ] **Step 1: Tạo `lib/db/types.ts`**

Subset khớp đúng `E:\TaiwaneseEasy\TaiwaneseEasy-admin\lib\db\types.ts` (chỉ lấy phần User App cần ở Scope 1 — Task ở scope sau sẽ bổ sung thêm field khi cần, không đoán trước):

```ts
export type LessonStatus = 'draft' | 'published'

export interface Book {
  id: string
  title: string
  volume: string | null
  created_at: string
}

export interface Lesson {
  id: string
  book_id: string
  lesson_no: number
  title_zh: string
  title_vi: string
  theme: string | null
  status: LessonStatus
  created_at: string
}
```

- [ ] **Step 2: Verify TypeScript biên dịch sạch**

Run: `npx tsc --noEmit`
Expected: không lỗi.

- [ ] **Step 3: Commit**

```bash
git add lib/db/types.ts
git commit -m "feat: add Book/Lesson types"
```

---

### Task 5: Danh sách books + lessons published (trang chủ + trang chi tiết book)

**Files:**
- Create: `lib/db/getPublishedBooks.ts`, `lib/db/getPublishedLessons.ts`, `app/(protected)/books/[bookId]/page.tsx`
- Modify: `app/(protected)/home/page.tsx`
- Test: `tests/lib/db/getPublishedBooks.test.ts`, `tests/lib/db/getPublishedLessons.test.ts`

**Interfaces:**
- Consumes: `createServerSupabase` (Task 2), `Book`/`Lesson` (Task 4).
- Produces: `getPublishedBooks(): Promise<Book[]>`, `getPublishedLessons(bookId: string): Promise<Lesson[]>` — dùng bởi Scope 3-6 khi cần liệt kê lessons theo book (ví dụ trang danh sách "Ôn hôm nay" ở Scope 3 vẫn có thể cần biết book nào chứa lesson nào để hiển thị context).

- [ ] **Step 1: Viết test cho `getPublishedBooks`** (mock Supabase client)

```ts
// tests/lib/db/getPublishedBooks.test.ts
import { describe, it, expect, vi } from 'vitest'
import { getPublishedBooks } from '@/lib/db/getPublishedBooks'

describe('getPublishedBooks', () => {
  it('returns books that have at least one published lesson, ordered by volume', async () => {
    const mockBooks = [
      { id: 'b1', title: 'Đương Đại 1', volume: '1', created_at: '2026-01-01' },
    ]

    const fakeClient = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({ data: mockBooks, error: null }),
        }),
      }),
    }

    const result = await getPublishedBooks(fakeClient as never)

    expect(result).toEqual(mockBooks)
    expect(fakeClient.from).toHaveBeenCalledWith('books')
  })

  it('throws when Supabase returns an error', async () => {
    const fakeClient = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({ data: null, error: { message: 'db error' } }),
        }),
      }),
    }

    await expect(getPublishedBooks(fakeClient as never)).rejects.toThrow('db error')
  })
})
```

- [ ] **Step 2: Chạy test, xác nhận fail**

Run: `npx vitest run tests/lib/db/getPublishedBooks.test.ts`
Expected: FAIL — module không tồn tại.

- [ ] **Step 3: Tạo `lib/db/getPublishedBooks.ts`**

Lưu ý: RLS phía Supabase (đã tồn tại sẵn từ Admin CMS) đảm bảo bảng `books` chỉ trả về qua `lessons.status = 'published'` join — nhưng để đơn giản và không phụ thuộc giả định RLS phức tạp trên `books` (bảng `books` tự nó không có cột `status`), hàm này liệt kê TOÀN BỘ `books` (bảng sách không có khái niệm published/draft ở cấp sách, chỉ `lessons` có) — lọc "book có bài published" diễn ra tự nhiên vì Task sau (`getPublishedLessons`) sẽ trả rỗng nếu book đó chưa có bài nào published, và trang book sẽ tự hiển thị "chưa có bài học" thay vì ẩn hẳn cả book:

```ts
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Book } from './types'

export async function getPublishedBooks(supabase: SupabaseClient): Promise<Book[]> {
  const { data, error } = await supabase
    .from('books')
    .select('id, title, volume, created_at')
    .order('volume', { ascending: true })

  if (error) throw new Error(error.message)
  return data as Book[]
}
```

- [ ] **Step 4: Chạy test lại, xác nhận pass**

Run: `npx vitest run tests/lib/db/getPublishedBooks.test.ts`
Expected: PASS (2/2)

- [ ] **Step 5: Viết test cho `getPublishedLessons`**

```ts
// tests/lib/db/getPublishedLessons.test.ts
import { describe, it, expect, vi } from 'vitest'
import { getPublishedLessons } from '@/lib/db/getPublishedLessons'

describe('getPublishedLessons', () => {
  it('returns only published lessons for the given book, ordered by lesson_no', async () => {
    const mockLessons = [
      {
        id: 'l1',
        book_id: 'b1',
        lesson_no: 1,
        title_zh: '第一課',
        title_vi: 'Bài 1',
        theme: null,
        status: 'published',
        created_at: '2026-01-01',
      },
    ]

    const eqStatus = vi.fn().mockReturnValue({
      order: vi.fn().mockResolvedValue({ data: mockLessons, error: null }),
    })
    const eqBookId = vi.fn().mockReturnValue({ eq: eqStatus })
    const fakeClient = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({ eq: eqBookId }),
      }),
    }

    const result = await getPublishedLessons(fakeClient as never, 'b1')

    expect(result).toEqual(mockLessons)
    expect(eqBookId).toHaveBeenCalledWith('book_id', 'b1')
    expect(eqStatus).toHaveBeenCalledWith('status', 'published')
  })
})
```

- [ ] **Step 6: Chạy test, xác nhận fail**

Run: `npx vitest run tests/lib/db/getPublishedLessons.test.ts`
Expected: FAIL — module không tồn tại.

- [ ] **Step 7: Tạo `lib/db/getPublishedLessons.ts`**

```ts
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Lesson } from './types'

export async function getPublishedLessons(
  supabase: SupabaseClient,
  bookId: string
): Promise<Lesson[]> {
  const { data, error } = await supabase
    .from('lessons')
    .select('id, book_id, lesson_no, title_zh, title_vi, theme, status, created_at')
    .eq('book_id', bookId)
    .eq('status', 'published')
    .order('lesson_no', { ascending: true })

  if (error) throw new Error(error.message)
  return data as Lesson[]
}
```

- [ ] **Step 8: Chạy test lại, xác nhận pass**

Run: `npx vitest run tests/lib/db/getPublishedLessons.test.ts`
Expected: PASS (1/1)

- [ ] **Step 9: Viết `app/(protected)/home/page.tsx`** (thay placeholder Task 3 bằng nội dung thật — danh sách books)

```tsx
import Link from 'next/link'
import { createServerSupabase } from '@/lib/supabase/server'
import { getPublishedBooks } from '@/lib/db/getPublishedBooks'

export default async function HomePage() {
  const supabase = await createServerSupabase()
  const books = await getPublishedBooks(supabase)

  return (
    <div className="mx-auto max-w-[660px] px-5 py-6">
      <div className="mb-5 rounded-card border border-card-border bg-card p-6 shadow-[0_10px_30px_rgba(120,90,40,0.06)]">
        <div className="mb-2 text-xs font-bold uppercase tracking-wide text-brand-red">TaiwaneseEasy</div>
        <h1 className="font-han-title text-2xl font-bold text-ink">Chọn quyển sách</h1>
      </div>

      <ul className="flex flex-col gap-3">
        {books.map((book) => (
          <li key={book.id}>
            <Link
              href={`/books/${book.id}`}
              className="flex items-center justify-between rounded-card-sm border border-card-border bg-card px-5 py-4 font-bold text-ink shadow-[0_4px_16px_rgba(120,90,40,0.05)] transition-transform hover:-translate-y-0.5"
            >
              <span>{book.title}</span>
              {book.volume && (
                <span className="text-sm font-semibold text-ink-faint">Quyển {book.volume}</span>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
```

- [ ] **Step 10: Tạo `app/(protected)/books/[bookId]/page.tsx`** (danh sách lessons published của 1 book)

```tsx
import { createServerSupabase } from '@/lib/supabase/server'
import { getPublishedLessons } from '@/lib/db/getPublishedLessons'

export default async function BookPage({
  params,
}: {
  params: Promise<{ bookId: string }>
}) {
  const { bookId } = await params
  const supabase = await createServerSupabase()
  const lessons = await getPublishedLessons(supabase, bookId)

  return (
    <div className="mx-auto max-w-[660px] px-5 py-6">
      <div className="mb-5 rounded-card border border-card-border bg-card p-6 shadow-[0_10px_30px_rgba(120,90,40,0.06)]">
        <div className="mb-2 text-xs font-bold uppercase tracking-wide text-brand-red">Danh sách bài học</div>
        <h1 className="font-han-title text-2xl font-bold text-ink">Chọn bài để ôn tập</h1>
      </div>

      {lessons.length === 0 && (
        <p className="font-semibold text-ink-faint">Quyển này chưa có bài học nào được xuất bản.</p>
      )}

      <ul className="flex flex-col gap-3">
        {lessons.map((lesson) => (
          <li
            key={lesson.id}
            className="rounded-card-sm border border-card-border bg-card px-5 py-4 shadow-[0_4px_16px_rgba(120,90,40,0.05)]"
          >
            <span className="font-bold text-ink">Bài {lesson.lesson_no}: {lesson.title_vi}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
```

Ghi chú: `<li>` chưa có link (trang chi tiết bài học `(protected)/lessons/[lessonId]/page.tsx` thuộc Scope 3 trở đi — Scope 1 chỉ cần chứng minh danh sách đọc đúng dữ liệu).

- [ ] **Step 11: Test thủ công trên trình duyệt**

Run: `npm run dev`, đăng nhập (dùng tài khoản đã tạo ở Task 3), xác nhận:
- `/home` hiển thị đúng danh sách sách thật đang có trong Supabase (ít nhất "Đương Đại 1", theo xác nhận trước đó của bạn là đã có bài published).
- Bấm vào 1 sách → `/books/[bookId]` hiển thị đúng danh sách bài đã published của sách đó (không hiện bài `draft`).

- [ ] **Step 12: Commit**

```bash
git add -A
git commit -m "feat: list published books and lessons on home/book pages"
```

---

## Kiểm thử tổng hợp trước khi báo cáo hoàn thành Scope 1

- [ ] `npx tsc --noEmit` — sạch, không lỗi.
- [ ] `npx vitest run` — toàn bộ test pass.
- [ ] `npx eslint .` — không lỗi (cảnh báo nhỏ có thể chấp nhận).
- [ ] `npm run build` — build production thành công.
- [ ] Test thủ công đầy đủ luồng: mở `/` chưa đăng nhập → `/login` → đăng ký email/password mới → `/home` → thấy danh sách sách → bấm vào 1 sách → thấy danh sách bài published → đăng xuất (nếu đã có nút, nếu chưa thì xóa cookie thủ công để test lại middleware) → mở lại `/home` → bị đẩy về `/login`.

**Sau khi tất cả mục trên đạt: DỪNG LẠI, báo cáo người dùng kiểm tra trực tiếp trên trình duyệt của họ trước khi bắt đầu Scope 2 (migration 3 bảng progress + RLS).**
