import { createClient } from '@supabase/supabase-js'
const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
export const configurationError =
  !url || !key ? 'Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY to start DevMate.' : null
export const supabase = configurationError ? null : createClient(url, key)
