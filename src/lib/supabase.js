import { createClient } from '@supabase/supabase-js'

// The publishable key is designed to be public. Row-level security in
// supabase/schema.sql is what protects the data.
const url = import.meta.env.VITE_SUPABASE_URL || 'https://xfdidjjfjejchzyjectk.supabase.co'
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_umjPnz9W4XAqd_JTyqN7Gw_qb-pYRcA'

export const supabase = createClient(url, key)
