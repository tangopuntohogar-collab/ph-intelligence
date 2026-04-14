'use client'

import { useEffect, useState } from 'react'
import { createBrowserSupabaseClient } from '@/lib/supabase'
import { Conversation, ConversationStage, User } from '@/types'
import { STAGE_LABELS, STAGE_COLORS, formatDistanceToNow } from '@/lib/utils'
import ScoreBadge from '@/components/ui/ScoreBadge'
import VendorAvatar from '@/components/ui/VendorAvatar'
import { Filter } from 'lucide-react'

type ConvWithAnalysis = Conversation & {
  ai_analysis: Array<{ id: string; quality_score: number; conversation_stage: ConversationStage }>
}

const STAGES: ConversationStage[] = ['new', 'negotiation', 'proposal', 'closed_won', 'closed_lost']

export default function PipelinePage() {
  const supabase = createBrowserSupabaseClient()
  const [conversations, setConversations] = useState<ConvWithAnalysis[]>([])
  const [vendors, setVendors] = useState<User[]>([])
  const [filterVendor, setFilterVendor] = useState('')
  const [loading, setLoading] = useState(true)
  const [dragging, setDragging] = useState<string | null>(null)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setLoading(true)
    const [convsRes, vendorsRes] = await Promise.all([
      supabase
        .from('conversations')
        .select('*, vendedor:users!vendedor_id(id, full_name, avatar_url), ai_analysis:ai_analyses(id, quality_score, conversation_stage)')
        .order('last_message_at', { ascending: false })
        .limit(200),
      fetch('/api/vendors').then(r => r.json()),
    ])
    setConversations((convsRes.data ?? []) as ConvWithAnalysis[])
    setVendors(vendorsRes.data ?? [])
    setLoading(false)
  }

  const moveConversation = async (convId: string, stage: ConversationStage) => {
    await fetch('/api/pipeline', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ conversationId: convId, stage }),
    })
    // Actualizar localmente
    setConversations(prev => prev.map(c => {
      if (c.id !== convId) return c
      return {
        ...c,
        ai_analysis: c.ai_analysis?.length
          ? [{ ...c.ai_analysis[0], conversation_stage: stage }]
          : [{ id: '', quality_score: 0, conversation_stage: stage }],
      }
    }))
  }

  const getStageConvs = (stage: ConversationStage) => {
    return conversations
      .filter(c => {
        const cStage = c.ai_analysis?.[0]?.conversation_stage
        const matchStage = cStage === stage || (stage === 'new' && !cStage)
        const matchVendor = !filterVendor || c.vendedor_id === filterVendor
        return matchStage && matchVendor
      })
  }

  const handleDragStart = (convId: string) => setDragging(convId)
  const handleDragOver = (e: React.DragEvent) => e.preventDefault()
  const handleDrop = (stage: ConversationStage) => {
    if (dragging) {
      moveConversation(dragging, stage)
      setDragging(null)
    }
  }

  return (
    <div className="p-6 max-w-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-body">Pipeline Global</h1>
          <p className="text-sm text-muted mt-0.5">
            {conversations.length} conversaciones · Arrastrá las cards para mover etapas
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Filter size={14} className="text-gray-400" />
          <select
            value={filterVendor}
            onChange={e => setFilterVendor(e.target.value)}
            className="text-sm border border-border rounded-md px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="">Todos los vendedores</option>
            {vendors.map(v => (
              <option key={v.id} value={v.id}>{v.full_name}</option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="text-center text-gray-400 py-12">Cargando pipeline...</div>
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {STAGES.map(stage => {
            const stageConvs = getStageConvs(stage)
            return (
              <div
                key={stage}
                className="min-w-[220px] flex-1"
                onDragOver={handleDragOver}
                onDrop={() => handleDrop(stage)}
              >
                {/* Header columna */}
                <div className={`text-xs font-semibold px-3 py-2 rounded-t-md border ${STAGE_COLORS[stage]} flex items-center justify-between`}>
                  <span>{STAGE_LABELS[stage]}</span>
                  <span className="bg-white/60 px-1.5 rounded-full">{stageConvs.length}</span>
                </div>

                {/* Cards */}
                <div
                  className="bg-bg rounded-b-md border border-t-0 border-border p-2 space-y-2 min-h-[400px]"
                  style={{ borderColor: 'inherit' }}
                >
                  {stageConvs.map(conv => (
                    <div
                      key={conv.id}
                      draggable
                      onDragStart={() => handleDragStart(conv.id)}
                      className={`bg-surface border border-border rounded-md p-3 cursor-grab active:cursor-grabbing hover:shadow-md transition-all ${
                        dragging === conv.id ? 'opacity-50 ring-2 ring-primary' : ''
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <p className="text-sm font-medium text-body leading-tight truncate">
                          {conv.client_name ?? conv.client_phone}
                        </p>
                        {conv.ai_analysis?.[0]?.quality_score > 0 && (
                          <ScoreBadge score={conv.ai_analysis[0].quality_score} size="sm" />
                        )}
                      </div>

                      {conv.vendedor && (
                        <div className="flex items-center gap-1.5 mb-2">
                          <VendorAvatar vendor={conv.vendedor} size="sm" />
                          <span className="text-xs text-gray-500 truncate">
                            {(conv.vendedor as User).full_name.split(' ')[0]}
                          </span>
                        </div>
                      )}

                      <p className="text-xs text-gray-400">
                        {conv.last_message_at
                          ? formatDistanceToNow(new Date(conv.last_message_at))
                          : '—'}
                      </p>

                      {/* Cambiar etapa manual */}
                      <select
                        value={conv.ai_analysis?.[0]?.conversation_stage ?? 'new'}
                        onClick={e => e.stopPropagation()}
                        onChange={e => moveConversation(conv.id, e.target.value as ConversationStage)}
                        className="mt-2 w-full text-xs border border-border rounded px-1.5 py-1 focus:outline-none focus:ring-1 focus:ring-primary bg-bg"
                      >
                        {STAGES.map(s => (
                          <option key={s} value={s}>{STAGE_LABELS[s]}</option>
                        ))}
                      </select>
                    </div>
                  ))}

                  {stageConvs.length === 0 && (
                    <div className="text-xs text-gray-300 text-center py-8 border-2 border-dashed border-gray-200 rounded-md">
                      Soltá aquí
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
