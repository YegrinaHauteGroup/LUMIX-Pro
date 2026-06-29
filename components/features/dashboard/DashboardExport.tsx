'use client'

// Report export (M6). The reports surface was merged into the dashboard, so
// export lives here: a multi-section CSV (Excel-friendly, UTF-8 BOM) of the
// dashboard's tables, plus print-to-PDF via the browser.
import { Download, FileSpreadsheet, Printer } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

export interface ExportSection { title: string; cols: string[]; rows: (string | number)[][] }

function csvEscape(v: string | number): string {
  const s = String(v ?? '')
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export function DashboardExport({ sections, facilityName }: { sections: ExportSection[]; facilityName?: string | null }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    function onDoc(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  function downloadCsv() {
    const lines: string[] = [`${facilityName ?? '운영'} 대시보드 보고서,${new Date().toLocaleString('ko-KR')}`]
    sections.forEach((sec) => {
      lines.push('', csvEscape(sec.title), sec.cols.map(csvEscape).join(','))
      sec.rows.forEach((r) => lines.push(r.map(csvEscape).join(',')))
    })
    const blob = new Blob(['﻿' + lines.join('\n')], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `dashboard_${new Date().toISOString().slice(0, 10)}.csv`; a.click()
    URL.revokeObjectURL(url); setOpen(false)
  }

  function printReport() { setOpen(false); setTimeout(() => window.print(), 50) }

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1 h-7 px-2 rounded-[3px] border border-line text-[11px] text-ink-soft hover:bg-fill">
        <Download size={12} /> 내보내기
      </button>
      {open && (
        <div className="absolute right-0 mt-1 z-20 w-40 bg-surface border border-line rounded-[4px] shadow-[var(--shadow-pop)] overflow-hidden">
          <button onClick={downloadCsv} className="w-full flex items-center gap-2 px-3 py-2 text-[12px] text-ink-soft hover:bg-fill">
            <FileSpreadsheet size={13} className="text-[#3f9e7c]" /> CSV (Excel)
          </button>
          <button onClick={printReport} className="w-full flex items-center gap-2 px-3 py-2 text-[12px] text-ink-soft hover:bg-fill border-t border-line">
            <Printer size={13} className="text-accent" /> 인쇄 · PDF
          </button>
        </div>
      )}
    </div>
  )
}
