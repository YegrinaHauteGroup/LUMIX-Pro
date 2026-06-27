import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Guard any thenable (incl. Supabase query builders / functions.invoke) with a
 * timeout so a hanging network call can never freeze the UI in a loading state.
 */
export function withTimeout<T>(p: PromiseLike<T>, ms = 30000, msg = '요청 시간이 초과되었습니다. 네트워크 상태를 확인하세요.'): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(msg)), ms)
    Promise.resolve(p).then(
      (v) => { clearTimeout(t); resolve(v) },
      (e) => { clearTimeout(t); reject(e) },
    )
  })
}

export function formatDate(dateStr: string): string {
  const date = new Date(dateStr)
  return date.toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

export function formatDateShort(dateStr: string): string {
  const date = new Date(dateStr)
  return date.toLocaleDateString('ko-KR', {
    month: '2-digit',
    day: '2-digit',
  })
}

export function calculateAge(birthDate: string): number {
  const today = new Date()
  const birth = new Date(birthDate)
  let age = today.getFullYear() - birth.getFullYear()
  const m = today.getMonth() - birth.getMonth()
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
    age--
  }
  return age
}

export const GENDER_LABELS = {
  male: '남',
  female: '여',
  other: '기타',
}

export const CHILD_STATUS_LABELS = {
  active: '재원',
  inactive: '퇴원',
  leave: '휴원',
}

export const CHILD_STATUS_COLORS = {
  active: 'text-emerald-700 bg-emerald-50',
  inactive: 'text-rose-700 bg-rose-50',
  leave: 'text-amber-700 bg-amber-50',
}

export const ACTIVITY_TYPE_LABELS = {
  education: '교육',
  therapy: '치료',
  recreation: '레크리에이션',
  counseling: '상담',
  other: '기타',
}

export const ACTIVITY_TYPE_COLORS = {
  education: 'text-indigo-700 bg-indigo-50',
  therapy: 'text-violet-700 bg-violet-50',
  recreation: 'text-green-700 bg-green-50',
  counseling: 'text-orange-700 bg-orange-50',
  other: 'text-slate-600 bg-slate-100',
}

export const ACTIVITY_STATUS_LABELS = {
  planned: '예정',
  ongoing: '진행중',
  completed: '완료',
  cancelled: '취소',
}

export const ACTIVITY_STATUS_COLORS = {
  planned: 'text-indigo-700 bg-indigo-50',
  ongoing: 'text-emerald-700 bg-emerald-50',
  completed: 'text-slate-600 bg-slate-100',
  cancelled: 'text-rose-700 bg-rose-50',
}

export const ATTENDANCE_STATUS_LABELS = {
  present: '출석',
  absent: '결석',
  late: '지각',
  leave: '조퇴',
}

export const ATTENDANCE_STATUS_COLORS = {
  present: 'text-emerald-700 bg-emerald-50',
  absent: 'text-rose-700 bg-rose-50',
  late: 'text-amber-700 bg-amber-50',
  leave: 'text-orange-700 bg-orange-50',
}
