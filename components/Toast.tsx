'use client'

interface ToastProps {
  msg: string
  type: 'success' | 'danger'
}

export default function Toast({ msg, type }: ToastProps) {
  return (
    <div className={`toast ${type}`}>
      <span>{type === 'success' ? '\u2713' : '\u2715'}</span>
      {msg}
    </div>
  )
}
