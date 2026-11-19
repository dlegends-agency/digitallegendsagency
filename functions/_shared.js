// Shared by the Cloudflare Pages Functions in this folder. The publishable key is public by design;
// row-level security in supabase/schema.sql decides what it can read (published posts only).
export const SUPABASE_URL = 'https://xfdidjjfjejchzyjectk.supabase.co'
export const SUPABASE_KEY = 'sb_publishable_umjPnz9W4XAqd_JTyqN7Gw_qb-pYRcA'

export const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')

export async function rest(env, path) {
  const base = env.SUPABASE_URL || SUPABASE_URL
  const key = env.SUPABASE_PUBLISHABLE_KEY || SUPABASE_KEY
  const res = await fetch(`${base}/rest/v1/${path}`, { headers: { apikey: key } })
  if (!res.ok) throw new Error(`Supabase ${res.status}`)
  return res.json()
}
