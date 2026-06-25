import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
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
  active: 'text-[#3FB950] bg-[rgba(63,185,80,0.15)]',
  inactive: 'text-[#F85149] bg-[rgba(248,81,73,0.15)]',
  leave: 'text-[#D29922] bg-[rgba(210,153,34,0.16)]',
}

export const ACTIVITY_TYPE_LABELS = {
  education: '교육',
  therapy: '치료',
  recreation: '레크리에이션',
  counseling: '상담',
  other: '기타',
}

export const ACTIVITY_TYPE_COLORS = {
  education: 'text-[#58A6FF] bg-[rgba(88,166,255,0.14)]',
  therapy: 'text-[#bc8cff] bg-[rgba(188,140,255,0.16)]',
  recreation: 'text-[#3FB950] bg-[rgba(63,185,80,0.15)]',
  counseling: 'text-[#D29922] bg-[rgba(210,153,34,0.16)]',
  other: 'text-ink-soft bg-fill',
}

export const ACTIVITY_STATUS_LABELS = {
  planned: '예정',
  ongoing: '진행중',
  completed: '완료',
  cancelled: '취소',
}

export const ACTIVITY_STATUS_COLORS = {
  planned: 'text-[#58A6FF] bg-[rgba(88,166,255,0.14)]',
  ongoing: 'text-[#3FB950] bg-[rgba(63,185,80,0.15)]',
  completed: 'text-ink-soft bg-fill',
  cancelled: 'text-[#F85149] bg-[rgba(248,81,73,0.15)]',
}

export const ATTENDANCE_STATUS_LABELS = {
  present: '출석',
  absent: '결석',
  late: '지각',
  leave: '조퇴',
}

export const ATTENDANCE_STATUS_COLORS = {
  present: 'text-[#3FB950] bg-[rgba(63,185,80,0.15)]',
  absent: 'text-[#F85149] bg-[rgba(248,81,73,0.15)]',
  late: 'text-[#D29922] bg-[rgba(210,153,34,0.16)]',
  leave: 'text-[#58A6FF] bg-[rgba(88,166,255,0.14)]',
}
