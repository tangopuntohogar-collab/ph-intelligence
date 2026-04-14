'use client'

import { useState } from 'react'
import { Conversation } from '@/types'
import ScoreBadge from '@/components/ui/ScoreBadge'
import VendorAvatar from '@/components/ui/VendorAvatar'
import { formatDistanceToNow, formatPhone } from '@/lib/utils'
import { Users, Pencil, Check, X } from 'lucide-react'

const statusLabel: Record<string, string> = {
  active: 'Activa',
  closed: 'Cerrada',
  pending: 'Pendiente',
}

const statusColor: Record<string, string> = {
  active: 'bg-green-100 text-green-700',
  closed: 'bg-gray-100 text-gray-600',
  pending: 'bg-yellow-100 text-yellow-700',
}

interface ConversationCardProps {
  conversation: Conversation
  onClick: () => void
  selected?: boolean
  codCliente?: string
  onSaveName?: (conversationId: string, displayName: string | null) => Promise<void>
}

export default function ConversationCard({ conversation, onClick, selected, codCliente, onSaveName }: ConversationCardProps) {
  const isGroup = conversation.remote_jid?.endsWith('@g.us') ?? false

  const analysis = Array.isArray(conversation.ai_analysis)
    ? conversation.ai_analysis[0]
    : conversation.ai_analysis

  const lastMsg = conversation.last_message?.content ?? '—'
  const preview = lastMsg.length > 60 ? lastMsg.slice(0, 60) + '...' : lastMsg
  const timeAgo = conversation.last_message_at
    ? formatDistanceToNow(new Date(conversation.last_message_at))
    : '—'

  const displayName = conversation.display_name ?? conversation.client_name ?? conversation.client_phone
  const formattedPhone = formatPhone(conversation.client_phone)

  const [editing, setEditing] = useState(false)
  const [editValue, setEditValue] = useState('')
  const [saving, setSaving] = useState(false)

  const startEdit = (e: React.MouseEvent) => {
    e.stopPropagation()
    setEditValue(conversation.display_name ?? conversation.client_name ?? '')
    setEditing(true)
  }

  const cancelEdit = (e: React.MouseEvent) => {
    e.stopPropagation()
    setEditing(false)
  }

  const saveEdit = async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!onSaveName) return
    setSaving(true)
    await onSaveName(conversation.id, editValue.trim() || null)
    setSaving(false)
    setEditing(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.stopPropagation()
      if (onSaveName && !saving) {
        setSaving(true)
        onSaveName(conversation.id, editValue.trim() || null).then(() => {
          setSaving(false)
          setEditing(false)
        })
      }
    }
    if (e.key === 'Escape') {
      setEditing(false)
    }
  }

  const resolvedCodCliente = codCliente

  return (
    <div
      onClick={editing ? undefined : onClick}
      className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors border-b border-border last:border-b-0 ${
        selected ? 'bg-primary/5 border-l-2 border-l-primary' : 'hover:bg-bg'
      } ${editing ? 'cursor-default' : ''}`}
    >
      {/* Avatar del cliente (inicial) — grupos con ícono distinto */}
      <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm shrink-0 ${
        isGroup ? 'bg-blue-100 text-blue-600' : 'bg-gray-200 text-gray-600'
      }`}>
        {isGroup
          ? <Users size={18} />
          : displayName.charAt(0).toUpperCase()
        }
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <div className="flex-1 min-w-0">
            {editing ? (
              <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                <input
                  autoFocus
                  type="text"
                  value={editValue}
                  onChange={e => setEditValue(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="flex-1 min-w-0 text-xs border border-primary rounded px-1.5 py-0.5 focus:outline-none"
                  placeholder="Nombre del cliente"
                />
                <button onClick={saveEdit} disabled={saving} className="text-green-600 hover:text-green-700 shrink-0">
                  <Check size={13} />
                </button>
                <button onClick={cancelEdit} className="text-gray-400 hover:text-gray-600 shrink-0">
                  <X size={13} />
                </button>
              </div>
            ) : (
              <div className="group/name flex items-center gap-1 min-w-0">
                <span className="font-medium text-body text-sm truncate">
                  {displayName}
                </span>
                {onSaveName && (
                  <button
                    onClick={startEdit}
                    className="shrink-0 opacity-0 group-hover/name:opacity-100 text-gray-300 hover:text-primary transition-opacity"
                  >
                    <Pencil size={11} />
                  </button>
                )}
              </div>
            )}
            {/* Nombre original si hay display_name */}
            {conversation.display_name && conversation.client_name && conversation.display_name !== conversation.client_name && (
              <span className="text-[10px] text-gray-400 truncate block leading-tight">
                {conversation.client_name}
              </span>
            )}
            {/* Teléfono formateado */}
            {!isGroup && (
              <span className="text-[10px] text-gray-400 block leading-tight">
                {formattedPhone}
                {resolvedCodCliente && (
                  <span className="ml-1.5 text-primary font-medium">#{resolvedCodCliente}</span>
                )}
              </span>
            )}
          </div>
          <span className="text-xs text-muted shrink-0">{timeAgo}</span>
        </div>

        <div className="flex items-center justify-between gap-2 mt-0.5">
          <p className="text-xs text-muted truncate">{preview}</p>
          <div className="flex items-center gap-1 shrink-0">
            <span className={`text-xs px-1.5 py-0.5 rounded-full ${statusColor[conversation.status]}`}>
              {statusLabel[conversation.status]}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 mt-1">
          {isGroup && (
            <span className="flex items-center gap-0.5 text-xs text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded-full font-medium">
              <Users size={10} /> Grupo
            </span>
          )}
          {conversation.vendedor && (
            <div className="flex items-center gap-1">
              <VendorAvatar vendor={conversation.vendedor} size="sm" />
              <span className="text-xs text-muted truncate max-w-[80px]">
                {conversation.vendedor.full_name.split(' ')[0]}
              </span>
            </div>
          )}
          {analysis && (
            <ScoreBadge score={(analysis as { quality_score: number }).quality_score} size="sm" />
          )}
        </div>
      </div>
    </div>
  )
}
