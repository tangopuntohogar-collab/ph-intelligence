'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { MoreVertical, Pencil, Trash2, X } from 'lucide-react'
import { User } from '@/types'

function DeleteModal({
  vendor,
  onClose,
  onDeleted,
}: {
  vendor: { id: string; full_name: string }
  onClose: () => void
  onDeleted: () => void
}) {
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleDelete = async () => {
    setDeleting(true)
    setError(null)
    try {
      const res = await fetch(`/api/vendors?id=${vendor.id}`, { method: 'DELETE' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Error al eliminar')
      onDeleted()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error inesperado')
      setDeleting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-surface rounded-xl shadow-xl w-full max-w-sm mx-4 p-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-body">Eliminar vendedor</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-body">
            <X size={20} />
          </button>
        </div>

        <p className="text-sm text-gray-500 mb-2">
          ¿Estás seguro que querés eliminar a{' '}
          <span className="font-semibold text-body">{vendor.full_name}</span>?
        </p>
        <p className="text-xs text-red-500 mb-5">
          Esta acción es irreversible. Se eliminarán el usuario y todos sus datos asociados.
        </p>

        {error && <p className="text-sm text-red-500 mb-3">{error}</p>}

        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm rounded-md border border-border text-body hover:bg-bg transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="px-4 py-2 text-sm rounded-md bg-red-600 hover:bg-red-700 text-white font-semibold transition-colors disabled:opacity-60"
          >
            {deleting ? 'Eliminando...' : 'Sí, eliminar'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function VendorCardActions({ vendor }: { vendor: Pick<User, 'id' | 'full_name'> }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [showDelete, setShowDelete] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <>
      {showDelete && (
        <DeleteModal
          vendor={vendor}
          onClose={() => setShowDelete(false)}
          onDeleted={() => router.refresh()}
        />
      )}

      <div ref={ref} className="relative" onClick={e => e.preventDefault()}>
        <button
          onClick={e => { e.preventDefault(); setOpen(v => !v) }}
          className="p-1 rounded-md text-gray-400 hover:text-body hover:bg-bg transition-colors"
        >
          <MoreVertical size={16} />
        </button>

        {open && (
          <div className="absolute right-0 top-7 z-20 bg-surface border border-border rounded-lg shadow-lg w-36 py-1">
            <button
              onClick={e => { e.preventDefault(); setOpen(false); router.push(`/vendors/${vendor.id}`) }}
              className="flex items-center gap-2 w-full px-3 py-2 text-sm text-body hover:bg-bg transition-colors"
            >
              <Pencil size={13} />
              Editar
            </button>
            <button
              onClick={e => { e.preventDefault(); setOpen(false); setShowDelete(true) }}
              className="flex items-center gap-2 w-full px-3 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
            >
              <Trash2 size={13} />
              Eliminar
            </button>
          </div>
        )}
      </div>
    </>
  )
}
