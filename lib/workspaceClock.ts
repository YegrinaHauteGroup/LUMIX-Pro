'use client'

// Module-level stopwatch + timer store. Living outside the React tree means the
// clock keeps running across tool-tab switches, panel collapse, and route
// changes — fixing the "switching tools resets the timer" bug — and lets a
// global toast fire when a timer completes regardless of what's mounted.

import { useSyncExternalStore } from 'react'

export interface ClockSnapshot {
  sw: { running: boolean; elapsed: number; laps: number[] }
  tm: { running: boolean; remaining: number; total: number; done: boolean }
  /** timestamp of the most recent timer completion (drives the toast) */
  completedAt: number | null
}

const listeners = new Set<() => void>()

// internal mutable state (not exposed directly)
let swRunning = false
let swBase = 0          // Date.now() - elapsed, while running
let swElapsed = 0
let swLaps: number[] = []

let tmRunning = false
let tmEndAt = 0
let tmRemaining = 0
let tmTotal = 0
let tmDone = false
let completedAt: number | null = null

let snapshot: ClockSnapshot = buildSnapshot()
let raf = 0

function buildSnapshot(): ClockSnapshot {
  return {
    sw: { running: swRunning, elapsed: swElapsed, laps: swLaps },
    tm: { running: tmRunning, remaining: tmRemaining, total: tmTotal, done: tmDone },
    completedAt,
  }
}

function emit() {
  snapshot = buildSnapshot()
  listeners.forEach((l) => l())
}

function ensureTicking() {
  if (raf || (!swRunning && !tmRunning)) return
  const tick = () => {
    const now = Date.now()
    if (swRunning) swElapsed = now - swBase
    if (tmRunning) {
      tmRemaining = Math.max(0, tmEndAt - now)
      if (tmRemaining <= 0) { tmRunning = false; tmDone = true; completedAt = now }
    }
    emit()
    raf = (swRunning || tmRunning) ? window.setTimeout(tick, 60) as unknown as number : 0
  }
  raf = window.setTimeout(tick, 60) as unknown as number
}

export const clock = {
  // ── stopwatch ──
  swToggle() {
    if (swRunning) { swElapsed = Date.now() - swBase; swRunning = false }
    else { swBase = Date.now() - swElapsed; swRunning = true; ensureTicking() }
    emit()
  },
  swLap() { if (swRunning && swElapsed > 0) { swLaps = [swElapsed, ...swLaps]; emit() } },
  swReset() { swRunning = false; swElapsed = 0; swBase = 0; swLaps = []; emit() },

  // ── timer ──
  tmStart(totalMs: number) {
    if (totalMs <= 0 && tmRemaining <= 0) return
    const ms = tmRemaining > 0 && !tmDone ? tmRemaining : totalMs
    if (ms <= 0) return
    tmTotal = tmDone || tmRemaining <= 0 ? totalMs : tmTotal || totalMs
    tmRemaining = ms; tmEndAt = Date.now() + ms; tmDone = false; tmRunning = true
    ensureTicking(); emit()
  },
  tmPause() { if (tmRunning) { tmRemaining = Math.max(0, tmEndAt - Date.now()); tmRunning = false; emit() } },
  tmReset() { tmRunning = false; tmRemaining = 0; tmTotal = 0; tmDone = false; emit() },
  clearCompleted() { completedAt = null; tmDone = false; emit() },

  subscribe(l: () => void) { listeners.add(l); return () => { listeners.delete(l) } },
  get: () => snapshot,
}

export function useClock(): ClockSnapshot {
  return useSyncExternalStore(clock.subscribe, clock.get, clock.get)
}
