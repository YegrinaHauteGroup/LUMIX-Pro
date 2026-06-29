import {
  CalendarDays, ClipboardCheck, ClipboardList,
  Home, Network, Settings, ShieldAlert, Sparkles, Users, type LucideIcon,
} from 'lucide-react'

export interface NavItem { href: string; label: string; icon: LucideIcon }
export interface NavGroup { label: string; items: NavItem[] }

export const NAV_GROUPS: NavGroup[] = [
  {
    label: '통합 운영체계',
    items: [
      { href: '/dashboard', icon: Home, label: '통합 대시보드' },
      { href: '/children', icon: Users, label: '아동·반 관리 체계' },
      { href: '/activities', icon: CalendarDays, label: '활동 관리' },
      { href: '/attendance', icon: ClipboardList, label: '출결 관리 시스템' },
    ],
  },
  {
    label: '다중 분석체계',
    items: [
      { href: '/sna', icon: Network, label: '객체 그래프 · Vertex' },
      { href: '/quests', icon: Sparkles, label: '퀘스트 분석 엔진' },
    ],
  },
]

export const SETTINGS_ITEM: NavItem = { href: '/settings', label: '설정', icon: Settings }

/** Resolve a pathname to a breadcrumb [groupLabel, pageLabel]. */
export function resolveBreadcrumb(pathname: string): { group: string; page: string } {
  if (pathname.startsWith('/settings')) return { group: '시스템', page: '설정' }
  let best: { group: string; item: NavItem } | null = null
  for (const g of NAV_GROUPS) {
    for (const it of g.items) {
      if (pathname === it.href || pathname.startsWith(it.href + '/')) {
        if (!best || it.href.length > best.item.href.length) best = { group: g.label, item: it }
      }
    }
  }
  if (best) {
    const detail = pathname !== best.item.href && pathname.startsWith(best.item.href + '/')
    return { group: best.group, page: best.item.label + (detail ? ' · 상세' : '') }
  }
  return { group: 'LUMIX Pro', page: '' }
}

/** Tables whose edit history is relevant to a given route (for the header history popover). */
export function auditTablesFor(pathname: string): string[] {
  if (pathname.startsWith('/children')) return ['children', 'classes', 'health_profiles', 'child_guardians', 'care_notes']
  if (pathname.startsWith('/attendance')) return ['attendances']
  if (pathname.startsWith('/classes')) return ['classes']
  if (pathname.startsWith('/activities')) return ['activities']
  if (pathname.startsWith('/assessments')) return ['peer_assessments', 'staff_child_assessments', 'guardian_child_assessments']
  if (pathname.startsWith('/sna')) return ['interactions', 'sna_entities']
  if (pathname.startsWith('/quests')) return ['analysis_quests']
  return [] // dashboard / reports / settings → all tables
}

export const TABLE_LABELS: Record<string, string> = {
  children: '아동', health_profiles: '건강 프로필', child_guardians: '보호자 연결', care_notes: '돌봄 기록',
  attendances: '출결', classes: '반', activities: '활동', peer_assessments: '또래 평가',
  staff_child_assessments: '교사 평가', guardian_child_assessments: '보호자 평가',
  interactions: '관계 엣지', sna_entities: 'SNA 노드', analysis_quests: '분석 퀘스트',
  guardian_profiles: '보호자', meal_logs: '식사 기록',
}
export const ACTION_LABELS: Record<string, string> = { create: '추가', update: '수정', delete: '삭제', view: '조회' }
