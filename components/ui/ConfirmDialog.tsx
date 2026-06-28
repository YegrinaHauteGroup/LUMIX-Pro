'use client'

import { Modal } from './Modal'
import { Button } from './Button'

interface Props {
  open: boolean
  title?: string
  message: React.ReactNode
  confirmLabel?: string
  danger?: boolean
  loading?: boolean
  onConfirm: () => void
  onCancel: () => void
}

/** In-app confirmation. window.confirm() is blocked in some embedded/preview
 *  frames (returns false), silently aborting destructive actions — this is a
 *  reliable replacement. */
export function ConfirmDialog({ open, title = '확인', message, confirmLabel = '확인', danger, loading, onConfirm, onCancel }: Props) {
  return (
    <Modal open={open} onClose={onCancel} title={title} size="sm">
      <div className="text-[13px] text-ink-soft leading-relaxed">{message}</div>
      <div className="flex gap-2 justify-end pt-4">
        <Button variant="secondary" type="button" onClick={onCancel}>취소</Button>
        <Button type="button" loading={loading} onClick={onConfirm} className={danger ? '!bg-danger hover:!bg-danger/90' : undefined}>{confirmLabel}</Button>
      </div>
    </Modal>
  )
}
