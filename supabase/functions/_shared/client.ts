// Shared service-role Supabase client factory for edge functions (M1).
// Returns the client plus the url/key so callers that need to make
// function-to-function HTTP calls (e.g. rebuild → recompute) can reuse them.
import { createClient } from 'npm:@supabase/supabase-js@2.47.1'

export function serviceClient() {
  const url = Deno.env.get('SUPABASE_URL')
  let key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!key) {
    const raw = Deno.env.get('SUPABASE_SECRET_KEYS')
    if (raw) { try { key = JSON.parse(raw)['sb_secret_5x67m'] } catch { /* ignore */ } }
  }
  if (!url || !key) throw new Error('SUPABASE_URL / service role key required')
  const sb = createClient(url, key, { auth: { persistSession: false } })
  return { sb, url, key }
}
