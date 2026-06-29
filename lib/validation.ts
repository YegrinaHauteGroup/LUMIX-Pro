// Centralized runtime validation (C6). TypeScript types are erased at runtime,
// so anything crossing a trust boundary — API request bodies, form submissions —
// is validated with zod here instead of being trusted blindly.
import { z } from 'zod'

export const genderSchema = z.enum(['male', 'female', 'other'])
export const childStatusSchema = z.enum(['active', 'leave', 'inactive'])

// A child create/update form payload.
export const childFormSchema = z.object({
  name: z.string().trim().min(1, '이름을 입력하세요').max(60, '이름이 너무 깁니다'),
  birth_date: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, '생년월일 형식이 올바르지 않습니다').or(z.literal('')).nullable().optional(),
  gender: genderSchema,
  class_id: z.string().uuid().or(z.literal('')).nullable().optional(),
  status: childStatusSchema,
  guardian_name: z.string().trim().max(60).optional().nullable(),
  guardian_phone: z.string().trim().max(30).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
})
export type ChildFormInput = z.infer<typeof childFormSchema>

// One workspace memo being integrated into facility data.
export const memoSchema = z.object({
  title: z.string().max(200).optional(),
  body: z.string().max(20000).optional(),
  mentions: z.array(z.string()).max(200).optional(),
  source: z.string().max(60).optional(),
})
export const integrateMemosSchema = z.object({
  memos: z.array(memoSchema).min(1, '통합할 메모가 없습니다').max(100, '한 번에 100개까지 통합할 수 있습니다'),
})

/** Convenience: returns either parsed data or a flat first-error message. */
export function parseOr<T>(schema: z.ZodType<T>, input: unknown): { ok: true; data: T } | { ok: false; error: string } {
  const r = schema.safeParse(input)
  if (r.success) return { ok: true, data: r.data }
  return { ok: false, error: r.error.issues[0]?.message ?? '입력값이 올바르지 않습니다' }
}
