'use client'

import { Calculator as CalcIcon, Delete, Pause, Play, RotateCcw, Timer as TimerIcon, Watch } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

// ── Calculator ──────────────────────────────────────────────────────────────
function Calculator() {
  const [expr, setExpr] = useState('')
  const [out, setOut] = useState('0')
  const keys = ['C', '(', ')', '÷', '7', '8', '9', '×', '4', '5', '6', '−', '1', '2', '3', '+', '0', '.', '⌫', '=']

  function evaluate(s: string): string {
    const norm = s.replace(/×/g, '*').replace(/÷/g, '/').replace(/−/g, '-')
    if (!norm.trim()) return '0'
    if (!/^[0-9+\-*/().\s]+$/.test(norm)) return '오류'
    try {
      // eslint-disable-next-line no-new-func
      const v = Function(`"use strict";return (${norm})`)()
      if (v === Infinity || v === -Infinity || Number.isNaN(v)) return '오류'
      return String(Math.round((v + Number.EPSILON) * 1e8) / 1e8)
    } catch { return '오류' }
  }

  function press(k: string) {
    if (k === 'C') { setExpr(''); setOut('0'); return }
    if (k === '⌫') { const n = expr.slice(0, -1); setExpr(n); setOut(evaluate(n)); return }
    if (k === '=') { const r = evaluate(expr); setOut(r); if (r !== '오류') setExpr(r); return }
    const n = expr + k
    setExpr(n); setOut(evaluate(n))
  }

  return (
    <div className="space-y-1.5">
      <div className="bg-ink rounded-[3px] px-2.5 py-2 text-right">
        <div className="text-[10px] text-white/45 font-data tabular-nums truncate h-3.5">{expr || ' '}</div>
        <div className="text-[18px] text-white font-data tabular-nums leading-tight truncate">{out}</div>
      </div>
      <div className="grid grid-cols-4 gap-1">
        {keys.map((k) => {
          const op = ['÷', '×', '−', '+', '='].includes(k)
          const fn = ['C', '(', ')', '⌫'].includes(k)
          return (
            <button key={k} onClick={() => press(k)}
              className={`h-8 rounded-[3px] text-[13px] font-medium transition-colors ${k === '=' ? 'col-span-1 bg-accent text-white hover:bg-accent-hover' : op ? 'bg-accent-soft/60 text-accent hover:bg-accent-soft' : fn ? 'bg-fill text-ink-faint hover:bg-fill-2' : 'bg-surface border border-line text-ink hover:bg-fill'}`}>
              {k === '⌫' ? <Delete size={13} className="mx-auto" /> : k}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ── Stopwatch ───────────────────────────────────────────────────────────────
function Stopwatch() {
  const [ms, setMs] = useState(0)
  const [running, setRunning] = useState(false)
  const [laps, setLaps] = useState<number[]>([])
  const ref = useRef<number | null>(null)
  const base = useRef(0)

  useEffect(() => {
    if (running) {
      base.current = Date.now() - ms
      ref.current = window.setInterval(() => setMs(Date.now() - base.current), 53)
    } else if (ref.current) { clearInterval(ref.current); ref.current = null }
    return () => { if (ref.current) clearInterval(ref.current) }
  }, [running])

  const fmt = (t: number) => {
    const cs = Math.floor((t % 1000) / 10), s = Math.floor(t / 1000) % 60, m = Math.floor(t / 60000)
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(cs).padStart(2, '0')}`
  }

  return (
    <div className="space-y-1.5">
      <div className="text-center text-[26px] font-data tabular-nums text-ink py-1.5 leading-none">{fmt(ms)}</div>
      <div className="grid grid-cols-3 gap-1.5">
        <button onClick={() => setRunning((v) => !v)} className={`h-8 rounded-[3px] text-[11px] font-medium inline-flex items-center justify-center gap-1 ${running ? 'bg-warn-soft text-warn' : 'bg-accent text-white hover:bg-accent-hover'}`}>
          {running ? <><Pause size={12} /> 정지</> : <><Play size={12} /> 시작</>}
        </button>
        <button onClick={() => { if (running && ms > 0) setLaps((l) => [ms, ...l]) }} disabled={!running} className="h-8 rounded-[3px] text-[11px] font-medium border border-line text-ink-soft hover:bg-fill disabled:opacity-40">랩</button>
        <button onClick={() => { setRunning(false); setMs(0); setLaps([]) }} className="h-8 rounded-[3px] text-[11px] font-medium border border-line text-ink-soft hover:bg-fill inline-flex items-center justify-center gap-1"><RotateCcw size={12} /> 초기화</button>
      </div>
      {laps.length > 0 && (
        <div className="max-h-24 overflow-y-auto border border-line rounded-[3px] divide-y divide-line">
          {laps.map((l, i) => (
            <div key={i} className="flex items-center justify-between px-2 py-1 text-[10.5px]">
              <span className="text-ink-faint">랩 {laps.length - i}</span>
              <span className="font-data tabular-nums text-ink-soft">{fmt(l)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Timer ───────────────────────────────────────────────────────────────────
function Timer() {
  const [input, setInput] = useState({ m: 5, s: 0 })
  const [left, setLeft] = useState(0)
  const [running, setRunning] = useState(false)
  const [done, setDone] = useState(false)
  const ref = useRef<number | null>(null)
  const end = useRef(0)

  useEffect(() => {
    if (running) {
      end.current = Date.now() + left
      ref.current = window.setInterval(() => {
        const rem = Math.max(0, end.current - Date.now())
        setLeft(rem)
        if (rem <= 0) { setRunning(false); setDone(true) }
      }, 100)
    } else if (ref.current) { clearInterval(ref.current); ref.current = null }
    return () => { if (ref.current) clearInterval(ref.current) }
  }, [running])

  function start() {
    const total = (input.m * 60 + input.s) * 1000
    if (total <= 0) return
    setLeft(left > 0 && !done ? left : total); setDone(false); setRunning(true)
  }
  const fmt = (t: number) => { const s = Math.ceil(t / 1000); return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}` }

  return (
    <div className="space-y-1.5">
      {running || left > 0 ? (
        <div className={`text-center text-[30px] font-data tabular-nums py-1.5 leading-none ${done ? 'text-danger animate-pulse' : 'text-ink'}`}>{done ? '00:00' : fmt(left)}</div>
      ) : (
        <div className="flex items-center justify-center gap-1 py-1.5">
          <input type="number" min={0} max={99} value={input.m} onChange={(e) => setInput((v) => ({ ...v, m: Math.max(0, Math.min(99, +e.target.value || 0)) }))} className="w-12 text-center text-[22px] font-data tabular-nums bg-surface border border-line rounded-[3px] py-1 outline-none focus:border-accent" />
          <span className="text-[22px] text-ink-faint">:</span>
          <input type="number" min={0} max={59} value={input.s} onChange={(e) => setInput((v) => ({ ...v, s: Math.max(0, Math.min(59, +e.target.value || 0)) }))} className="w-12 text-center text-[22px] font-data tabular-nums bg-surface border border-line rounded-[3px] py-1 outline-none focus:border-accent" />
        </div>
      )}
      <div className="grid grid-cols-2 gap-1.5">
        <button onClick={() => (running ? setRunning(false) : start())} className={`h-8 rounded-[3px] text-[11px] font-medium inline-flex items-center justify-center gap-1 ${running ? 'bg-warn-soft text-warn' : 'bg-accent text-white hover:bg-accent-hover'}`}>
          {running ? <><Pause size={12} /> 일시정지</> : <><Play size={12} /> 시작</>}
        </button>
        <button onClick={() => { setRunning(false); setLeft(0); setDone(false) }} className="h-8 rounded-[3px] text-[11px] font-medium border border-line text-ink-soft hover:bg-fill inline-flex items-center justify-center gap-1"><RotateCcw size={12} /> 초기화</button>
      </div>
    </div>
  )
}

type Tab = 'calc' | 'watch' | 'timer'

export function WorkspaceTools() {
  const [tab, setTab] = useState<Tab>('calc')
  const tabs: { id: Tab; label: string; icon: typeof CalcIcon }[] = [
    { id: 'calc', label: '계산기', icon: CalcIcon },
    { id: 'watch', label: '스톱워치', icon: Watch },
    { id: 'timer', label: '타이머', icon: TimerIcon },
  ]
  return (
    <div className="border border-line rounded-[3px] bg-surface overflow-hidden">
      <div className="grid grid-cols-3 border-b border-line">
        {tabs.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`inline-flex items-center justify-center gap-1 py-1.5 text-[10.5px] font-medium transition-colors ${tab === t.id ? 'bg-fill text-accent' : 'text-ink-faint hover:bg-fill-2'}`}>
            <t.icon size={12} /> {t.label}
          </button>
        ))}
      </div>
      <div className="p-2">
        {tab === 'calc' ? <Calculator /> : tab === 'watch' ? <Stopwatch /> : <Timer />}
      </div>
    </div>
  )
}
