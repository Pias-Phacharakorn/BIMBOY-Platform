import React from 'react'

export interface ModalProps {
  isOpen: boolean
  onClose: () => void
  children?: React.ReactNode
}

export function Modal({ isOpen, onClose, children }: ModalProps) {
  if (!isOpen) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-surface rounded p-6 max-w-lg w-full relative">
        <button onClick={onClose} className="absolute top-2 right-2">Close</button>
        {children}
      </div>
    </div>
  )
}
