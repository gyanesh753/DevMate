import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://ojzryjcxobhzjnqehveh.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9qenJ5amN4b2JoempucWVodmVoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUzMzAzNjEsImV4cCI6MjA5MDkwNjM2MX0.NnD6gibPO45gdGMV2x56re3P_ht305m-MBPaZVlFmJw'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
