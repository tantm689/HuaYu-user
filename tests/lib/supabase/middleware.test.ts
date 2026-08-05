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

  it('returns false for /register even when user is null', () => {
    expect(shouldRedirectToLogin(null, '/register')).toBe(false)
  })
})
