import { Conversation } from '@/types'
import ScoreBadge from '@/components/ui/ScoreBadge'
import VendorAvatar from '@/components/ui/VendorAvatar'
import { formatDistanceToNow } from '@/lib/utils'
import { Users } from 'lucide-react'

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
}

export default function ConversationCard({ conversation, onClick, selected }: ConversationCardProps) {
  const isGroup = conversation.remote_jid?.endsWith('@g.us') ?? false

  const analysis = Array.isArray(conversation.ai_analysis)
    ? conversation.ai_analysis[0]
    : conversation.ai_analysis

  const lastMsg = conversation.last_message?.content ?? '—'
  const preview = lastMsg.length > 60 ? lastMsg.slice(0, 60) + '...' : lastMsg
  const timeAgo = conversation.last_message_at
    ? formatDistanceToNow(new Date(conversation.last_message_at))
    : '—'

  return (
    <div
      onClick={onClick}
      className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors border-b border-border last:border-b-0 ${
        selected ? 'bg-primary/5 border-l-2 border-l-primary' : 'hover:bg-bg'
      }`}
    >
      {/* Avatar del cliente (inicial) — grupos con ícono distinto */}
      <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm shrink-0 ${
        isGroup ? 'bg-blue-100 text-blue-600' : 'bg-gray-200 text-gray-600'
      }`}>
        {isGroup
          ? <Users size={18} />
          : (conversation.client_name ?? conversation.client_phone).charAt(0).toUpperCase()
        }
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span className="font-medium text-body text-sm truncate">
            {conversation.client_name ?? conversation.client_phone}
          </span>
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
