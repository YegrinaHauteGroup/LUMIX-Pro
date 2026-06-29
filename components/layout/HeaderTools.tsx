'use client'

import { useEffect, useRef, useState } from 'react'
import { Phone, Settings, Siren, X } from 'lucide-react'

interface Emergency { name: string; phone: string }
const LS = 'lumix_emergency_v1'

export function HeaderTools() {
  const [now, setNow] = useState<Date | null>(null)
  const [emerg, setEmerg] = useState<Emergency | null>(null)
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState<Emergency>({ name: '', phone: '' })
  const wrap = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setNow(new Date())
    const t = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(t)
  }, [])
  useEffect(() => {
    try { const raw = localStorage.getItem(LS); if (raw) setEmerg(JSON.parse(raw)) } catch { /* ignore */ }
  }, [])
  useEffect(() => {
    const h = (e: MouseEvent) => { if (open && wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [open])

  function save() {
    const next = { name: form.name.trim() || '응급 병원', phone: form.phone.trim() }
    setEmerg(next); try { localStorage.setItem(LS, JSON.stringify(next)) } catch { /* ignore */ }
    setEditing(false)
  }

  const hhmm = now ? now.toLocaleTimeString('ko-KR', { hour12: false }) : '--:--:--'
  const date = now ? now.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' }) : ''

  return (
    <div className="flex items-center gap-2">
      {/* emergency first — muted, darker red (less alarming bright red) */}
      <div ref={wrap} className="relative">
        <button onClick={() => setOpen((v) => !v)} title="응급 상황"
          className="flex items-center h-8 px-2.5 rounded-[3px] bg-[#a4524b] text-white/95 text-[10px] font-bold tracking-[0.06em] hover:bg-[#8f463f] transition-colors">
          EMERGENCY
        </button>
        {open && (
          <div className="absolute right-0 mt-1.5 w-[244px] bg-surface border border-line rounded-[4px] shadow-[var(--shadow-pop)] z-50 overflow-hidden">
            <div className="px-3 py-2.5 border-b border-line flex items-center justify-between bg-danger/5">
              <span className="flex items-center gap-1.5 text-[12px] font-semibold text-danger"><Siren size={13} /> 응급 대응</span>
              <button onClick={() => setOpen(false)} className="text-ink-faint hover:text-ink"><X size={13} /></button>
            </div>
            {!editing ? (
              <div className="px-3 py-3 space-y-2.5">
                {emerg && emerg.phone ? (
                  <>
                    <div>
                      <p className="text-[9px] text-ink-faint uppercase tracking-wider">지정 응급 병원</p>
                      <p className="text-[13px] font-semibold text-ink mt-0.5">{emerg.name}</p>
                      <p className="text-[12px] font-data text-ink-soft tabular-nums">{emerg.phone}</p>
                    </div>
                    <a href={`tel:${emerg.phone.replace(/[^0-9+]/g, '')}`}
                      className="flex items-center justify-center gap-1.5 w-full h-9 rounded-[3px] bg-danger text-white text-[13px] font-semibold hover:opacity-90">
                      <Phone size={14} /> 즉시 전화 연결
                    </a>
                  </>
                ) : (
                  <p className="text-[11.5px] text-ink-faint">지정된 응급 병원이 없습니다. 가장 가까운 병원을 등록하세요.</p>
                )}
                <button onClick={() => { setForm(emerg ?? { name: '', phone: '' }); setEditing(true) }}
                  className="flex items-center gap-1.5 text-[11px] text-ink-faint hover:text-accent"><Settings size={12} /> 응급 병원 설정</button>
              </div>
            ) : (
              <div className="px-3 py-3 space-y-2">
                <div>
                  <label className="text-[10px] text-ink-faint">병원명</label>
                  <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="○○병원 응급실"
                    className="w-full mt-0.5 px-2 py-1.5 bg-fill border border-line rounded-[3px] text-[12px] text-ink outline-none focus:border-accent" />
                </div>
                <div>
                  <label className="text-[10px] text-ink-faint">연락처</label>
                  <input value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} placeholder="02-000-0000"
                    className="w-full mt-0.5 px-2 py-1.5 bg-fill border border-line rounded-[3px] text-[12px] text-ink font-data outline-none focus:border-accent" />
                </div>
                <div className="flex items-center gap-1.5 pt-0.5">
                  <button onClick={save} className="flex-1 h-8 rounded-[3px] bg-accent text-white text-[12px] font-medium hover:bg-accent-hover">저장</button>
                  <button onClick={() => setEditing(false)} className="px-3 h-8 rounded-[3px] border border-line text-[12px] text-ink-soft hover:bg-fill">취소</button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* live clock — one block, same height as the header buttons */}
      <div className="hidden md:flex items-center gap-1.5 h-8 px-2.5 rounded-[3px] border border-line bg-fill leading-none">
        <span className="text-[11px] text-ink-faint tabular-nums">{date}</span>
        <span className="text-[12.5px] tabular-nums text-ink tracking-tight">{hhmm}</span>
      </div>
    </div>
  )
}
