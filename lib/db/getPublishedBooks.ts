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
