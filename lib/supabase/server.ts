import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createServerSupabase() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      // Distinct cookie name from the Admin app - see lib/supabase/browser.ts.
      cookieOptions: { name: 'sb-user-auth-token' },
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
