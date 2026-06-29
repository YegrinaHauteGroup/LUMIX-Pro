'use client'

import { clock, useClock } from '@/lib/workspaceClock'
import { BellRing, X } from 'lucide-react'
import { useEffect, useRef } from 'react'

// Top-right popup that announces a finished workspace timer. Lives at the app
// shell level so it shows no matter which tool tab (or page) is active.
export function TimerToast() {
  const { completedAt } = useClock()
  const audioRef = useRef(false)

  useEffect(() => {
    if (!completedAt) { audioRef.current = false; return }
    // soft chime via WebAudio (no asset needed); guarded so it plays once
    if (!audioRef.current) {
      audioRef.current = true
      try {
        const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
        const ctx = new AC()
        ;[0, 0.18, 0.36].forEach((t) => {
          const o = ctx.createOscillator(), g = ctx.createGain()
          o.frequency.value = 880; o.type = 'sine'
          o.connect(g); g.connect(ctx.destination)
          g.gain.setValueAtTime(0.0001, ctx.currentTime + t)
          g.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + t + 0.02)
          g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + t + 0.16)
          o.start(ctx.currentTime + t); o.stop(ctx.currentTime + t + 0.18)
        })
      } catch { /* audio not available */ }
    }
    const id = setTimeout(() => clock.clearCompleted(), 12000)
    return () => clearTimeout(id)
  }, [completedAt])

  if (!completedAt) return null
  return (
    <div className="fixed top-3 right-3 z-[200] animate-[slideIn_.25s_ease-out]">
      <div className="flex items-start gap-2.5 w-[300px] px-3.5 py-3 bg-surface border border-accent rounded-[4px] shadow-[0_12px_32px_rgba(16,22,26,0.22)]">
        <span className="mt-0.5 w-7 h-7 shrink-0 rounded-full bg-accent-soft flex items-center justify-center">
          <BellRing size={15} className="text-accent" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-semibold text-ink">타이머 종료</p>
          <p className="text-[11.5px] text-ink-faint mt-0.5">설정한 시간이 모두 경과했습니다.</p>
        </div>
        <button onClick={() => clock.clearCompleted()} className="text-ink-faint hover:text-ink shrink-0"><X size={14} /></button>
      </div>
    </div>
  )
}
