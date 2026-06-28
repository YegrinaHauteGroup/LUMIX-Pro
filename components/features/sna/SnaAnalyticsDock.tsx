'use client'

import { useState, type ComponentProps } from 'react'
import { ThreatsClient } from '../threats/ThreatsClient'
import { AssessmentsClient } from '../assessments/AssessmentsClient'
import { Drawer } from '@/components/ui/Drawer'
import { ChevronDown, ChevronUp, ShieldAlert, SlidersHorizontal, Users, UserCheck, Heart } from 'lucide-react'

type Assess = Omit<ComponentProps<typeof AssessmentsClient>, 'embedded'>

interface Props {
  centerId: string
  threats: ComponentProps<typeof ThreatsClient>['initial']
  assess: Assess
}

/** Collapsible analytics dock under the object graph: live threat detection
 *  (left) + a slide-in weight/assessment editor (right, workspace-safe). */
export function SnaAnalyticsDock({ centerId, threats, assess }: Props) {
  const [open, setOpen] = useState(true)
  const [drawer, setDrawer] = useState(false)

  const counts = [
    { label: '또래 평가', value: assess.peerAssessments?.length ?? 0, icon: Users },
    { label: '교사 평가', value: assess.staffAssessments?.length ?? 0, icon: UserCheck },
    { label: '보호자 평가', value: assess.guardianAssessments?.length ?? 0, icon: Heart },
  ]

  return (
    <div className="shrink-0 border-t border-line bg-canvas">
      <button onClick={() => setOpen((o) => !o)}
        className="w-full h-9 px-4 flex items-center justify-between hover:bg-fill transition-colors">
        <span className="flex items-center gap-2 text-[11px] font-semibold text-ink-faint uppercase tracking-wider">
          <ShieldAlert size={13} className="text-accent" /> 위협 탐지 · 가중치 입력
        </span>
        <span className="flex items-center gap-1 text-[10px] text-ink-faint">{open ? '접기' : '펼치기'} {open ? <ChevronDown size={13} /> : <ChevronUp size={13} />}</span>
      </button>

      {open && (
        <div className="h-[44vh] grid grid-cols-1 xl:grid-cols-[1.5fr_1fr] border-t border-line">
          {/* threats */}
          <div className="flex flex-col min-h-0 overflow-hidden xl:border-r border-line">
            <ThreatsClient centerId={centerId} initial={threats} />
          </div>
          {/* weights / assessments summary + slide-in editor trigger */}
          <div className="min-h-0 overflow-y-auto p-4 flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <SlidersHorizontal size={14} className="text-accent" />
              <h3 className="text-[12px] font-semibold text-ink">가중치·평가 입력</h3>
            </div>
            <p className="text-[11px] text-ink-faint leading-relaxed">또래·교사·보호자 평가와 온톨로지 규칙으로 관계망 가중치를 입력합니다. 세부 입력은 우측 패널에서 진행하세요.</p>
            <div className="grid grid-cols-3 gap-2">
              {counts.map((c) => (
                <div key={c.label} className="bg-surface border border-line rounded-[3px] px-2.5 py-2 text-center">
                  <c.icon size={13} className="text-accent mx-auto mb-1" />
                  <p className="text-[16px] font-semibold text-ink font-data leading-none">{c.value}</p>
                  <p className="text-[9px] text-ink-faint mt-1">{c.label}</p>
                </div>
              ))}
            </div>
            <button onClick={() => setDrawer(true)}
              className="mt-auto inline-flex items-center justify-center gap-1.5 h-9 rounded-[3px] bg-accent text-white text-[12px] font-medium hover:bg-accent-hover">
              <SlidersHorizontal size={13} /> 가중치·평가 입력 열기
            </button>
          </div>
        </div>
      )}

      {/* slide-in editor (opens left of the workspace, never covering it) */}
      <Drawer open={drawer} onClose={() => setDrawer(false)} title="가중치·평가 입력" subtitle="또래·교사·보호자 평가 · 온톨로지 규칙" width={540}>
        <AssessmentsClient embedded {...assess} />
      </Drawer>
    </div>
  )
}
