import { describe, it, expect } from 'vitest'
import { calculateAge, cn } from './utils'

describe('calculateAge', () => {
  it('computes whole years for a birthday that has passed', () => {
    const d = new Date(); d.setFullYear(d.getFullYear() - 5)
    expect(calculateAge(d.toISOString().slice(0, 10))).toBe(5)
  })
  it('does not count a birthday that has not occurred yet this year', () => {
    const d = new Date(); d.setFullYear(d.getFullYear() - 5); d.setDate(d.getDate() + 2)
    expect(calculateAge(d.toISOString().slice(0, 10))).toBe(4)
  })
})

describe('cn', () => {
  it('merges class names and drops falsy values', () => {
    expect(cn('a', false && 'b', 'c')).toBe('a c')
  })
  it('lets later tailwind classes win on conflict', () => {
    expect(cn('px-2', 'px-4')).toBe('px-4')
  })
})
