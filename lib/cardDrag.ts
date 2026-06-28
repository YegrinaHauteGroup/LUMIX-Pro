// Shared drag-and-drop bridge: any card can be dragged into the workspace,
// carrying its full rendered content so nothing is stored in isolation.

export const WS_DRAG_MIME = 'application/x-lumix-card'

export interface CardDragPayload { source: string; title: string; body: string }

/** Attach to a card's onDragStart. Skips drags that begin on interactive
 *  elements so inputs/buttons/links keep working. */
export function cardDragStart(e: React.DragEvent, source = '카드', title?: string) {
  const t = e.target as HTMLElement
  if (t.closest('input,textarea,select,button,a,[contenteditable="true"]')) { e.preventDefault(); return }
  const el = e.currentTarget as HTMLElement
  const text = (el.innerText || '').replace(/\n{3,}/g, '\n\n').trim().slice(0, 6000)
  if (!text) { e.preventDefault(); return }
  const heading = el.querySelector('h1,h2,h3,[data-card-title]')?.textContent?.trim()
  const payload: CardDragPayload = { source, title: (title || heading || text.split('\n')[0] || '카드').slice(0, 90), body: text }
  try {
    e.dataTransfer.setData(WS_DRAG_MIME, JSON.stringify(payload))
    e.dataTransfer.setData('text/plain', text)
    e.dataTransfer.effectAllowed = 'copy'
  } catch { /* ignore */ }
}

/** Parse a drop event into a workspace payload (falls back to plain text). */
export function parseCardDrop(e: React.DragEvent): CardDragPayload | null {
  try {
    const raw = e.dataTransfer.getData(WS_DRAG_MIME)
    if (raw) return JSON.parse(raw)
  } catch { /* ignore */ }
  const text = e.dataTransfer.getData('text/plain')
  if (text && text.trim()) return { source: '드래그', title: text.trim().split('\n')[0].slice(0, 80), body: text.trim().slice(0, 6000) }
  return null
}

export function hasCardDrag(e: React.DragEvent): boolean {
  return Array.from(e.dataTransfer.types).includes(WS_DRAG_MIME) || e.dataTransfer.types.includes('text/plain')
}
