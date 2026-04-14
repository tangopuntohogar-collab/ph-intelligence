'use client'

import { useEffect, useState, useCallback } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import ConversationCard from '@/components/conversations/ConversationCard'
import ChatBubble from '@/components/conversations/ChatBubble'
import ScoreBadge from '@/components/ui/ScoreBadge'
import { Conversation, Message } from '@/types'
import { createBrowserSupabaseClient } from '@/lib/supabase'
import { Search, Filter, Brain, ExternalLink, RefreshCw, X, Loader2, PhoneOff, Users } from 'lucide-react'
import { STAGE_LABELS } from '@/lib/utils'

export default function ConversationsPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [selected, setSelected] = useState<Conversation | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState(searchParams.get('status') ?? '')
  const [filterStage, setFilterStage] = useState('')
  const [hideEmployeePhones, setHideEmployeePhones] = useState(true)
  const [employeePhones, setEmployeePhones] = useState<Set<string>>(new Set())
  const [hideGroups, setHideGroups] = useState(true)
  const [addingPhone, setAddingPhone] = useState(false)
  const [addPhoneMsg, setAddPhoneMsg] = useState<{ type: 'ok' | 'error' | 'exists'; text: string } | null>(null)

  const supabase = createBrowserSupabaseClient()

  const loadConversations = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (filterStatus) params.set('status', filterStatus)
    if (filterStage) params.set('stage', filterStage)
    params.set('limit', '50')

    const res = await fetch(`/api/conversations?${params}`)
    const data = await res.json()
    setConversations(data.data ?? [])
    setLoading(false)
  }, [filterStatus, filterStage])

  useEffect(() => {
    loadConversations()
  }, [loadConversations])

  // Cargar teléfonos de empleados una sola vez al montar
  useEffect(() => {
    fetch('/api/employee-phones')
      .then(r => r.json())
      .then(d => {
        const phones = (d.data ?? []).map((p: { phone: string }) => p.phone)
        setEmployeePhones(new Set(phones))
      })
  }, [])

  // Suscripción Realtime: recargar lista y mensajes cuando llega uno nuevo vía webhook
  useEffect(() => {
    const channel = supabase
      .channel('messages-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' },
        async (payload) => {
          loadConversations()
          // Si la conversación activa recibió el mensaje, recargar desde Evolution API
          setSelected(prev => {
            if (prev && payload.new && (payload.new as { conversation_id: string }).conversation_id === prev.id) {
              fetch(`/api/messages?conversationId=${prev.id}`)
                .then(r => r.json())
                .then(d => setMessages(d.messages ?? []))
            }
            return prev
          })
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [supabase, loadConversations])

  const selectConversation = async (conv: Conversation) => {
    setSelected(conv)
    setMessages([])
    setLoadingMessages(true)
    try {
      const res = await fetch(`/api/messages?conversationId=${conv.id}`)
      const data = await res.json()
      setMessages(data.messages ?? [])
    } finally {
      setLoadingMessages(false)
    }
  }

  const handleAnalyze = async () => {
    if (!selected) return
    setAnalyzing(true)
    try {
      const res = await fetch('/api/analyze/conversation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationId: selected.id }),
      })
      const data = await res.json()
      if (data.analysisId) {
        router.push(`/analysis/${data.analysisId}`)
      }
    } finally {
      setAnalyzing(false)
    }
  }

  const groupCount = conversations.filter(c => c.remote_jid?.endsWith('@g.us')).length

  const filteredConversations = conversations.filter(c => {
    if (hideGroups && c.remote_jid?.endsWith('@g.us')) return false
    if (hideEmployeePhones && employeePhones.has(c.client_phone)) return false
    if (!search) return true
    const q = search.toLowerCase()
    return (
      (c.client_name ?? '').toLowerCase().includes(q) ||
      c.client_phone.toLowerCase().includes(q) ||
      (c.vendedor?.full_name ?? '').toLowerCase().includes(q)
    )
  })

  const handleAddEmployeePhone = async () => {
    if (!selected) return
    setAddingPhone(true)
    setAddPhoneMsg(null)

    // Verificar si ya existe antes de intentar insertar
    if (employeePhones.has(selected.client_phone)) {
      setAddPhoneMsg({ type: 'exists', text: 'Este número ya está en la lista de empleados.' })
      setAddingPhone(false)
      return
    }

    const res = await fetch('/api/employee-phones', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: selected.client_phone, name: selected.client_name ?? '' }),
    })
    const data = await res.json()
    setAddingPhone(false)

    if (!res.ok) {
      const isExists = data.error?.includes('ya está registrado')
      setAddPhoneMsg({
        type: isExists ? 'exists' : 'error',
        text: data.error ?? 'Error al agregar el número.',
      })
    } else {
      setEmployeePhones(prev => new Set([...prev, selected.client_phone]))
      setAddPhoneMsg({ type: 'ok', text: 'Número agregado a la lista de empleados.' })
    }

    // Limpiar mensaje tras 3 segundos
    setTimeout(() => setAddPhoneMsg(null), 3000)
  }

  const latestAnalysis = selected
    ? (Array.isArray(selected.ai_analysis) ? selected.ai_analysis[0] : selected.ai_analysis)
    : null

  return (
    <div className="flex h-full">
      {/* Panel izquierdo: lista de conversaciones */}
      <div className="w-80 border-r border-border bg-surface flex flex-col shrink-0">
        {/* Filtros */}
        <div className="p-3 border-b border-border space-y-2">
          <div className="relative">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" />
            <input
              type="text"
              placeholder="Buscar conversación..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-2 text-xs border border-border rounded-md focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          <div className="flex gap-2">
            <select
              value={filterStatus}
              onChange={e => setFilterStatus(e.target.value)}
              className="flex-1 text-xs border border-border rounded-md px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="">Todos los estados</option>
              <option value="active">Activas</option>
              <option value="pending">Pendientes</option>
              <option value="closed">Cerradas</option>
            </select>

            <select
              value={filterStage}
              onChange={e => setFilterStage(e.target.value)}
              className="flex-1 text-xs border border-border rounded-md px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="">Todas las etapas</option>
              {Object.entries(STAGE_LABELS).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </div>

          {/* Toggle: ocultar grupos */}
          {groupCount > 0 && (
            <button
              onClick={() => setHideGroups(v => !v)}
              className={`flex items-center gap-1.5 w-full px-2.5 py-1.5 rounded-md text-xs font-medium border transition-colors ${
                hideGroups
                  ? 'bg-blue-50 border-blue-200 text-blue-600'
                  : 'bg-bg border-border text-gray-500 hover:border-blue-200 hover:text-blue-600'
              }`}
            >
              <Users size={11} />
              {hideGroups
                ? `Ocultando ${groupCount} grupo${groupCount !== 1 ? 's' : ''}`
                : 'Mostrando todos (incl. grupos)'}
            </button>
          )}

          {/* Toggle: ocultar teléfonos de empleados */}
          {employeePhones.size > 0 && (
            <button
              onClick={() => setHideEmployeePhones(v => !v)}
              className={`flex items-center gap-1.5 w-full px-2.5 py-1.5 rounded-md text-xs font-medium border transition-colors ${
                hideEmployeePhones
                  ? 'bg-primary/10 border-primary/30 text-primary'
                  : 'bg-bg border-border text-gray-500 hover:border-primary/30 hover:text-primary'
              }`}
            >
              <PhoneOff size={11} />
              {hideEmployeePhones
                ? `Ocultando ${employeePhones.size} tel. de empleados`
                : 'Mostrando todos (incl. empleados)'}
            </button>
          )}
        </div>

        {/* Lista */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="p-4 text-center text-gray-400 text-sm">Cargando...</div>
          ) : filteredConversations.length === 0 ? (
            <div className="p-4 text-center text-gray-400 text-sm">
              No se encontraron conversaciones
            </div>
          ) : (
            filteredConversations.map(conv => (
              <ConversationCard
                key={conv.id}
                conversation={conv}
                onClick={() => selectConversation(conv)}
                selected={selected?.id === conv.id}
              />
            ))
          )}
        </div>
      </div>

      {/* Panel derecho: chat */}
      <div className="flex-1 flex flex-col bg-bg">
        {!selected ? (
          <div className="flex-1 flex flex-col items-center justify-center text-gray-400">
            <Filter size={40} className="mb-3 opacity-30" />
            <p className="text-sm">Seleccioná una conversación para ver el chat</p>
          </div>
        ) : (
          <>
            {/* Header del chat */}
            <div className="bg-surface border-b border-border px-5 py-3 flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-body">
                  {selected.client_name ?? selected.client_phone}
                </h3>
                <p className="text-xs text-gray-500">
                  {selected.client_phone} · {selected.vendedor?.full_name ?? '—'} · {selected.message_count} mensajes
                </p>
              </div>
              <div className="flex items-center gap-2">
                {latestAnalysis ? (
                  <div className="flex items-center gap-2">
                    <ScoreBadge score={(latestAnalysis as { quality_score: number }).quality_score} size="sm" />
                    <button
                      onClick={() => router.push(`/analysis/${(latestAnalysis as { id: string }).id}`)}
                      className="text-xs text-primary hover:text-primary-dark font-medium flex items-center gap-1"
                    >
                      Ver informe <ExternalLink size={12} />
                    </button>
                  </div>
                ) : null}
                <button
                  onClick={handleAnalyze}
                  disabled={analyzing}
                  className="flex items-center gap-1.5 bg-primary hover:bg-primary-dark text-white text-xs font-semibold px-3 py-2 rounded-md transition-colors disabled:opacity-50"
                >
                  <Brain size={14} />
                  {analyzing ? 'Analizando...' : latestAnalysis ? 'Re-analizar con IA' : '🤖 Analizar con IA'}
                </button>
                {/* Agregar a empleados */}
                <div className="flex items-center gap-1.5">
                  {addPhoneMsg && (
                    <span className={`text-xs font-medium ${
                      addPhoneMsg.type === 'ok'     ? 'text-green-600' :
                      addPhoneMsg.type === 'exists' ? 'text-amber-600' :
                                                      'text-red-500'
                    }`}>
                      {addPhoneMsg.text}
                    </span>
                  )}
                  <button
                    onClick={handleAddEmployeePhone}
                    disabled={addingPhone || employeePhones.has(selected.client_phone)}
                    title={
                      employeePhones.has(selected.client_phone)
                        ? 'Este número ya está en la lista de empleados'
                        : 'Agregar número a empleados'
                    }
                    className={`flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-md border font-medium transition-colors disabled:cursor-not-allowed ${
                      employeePhones.has(selected.client_phone)
                        ? 'border-amber-300 bg-amber-50 text-amber-600 opacity-70'
                        : 'border-border text-gray-500 hover:border-primary hover:text-primary'
                    }`}
                  >
                    {addingPhone
                      ? <Loader2 size={11} className="animate-spin" />
                      : <PhoneOff size={11} />
                    }
                    {employeePhones.has(selected.client_phone) ? 'Empleado' : 'Empleado'}
                  </button>
                </div>

                <button onClick={() => selectConversation(selected)} className="text-muted hover:text-body">
                  <RefreshCw size={14} />
                </button>
                <button onClick={() => { setSelected(null); setAddPhoneMsg(null) }} className="text-muted hover:text-body">
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Mensajes */}
            <div className="flex-1 overflow-y-auto p-4 space-y-1">
              {loadingMessages ? (
                <div className="flex items-center justify-center gap-2 text-gray-400 text-sm mt-8">
                  <Loader2 size={16} className="animate-spin" />
                  Cargando mensajes...
                </div>
              ) : messages.length === 0 ? (
                <div className="text-center text-gray-400 text-sm mt-8">No hay mensajes en esta conversación</div>
              ) : (
                messages.map(msg => (
                  <ChatBubble
                    key={msg.id}
                    message={msg}
                    vendorName={selected.vendedor?.full_name}
                    clientName={selected.client_name ?? selected.client_phone}
                  />
                ))
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
