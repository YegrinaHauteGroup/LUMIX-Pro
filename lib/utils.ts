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
  active: 'text-emerald-400 bg-emerald-400/10',
  inactive: 'text-red-400 bg-red-400/10',
  leave: 'text-yellow-400 bg-yellow-400/10',
}

export const ACTIVITY_TYPE_LABELS = {
  education: '교육',
  therapy: '치료',
  recreation: '레크리에이션',
  counseling: '상담',
  other: '기타',
}

export const ACTIVITY_TYPE_COLORS = {
  education: 'text-blue-400 bg-blue-400/10',
  therapy: 'text-purple-400 bg-purple-400/10',
  recreation: 'text-green-400 bg-green-400/10',
  counseling: 'text-orange-400 bg-orange-400/10',
  other: 'text-gray-400 bg-gray-400/10',
}

export const ACTIVITY_STATUS_LABELS = {
  planned: '예정',
  ongoing: '진행중',
  completed: '완료',
  cancelled: '취소',
}

export const ACTIVITY_STATUS_COLORS = {
  planned: 'text-blue-400 bg-blue-400/10',
  ongoing: 'text-emerald-400 bg-emerald-400/10',
  completed: 'text-gray-400 bg-gray-400/10',
  cancelled: 'text-red-400 bg-red-400/10',
}

export const ATTENDANCE_STATUS_LABELS = {
  present: '출석',
  absent: '결석',
  late: '지각',
  leave: '조퇴',
}

export const ATTENDANCE_STATUS_COLORS = {
  present: 'text-emerald-400 bg-emerald-400/10',
  absent: 'text-red-400 bg-red-400/10',
  late: 'text-yellow-400 bg-yellow-400/10',
  leave: 'text-orange-400 bg-orange-400/10',
}
