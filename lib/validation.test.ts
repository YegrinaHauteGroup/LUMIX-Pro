import { describe, it, expect } from 'vitest'
import { childFormSchema, integrateMemosSchema, parseOr } from './validation'

describe('childFormSchema', () => {
  it('accepts a minimal valid child', () => {
    expect(childFormSchema.safeParse({ name: '홍길동', gender: 'male', status: 'active' }).success).toBe(true)
  })
  it('rejects an empty name', () => {
    expect(childFormSchema.safeParse({ name: '', gender: 'male', status: 'active' }).success).toBe(false)
  })
  it('rejects an invalid gender', () => {
    expect(childFormSchema.safeParse({ name: '아무개', gender: 'x', status: 'active' }).success).toBe(false)
  })
  it('rejects a malformed birth_date', () => {
    expect(childFormSchema.safeParse({ name: '아무개', gender: 'female', status: 'active', birth_date: '2020/01/01' }).success).toBe(false)
  })
  it('allows an empty birth_date string', () => {
    expect(childFormSchema.safeParse({ name: '아무개', gender: 'female', status: 'active', birth_date: '' }).success).toBe(true)
  })
})

describe('integrateMemosSchema', () => {
  it('rejects an empty memo list', () => {
    expect(integrateMemosSchema.safeParse({ memos: [] }).success).toBe(false)
  })
  it('accepts at least one memo', () => {
    expect(integrateMemosSchema.safeParse({ memos: [{ body: 'hello', source: 'workspace' }] }).success).toBe(true)
  })
})

describe('parseOr', () => {
  it('returns ok with parsed data on success', () => {
    const r = parseOr(childFormSchema, { name: '김철수', gender: 'male', status: 'active' })
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.data.name).toBe('김철수')
  })
  it('returns a first-error message on failure', () => {
    const r = parseOr(childFormSchema, { name: '', gender: 'male', status: 'active' })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(typeof r.error).toBe('string')
  })
})
