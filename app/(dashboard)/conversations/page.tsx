'use client'

import { useEffect, useState, useCallback } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import ConversationCard from '@/components/conversations/ConversationCard'
import ChatBubble from '@/components/conversations/ChatBubble'
import ScoreBadge from '@/components/ui/ScoreBadge'
import { Conversation, Message } from '@/types'
import { createBrowserSupabaseClient } from '@/lib/supabase'
import { Search, Filter, Brain, ExternalLink, RefreshCw, X, Loader2, PhoneOff, Users, ChevronDown, Pencil, Check } from 'lucide-react'
import { STAGE_LABELS, formatPhone, normalizePhone } from '@/lib/utils'
import { WhatsappInstance } from '@/types'

export default function ConversationsPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [selected, setSelected] = useState<Conversation | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)
  const [analyzeError, setAnalyzeError] = useState<string | null>(null)
  const [loadingReport, setLoadingReport] = useState(false)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState(searchParams.get('status') ?? '')
  const [filterStage, setFilterStage] = useState('')
  const [filterInstance, setFilterInstance] = useState('')
  const [instances, setInstances] = useState<WhatsappInstance[]>([])
  const [hideEmployeePhones, setHideEmployeePhones] = useState(true)
  const [employeePhones, setEmployeePhones] = useState<Set<string>>(new Set())
  const [groupsExpanded, setGroupsExpanded] = useState(false)
  const [addingPhone, setAddingPhone] = useState(false)
  const [addPhoneMsg, setAddPhoneMsg] = useState<{ type: 'ok' | 'error' | 'exists'; text: string } | null>(null)
  const [codClienteMap, setCodClienteMap] = useState<Record<string, string>>({})

  // Edición de nombre en el header
  const [editingName, setEditingName] = useState(false)
  const [editNameValue, setEditNameValue] = useState('')
  const [savingName, setSavingName] = useState(false)

  const supabase = createBrowserSupabaseClient()

  const loadConversations = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (filterStatus) params.set('status', filterStatus)
    if (filterStage) params.set('stage', filterStage)
    if (filterInstance) params.set('instanceId', filterInstance)
    params.set('limit', '50')

    const res = await fetch(`/api/conversations?${params}`)
    const data = await res.json()
    setConversations(data.data ?? [])
    setLoading(false)
  }, [filterStatus, filterStage, filterInstance])

  useEffect(() => {
    loadConversations()
  }, [loadConversations])

  // Cargar datos auxiliares una sola vez al montar
  useEffect(() => {
    fetch('/api/employee-phones')
      .then(r => r.json())
      .then(d => {
        const phones = (d.data ?? []).map((p: { phone: string }) => p.phone)
        setEmployeePhones(new Set(phones))
      })

    fetch('/api/base-tn/lookup')
      .then(r => r.json())
      .then(d => {
        if (d.data) setCodClienteMap(d.data)
      })

    fetch('/api/instances')
      .then(r => r.json())
      .then(d => {
        setInstances(d.data ?? [])
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
    setEditingName(false)
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
    setAnalyzeError(null)
    try {
      const res = await fetch('/api/analyze/conversation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationId: selected.id }),
      })
      const data = await res.json()
      if (data.analysisId) {
        router.push(`/analysis/${data.analysisId}`)
      } else {
        const msg = data.error ?? 'No se pudo generar el análisis'
        setAnalyzeError(msg)
        setTimeout(() => setAnalyzeError(null), 8000)
      }
    } catch {
      setAnalyzeError('Error de conexión al analizar')
      setTimeout(() => setAnalyzeError(null), 8000)
    } finally {
      setAnalyzing(false)
    }
  }

  const handleSaveName = async (conversationId: string, displayName: string | null) => {
    const res = await fetch('/api/conversations', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: conversationId, display_name: displayName }),
    })
    if (res.ok) {
      setConversations(prev => prev.map(c =>
        c.id === conversationId ? { ...c, display_name: displayName } : c
      ))
      setSelected(prev => prev?.id === conversationId ? { ...prev, display_name: displayName } : prev)
    }
  }

  const handleSaveHeaderName = async () => {
    if (!selected) return
    setSavingName(true)
    await handleSaveName(selected.id, editNameValue.trim() || null)
    setSavingName(false)
    setEditingName(false)
  }

  const isGroup = (c: Conversation) => c.remote_jid?.endsWith('@g.us') ?? false

  const matchesSearch = (c: Conversation) => {
    if (!search) return true
    const q = search.toLowerCase()
    const name = c.display_name ?? c.client_name ?? ''
    return (
      name.toLowerCase().includes(q) ||
      c.client_phone.toLowerCase().includes(q) ||
      (c.vendedor?.full_name ?? '').toLowerCase().includes(q)
    )
  }

  const getCodCliente = (phone: string) => {
    const norm = normalizePhone(phone)
    return codClienteMap[norm]
  }

  const individualConvs = conversations.filter(c =>
    !isGroup(c) &&
    !(hideEmployeePhones && employeePhones.has(c.client_phone)) &&
    matchesSearch(c)
  )

  const groupConvs = conversations.filter(c => isGroup(c) && matchesSearch(c))

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

  const selectedDisplayName = selected
    ? (selected.display_name ?? selected.client_name ?? selected.client_phone)
    : ''

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

          {instances.length > 1 && (
            <select
              value={filterInstance}
              onChange={e => setFilterInstance(e.target.value)}
              className="w-full text-xs border border-border rounded-md px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="">Todas las instancias</option>
              {instances.map(inst => (
                <option key={inst.id} value={inst.id}>
                  {inst.instance_name}{inst.phone_number ? ` (${inst.phone_number})` : ''}
                </option>
              ))}
            </select>
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
          ) : individualConvs.length === 0 && groupConvs.length === 0 ? (
            <div className="p-4 text-center text-gray-400 text-sm">
              No se encontraron conversaciones
            </div>
          ) : (
            <>
              {/* Conversaciones individuales */}
              {individualConvs.map(conv => (
                <ConversationCard
                  key={conv.id}
                  conversation={conv}
                  onClick={() => selectConversation(conv)}
                  selected={selected?.id === conv.id}
                  codCliente={getCodCliente(conv.client_phone)}
                  onSaveName={handleSaveName}
                />
              ))}

              {/* Sección Grupos internos — colapsable, una sola entrada */}
              {groupConvs.length > 0 && (
                <div className="border-t border-border">
                  <button
                    onClick={() => setGroupsExpanded(v => !v)}
                    className="flex items-center justify-between w-full px-4 py-2.5 bg-blue-50 hover:bg-blue-100 transition-colors text-left"
                  >
                    <span className="flex items-center gap-2 text-xs font-semibold text-blue-700">
                      <Users size={13} />
                      Grupos internos
                      <span className="bg-blue-200 text-blue-800 px-1.5 py-0.5 rounded-full text-[10px]">
                        {groupConvs.length}
                      </span>
                    </span>
                    <ChevronDown
                      size={13}
                      className={`text-blue-500 transition-transform ${groupsExpanded ? 'rotate-180' : ''}`}
                    />
                  </button>

                  {groupsExpanded && groupConvs.map(conv => (
                    <ConversationCard
                      key={conv.id}
                      conversation={conv}
                      onClick={() => selectConversation(conv)}
                      selected={selected?.id === conv.id}
                    />
                  ))}
                </div>
              )}
            </>
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
              <div className="min-w-0 mr-4">
                {/* Nombre editable */}
                {editingName ? (
                  <div className="flex items-center gap-1.5">
                    <input
                      autoFocus
                      type="text"
                      value={editNameValue}
                      onChange={e => setEditNameValue(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') handleSaveHeaderName()
                        if (e.key === 'Escape') setEditingName(false)
                      }}
                      className="text-sm font-semibold border border-primary rounded px-2 py-0.5 focus:outline-none focus:ring-1 focus:ring-primary min-w-0"
                      placeholder="Nombre del cliente"
                    />
                    <button
                      onClick={handleSaveHeaderName}
                      disabled={savingName}
                      className="text-green-600 hover:text-green-700 disabled:opacity-50"
                    >
                      {savingName ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                    </button>
                    <button onClick={() => setEditingName(false)} className="text-gray-400 hover:text-gray-600">
                      <X size={13} />
                    </button>
                  </div>
                ) : (
                  <div className="group/hname flex items-center gap-1.5 min-w-0">
                    <h3 className="font-semibold text-body truncate">{selectedDisplayName}</h3>
                    <button
                      onClick={() => {
                        setEditNameValue(selected.display_name ?? selected.client_name ?? '')
                        setEditingName(true)
                      }}
                      className="shrink-0 opacity-0 group-hover/hname:opacity-100 text-gray-300 hover:text-primary transition-opacity"
                    >
                      <Pencil size={12} />
                    </button>
                  </div>
                )}
                {/* Nombre original si hay display_name */}
                {selected.display_name && selected.client_name && selected.display_name !== selected.client_name && (
                  <p className="text-[10px] text-gray-400 leading-tight">{selected.client_name}</p>
                )}
                <p className="text-xs text-gray-500 mt-0.5">
                  {formatPhone(selected.client_phone)}
                  {getCodCliente(selected.client_phone) && (
                    <span className="ml-1.5 text-primary font-medium">#{getCodCliente(selected.client_phone)}</span>
                  )}
                  {' · '}{selected.vendedor?.full_name ?? '—'} · {selected.message_count} mensajes
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {latestAnalysis ? (
                  <div className="flex items-center gap-2">
                    <ScoreBadge score={(latestAnalysis as { quality_score: number }).quality_score} size="sm" />
                    <button
                      onClick={async () => {
                        setLoadingReport(true)
                        await router.push(`/analysis/${(latestAnalysis as { id: string }).id}`)
                        setLoadingReport(false)
                      }}
                      disabled={loadingReport}
                      className="text-xs text-primary hover:text-primary-dark font-medium flex items-center gap-1 disabled:opacity-50"
                    >
                      {loadingReport ? (
                        <><Loader2 size={12} className="animate-spin" /> Cargando informe...</>
                      ) : (
                        <>Ver informe <ExternalLink size={12} /></>
                      )}
                    </button>
                  </div>
                ) : null}
                <div className="flex flex-col items-start gap-1">
                  <button
                    onClick={handleAnalyze}
                    disabled={analyzing}
                    className="flex items-center gap-1.5 bg-primary hover:bg-primary-dark text-white text-xs font-semibold px-3 py-2 rounded-md transition-colors disabled:opacity-50"
                  >
                    <Brain size={14} />
                    {analyzing ? 'Analizando...' : latestAnalysis ? 'Re-analizar con IA' : '🤖 Analizar con IA'}
                  </button>
                  {analyzeError && (
                    <span className="text-xs text-red-500 font-medium">{analyzeError}</span>
                  )}
                </div>
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
                    Empleado
                  </button>
                </div>

                <button onClick={() => selectConversation(selected)} className="text-muted hover:text-body">
                  <RefreshCw size={14} />
                </button>
                <button onClick={() => { setSelected(null); setAddPhoneMsg(null); setEditingName(false) }} className="text-muted hover:text-body">
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
                    clientName={selectedDisplayName}
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
