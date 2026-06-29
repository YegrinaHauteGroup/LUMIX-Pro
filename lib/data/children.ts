// Data-access layer for the children/classes domain (H3). Pages call these
// helpers instead of issuing Supabase queries inline, so the query shapes,
// center scoping, soft-delete filters and "data ?? []" handling live in one
// place and stay consistent.
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Child } from '@/lib/types'

interface ClassLite { id: string; name: string }
interface ClassFull { id: string; name: string; children: { id: string; name: string; gender: string | null; status: string }[] }
interface StaffLite { id: string; name: string; role: string }
interface ChildLite { id: string; name: string; class_id: string | null; status: string }

export interface ChildrenPageData {
  children: Child[]
  classList: ClassLite[]
  classesFull: ClassFull[]
  staff: StaffLite[]
  allChildren: ChildLite[]
  centerName: string | null
  unassigned: { id: string; name: string; status: string }[]
}

export async function fetchChildrenPageData(supabase: SupabaseClient, centerId: string): Promise<ChildrenPageData> {
  const cid = centerId ?? ''
  const [childrenRes, classListRes, classesFullRes, staffRes, allChildrenRes, centerRes] = await Promise.all([
    supabase.from('children').select('*, classes(id, name)').eq('center_id', cid).is('deleted_at', null).order('name'),
    supabase.from('classes').select('id, name').eq('center_id', cid).is('deleted_at', null).order('name'),
    supabase.from('classes').select('*, children(id, name, gender, status)').eq('center_id', cid).is('deleted_at', null).order('name'),
    supabase.from('staff_profiles').select('id, name, role').eq('center_id', cid).is('deleted_at', null).order('name'),
    supabase.from('children').select('id, name, class_id, status').eq('center_id', cid).is('deleted_at', null).order('name'),
    supabase.from('centers').select('name').eq('id', cid).maybeSingle(),
  ])
  const allChildren = (allChildrenRes.data ?? []) as ChildLite[]
  return {
    children: (childrenRes.data ?? []) as Child[],
    classList: (classListRes.data ?? []) as ClassLite[],
    classesFull: (classesFullRes.data ?? []) as ClassFull[],
    staff: (staffRes.data ?? []) as StaffLite[],
    allChildren,
    centerName: (centerRes.data?.name as string | undefined) ?? null,
    unassigned: allChildren.filter((c) => !c.class_id).map((c) => ({ id: c.id, name: c.name, status: c.status })),
  }
}
