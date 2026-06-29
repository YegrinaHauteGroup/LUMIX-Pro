// ============================================================
// Shared center-membership guard for edge functions (C2)
// ------------------------------------------------------------
// Edge functions run with the service-role key, which bypasses RLS. Without an
// explicit check, any authenticated JWT could operate on any center. This
// verifies the caller's JWT and that they actually belong to the center they
// are acting on (mirrors public.current_user_center_id():
// staff_profiles.user_id = auth.uid()). service_role tokens — used for trusted
// function-to-function calls — are allowed through.
// ============================================================

function jwtRole(token: string): string | null {
  try {
    const part = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
    const pad = part + '='.repeat((4 - (part.length % 4)) % 4)
    return JSON.parse(atob(pad)).role ?? null
  } catch {
    return null
  }
}

// deno-lint-ignore no-explicit-any
export async function assertCenterMember(req: Request, sb: any, centerId: string): Promise<boolean> {
  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '').trim()
  if (!token) return false
  if (jwtRole(token) === 'service_role') return true // trusted internal call
  const { data: u, error } = await sb.auth.getUser(token)
  if (error || !u?.user) return false
  const { data } = await sb.from('staff_profiles')
    .select('center_id').eq('user_id', u.user.id).is('deleted_at', null).limit(1).maybeSingle()
  return !!data && data.center_id === centerId
}
