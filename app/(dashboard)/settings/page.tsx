'use client'

import React, { useEffect, useState } from 'react'
import { createBrowserSupabaseClient } from '@/lib/supabase'
import { User, WhatsappInstance } from '@/types'
import VendorAvatar from '@/components/ui/VendorAvatar'
import { Wifi, WifiOff, RefreshCw, Plus, Edit2, Eye, EyeOff, Brain, CheckCircle, X, Save, Loader2, Signal, Trash2 } from 'lucide-react'
import type { AIProvider } from '@/lib/ai-providers'
import { formatDistanceToNow } from '@/lib/utils'
import { useRouter } from 'next/navigation'

export default function SettingsPage() {
  const router = useRouter()
  const supabase = createBrowserSupabaseClient()
  const [activeTab, setActiveTab] = useState<'users' | 'instances' | 'ia' | 'api'>('users')
  const [aiProvider, setAiProvider] = useState<AIProvider>('anthropic')
  const [savingProvider, setSavingProvider] = useState(false)
  const [providerSaved, setProviderSaved] = useState(false)

  // Instancias
  const [showNewInstance, setShowNewInstance] = useState(false)
  const [newInstance, setNewInstance] = useState({
    instance_name: '', api_url: process.env.NEXT_PUBLIC_EVOLUTION_API_BASE_URL ?? 'https://puntohogar-evolution-api.cuhhss.easypanel.host',
    api_key: '', phone_number: '', vendedor_id: '',
  })
  const [savingInstance, setSavingInstance] = useState(false)
  const [instanceError, setInstanceError] = useState('')
  const [testResults, setTestResults] = useState<Record<string, { connected: boolean; state: string; error?: string; loading?: boolean }>>({})
  const [showApiKeyFor, setShowApiKeyFor] = useState<string | null>(null)
  const [editingInstance, setEditingInstance] = useState<string | null>(null)
  const [editValues, setEditValues] = useState<Record<string, string>>({})
  const [deletingInstance, setDeletingInstance] = useState<string | null>(null)
  const [confirmDeleteInstance, setConfirmDeleteInstance] = useState<string | null>(null)
  const [users, setUsers] = useState<User[]>([])
  const [instances, setInstances] = useState<(WhatsappInstance & { vendedor?: User })[]>([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState<string | null>(null)
  const [syncResults, setSyncResults] = useState<Record<string, { synced: number; errors: number; skipped: number; chatsFound: number }>>({})
  const [syncErrors, setSyncErrors] = useState<Record<string, string[]>>({})
  const [showSyncErrors, setShowSyncErrors] = useState<string | null>(null)

  const [showApiKey, setShowApiKey] = useState(false)
  const [apiKey, setApiKey] = useState('')
  const [savedMsg, setSavedMsg] = useState('')
  const [remoteInstances, setRemoteInstances] = useState<string[] | null>(null)
  const [loadingRemote, setLoadingRemote] = useState(false)

  // Nuevo usuario
  const [newUser, setNewUser] = useState({ email: '', full_name: '', role: 'vendedor', password: '', supervisor_id: '' })
  const [creatingUser, setCreatingUser] = useState(false)
  const [userError, setUserError] = useState('')

  // Reset datos de ficción
  const [resetting, setResetting] = useState(false)
  const [resetMsg, setResetMsg] = useState('')

  // Recalcular timestamps
  const [recalculating, setRecalculating] = useState(false)
  const [recalcMsg, setRecalcMsg] = useState('')

  useEffect(() => {
    checkAdminAccess()
    loadData()
  }, [])

  const checkAdminAccess = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data: profile } = await supabase.from('users').select('role').eq('id', user.id).single()
    if (profile?.role !== 'admin') {
      router.push('/dashboard')
    }
  }

  const loadData = async () => {
    setLoading(true)
    const [usersRes, instancesRes, configRes] = await Promise.all([
      fetch('/api/vendors'),
      fetch('/api/instances'),
      fetch('/api/config'),
    ])
    const usersData = await usersRes.json()
    const instancesData = await instancesRes.json()
    const configData = await configRes.json()
    if (configData.ai_provider) setAiProvider(configData.ai_provider)
    setUsers(usersData.data ?? [])
    setInstances(instancesData.data ?? [])
    setLoading(false)
  }

  const testInstance = async (instanceId: string) => {
    setTestResults(prev => ({ ...prev, [instanceId]: { connected: false, state: '', loading: true } }))
    const res = await fetch('/api/instances/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ instanceId }),
    })
    const data = await res.json()
    setTestResults(prev => ({ ...prev, [instanceId]: { ...data, loading: false } }))
    await loadData()
  }

  const testNewInstance = async () => {
    setTestResults(prev => ({ ...prev, '__new__': { connected: false, state: '', loading: true } }))
    const res = await fetch('/api/instances/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_url: newInstance.api_url,
        api_key: newInstance.api_key,
        instance_name: newInstance.instance_name,
      }),
    })
    const data = await res.json()
    setTestResults(prev => ({ ...prev, '__new__': { ...data, loading: false } }))
  }

  const saveNewInstance = async () => {
    setSavingInstance(true)
    setInstanceError('')
    const res = await fetch('/api/instances', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newInstance),
    })
    const data = await res.json()
    if (data.error) {
      setInstanceError(data.error)
    } else {
      setNewInstance({ instance_name: '', api_url: 'https://puntohogar-evolution-api.cuhhss.easypanel.host', api_key: '', phone_number: '', vendedor_id: '' })
      setShowNewInstance(false)
      setTestResults(prev => { const n = { ...prev }; delete n['__new__']; return n })
      await loadData()
    }
    setSavingInstance(false)
  }

  const saveEditInstance = async (instId: string) => {
    const res = await fetch('/api/instances', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: instId, ...editValues }),
    })
    if (res.ok) {
      setEditingInstance(null)
      setEditValues({})
      await loadData()
    }
  }

  const deleteInstance = async (instId: string) => {
    setDeletingInstance(instId)
    const res = await fetch(`/api/instances?id=${instId}`, { method: 'DELETE' })
    setDeletingInstance(null)
    setConfirmDeleteInstance(null)
    if (res.ok) await loadData()
  }

  const saveProvider = async (provider: AIProvider) => {
    setSavingProvider(true)
    setProviderSaved(false)
    const res = await fetch('/api/config', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ai_provider: provider }),
    })
    if (res.ok) {
      setAiProvider(provider)
      setProviderSaved(true)
      setTimeout(() => setProviderSaved(false), 3000)
    }
    setSavingProvider(false)
  }

  const loadRemoteInstances = async () => {
    setLoadingRemote(true)
    const res = await fetch('/api/instances/list-remote')
    const data = await res.json()
    setRemoteInstances(data.instances ?? [data.error ?? 'Error al obtener instancias'])
    setLoadingRemote(false)
  }

  const syncInstance = async (instanceId: string) => {
    setSyncing(instanceId)
    const res = await fetch('/api/sync/conversations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ instanceId }),
    })
    const data = await res.json()
    setSyncResults(prev => ({
      ...prev,
      [instanceId]: {
        synced:     data.synced     ?? 0,
        errors:     data.errors     ?? 0,
        skipped:    data.skipped    ?? 0,
        chatsFound: data.chatsFound ?? 0,
      },
    }))
    if (data.errorLog?.length) {
      setSyncErrors(prev => ({ ...prev, [instanceId]: data.errorLog }))
    }
    await loadData()
    setSyncing(null)
  }

  const createUser = async (e: React.FormEvent) => {
    e.preventDefault()
    setCreatingUser(true)
    setUserError('')
    const res = await fetch('/api/vendors', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newUser),
    })
    const data = await res.json()
    if (data.error) {
      setUserError(data.error)
    } else {
      setNewUser({ email: '', full_name: '', role: 'vendedor', password: '', supervisor_id: '' })
      await loadData()
    }
    setCreatingUser(false)
  }

  const recalcTimestamps = async () => {
    setRecalculating(true)
    setRecalcMsg('')
    const res = await fetch('/api/admin/recalc-timestamps', { method: 'POST' })
    const data = await res.json()
    setRecalcMsg(data.error ?? `Recalculadas ${data.updated} de ${data.total} conversaciones.`)
    setRecalculating(false)
    await loadData()
  }

  const resetConversations = async () => {
    setResetting(true)
    setResetMsg('')
    const res = await fetch('/api/admin/reset-conversations', { method: 'DELETE' })
    const data = await res.json()
    setResetMsg(data.error ?? 'Datos eliminados correctamente. Sincronizá las instancias para traer conversaciones reales.')
    setResetting(false)
  }

  const supervisors = users.filter(u => u.role === 'supervisor')

  const tabs = [
    { id: 'users', label: 'Usuarios' },
    { id: 'instances', label: 'Instancias WhatsApp' },
    { id: 'ia', label: 'Proveedor IA' },
    { id: 'api', label: 'API Keys' },
  ] as const

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-body">Configuración</h1>
        <p className="text-sm text-gray-500 mt-0.5">Solo visible para administradores</p>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border mb-6 gap-1">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.id
                ? 'border-primary text-primary'
                : 'border-transparent text-gray-500 hover:text-body'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab: Usuarios */}
      {activeTab === 'users' && (
        <div className="space-y-6">
          {/* Crear usuario */}
          <div className="bg-surface rounded-lg shadow-sm border border-border p-5">
            <h3 className="font-semibold text-body mb-4 flex items-center gap-2">
              <Plus size={16} className="text-primary" /> Crear Nuevo Usuario
            </h3>
            <form onSubmit={createUser} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Nombre completo</label>
                <input
                  type="text"
                  required
                  value={newUser.full_name}
                  onChange={e => setNewUser(p => ({ ...p, full_name: e.target.value }))}
                  className="w-full border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Email <span className="text-gray-400 font-normal">(opcional)</span>
                </label>
                <input
                  type="text"
                  value={newUser.email}
                  onChange={e => setNewUser(p => ({ ...p, email: e.target.value }))}
                  placeholder="vendedor@empresa.com"
                  className="w-full border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Contraseña temporal</label>
                <input
                  type="password"
                  required
                  value={newUser.password}
                  onChange={e => setNewUser(p => ({ ...p, password: e.target.value }))}
                  className="w-full border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Rol</label>
                <select
                  value={newUser.role}
                  onChange={e => setNewUser(p => ({ ...p, role: e.target.value }))}
                  className="w-full border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="vendedor">Vendedor</option>
                  <option value="supervisor">Supervisor</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              {newUser.role === 'vendedor' && supervisors.length > 0 && (
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Supervisor asignado</label>
                  <select
                    value={newUser.supervisor_id}
                    onChange={e => setNewUser(p => ({ ...p, supervisor_id: e.target.value }))}
                    className="w-full border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value="">Sin supervisor</option>
                    {supervisors.map(s => (
                      <option key={s.id} value={s.id}>{s.full_name}</option>
                    ))}
                  </select>
                </div>
              )}
              <div className="sm:col-span-2">
                {userError && (
                  <p className="text-xs text-red-500 mb-2">{userError}</p>
                )}
                <button
                  type="submit"
                  disabled={creatingUser}
                  className="bg-primary hover:bg-primary-dark text-white text-sm font-semibold px-4 py-2 rounded-md transition-colors disabled:opacity-50"
                >
                  {creatingUser ? 'Creando...' : 'Crear usuario'}
                </button>
              </div>
            </form>
          </div>

          {/* Recalcular timestamps */}
          <div className="bg-white rounded-lg shadow-sm border border-border p-5">
            <h3 className="font-semibold text-body mb-1">Recalcular fechas de conversaciones</h3>
            <p className="text-xs text-gray-500 mb-3">
              Corrige el campo "último mensaje" de cada conversación usando la fecha real de los mensajes guardados. Usá esto si el orden de las conversaciones está incorrecto.
            </p>
            {recalcMsg && (
              <p className="text-xs text-green-700 bg-green-50 border border-green-200 rounded px-3 py-2 mb-3">{recalcMsg}</p>
            )}
            <button
              onClick={recalcTimestamps}
              disabled={recalculating}
              className="bg-primary hover:bg-primary-dark text-white text-sm font-semibold px-4 py-2 rounded-md transition-colors disabled:opacity-50"
            >
              {recalculating ? 'Recalculando...' : 'Recalcular fechas'}
            </button>
          </div>

          {/* Zona de peligro */}
          <div className="bg-white rounded-lg shadow-sm border border-red-200 p-5">
            <h3 className="font-semibold text-red-700 mb-1">Zona de peligro</h3>
            <p className="text-xs text-gray-500 mb-3">
              Elimina todas las conversaciones, mensajes y análisis de la base de datos. Usá esto para limpiar datos de prueba antes de conectar Evolution API.
            </p>
            {resetMsg && (
              <p className="text-xs text-green-700 bg-green-50 border border-green-200 rounded px-3 py-2 mb-3">{resetMsg}</p>
            )}
            <button
              onClick={resetConversations}
              disabled={resetting}
              className="bg-red-600 hover:bg-red-700 text-white text-sm font-semibold px-4 py-2 rounded-md transition-colors disabled:opacity-50"
            >
              {resetting ? 'Eliminando...' : 'Eliminar todas las conversaciones'}
            </button>
          </div>

          {/* Lista de usuarios */}
          <div className="bg-surface rounded-lg shadow-sm border border-border overflow-hidden">
            <div className="px-5 py-4 border-b border-border">
              <h3 className="font-semibold text-body">Vendedores ({users.length})</h3>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-bg border-b border-border text-xs text-gray-500 uppercase tracking-wide">
                  <th className="text-left px-4 py-3">Nombre</th>
                  <th className="text-left px-4 py-3">Email</th>
                  <th className="text-left px-4 py-3">Rol</th>
                  <th className="text-left px-4 py-3">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {loading ? (
                  <tr><td colSpan={4} className="px-4 py-6 text-center text-gray-400">Cargando...</td></tr>
                ) : users.length === 0 ? (
                  <tr><td colSpan={4} className="px-4 py-6 text-center text-gray-400">No hay usuarios</td></tr>
                ) : (
                  users.map(user => (
                    <tr key={user.id} className="hover:bg-bg transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <VendorAvatar vendor={user} size="sm" />
                          <span className="font-medium">{user.full_name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-500">{user.email}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          user.role === 'admin'
                            ? 'bg-purple-100 text-purple-700'
                            : user.role === 'supervisor'
                            ? 'bg-blue-100 text-blue-700'
                            : 'bg-gray-100 text-gray-600'
                        }`}>
                          {user.role}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => router.push(`/vendors/${user.id}`)}
                          className="text-xs text-primary hover:text-primary-dark flex items-center gap-1"
                        >
                          <Edit2 size={12} /> Ver perfil
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab: Instancias WhatsApp */}
      {activeTab === 'instances' && (
        <div className="space-y-4">
          {/* Botón agregar */}
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              <p className="text-sm text-gray-500">{instances.length} instancias configuradas · URL base: <span className="font-mono text-xs">puntohogar-evolution-api.cuhhss.easypanel.host</span></p>
              <button
                onClick={loadRemoteInstances}
                disabled={loadingRemote}
                className="text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1 disabled:opacity-40"
              >
                <Signal size={12} className={loadingRemote ? 'animate-pulse' : ''} />
                {loadingRemote ? 'Cargando...' : 'Ver en Evolution'}
              </button>
            </div>
            <button
              onClick={() => setShowNewInstance(p => !p)}
              className="flex items-center gap-1.5 bg-primary hover:bg-primary-dark text-white text-sm font-semibold px-3 py-2 rounded-md transition-colors"
            >
              {showNewInstance ? <X size={14} /> : <Plus size={14} />}
              {showNewInstance ? 'Cancelar' : 'Nueva instancia'}
            </button>
          </div>

          {/* Instancias registradas en Evolution API */}
          {remoteInstances !== null && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 flex items-start gap-3">
              <Signal size={14} className="text-blue-500 mt-0.5 shrink-0" />
              <div>
                <p className="text-xs font-semibold text-blue-700 mb-1">Instancias registradas en Evolution API:</p>
                <div className="flex flex-wrap gap-1.5">
                  {remoteInstances.map((name, i) => (
                    <span key={i} className="font-mono text-xs bg-surface border border-blue-200 text-blue-800 px-2 py-0.5 rounded">
                      {name}
                    </span>
                  ))}
                </div>
                <p className="text-xs text-blue-500 mt-1.5">El campo "Nombre de instancia" en la app debe coincidir exactamente con uno de estos.</p>
              </div>
            </div>
          )}

          {/* Formulario nueva instancia */}
          {showNewInstance && (
            <div className="bg-surface rounded-lg border-2 border-primary/30 p-5 space-y-4">
              <h3 className="font-semibold text-body flex items-center gap-2">
                <Plus size={15} className="text-primary" /> Agregar Instancia Evolution API
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Nombre de instancia <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    placeholder="Ej: Tucuman1"
                    value={newInstance.instance_name}
                    onChange={e => setNewInstance(p => ({ ...p, instance_name: e.target.value }))}
                    className="w-full border border-border rounded-md px-3 py-2 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                  <p className="text-xs text-gray-400 mt-0.5">Exactamente como aparece en Evolution Manager</p>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">API Key <span className="text-red-500">*</span></label>
                  <div className="relative">
                    <input
                      type={showApiKeyFor === '__new__' ? 'text' : 'password'}
                      placeholder="Copiá desde Evolution Manager → ícono 👁"
                      value={newInstance.api_key}
                      onChange={e => setNewInstance(p => ({ ...p, api_key: e.target.value }))}
                      className="w-full border border-border rounded-md px-3 py-2 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-primary pr-8"
                    />
                    <button onClick={() => setShowApiKeyFor(p => p === '__new__' ? null : '__new__')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400">
                      {showApiKeyFor === '__new__' ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Número de teléfono</label>
                  <input
                    type="text"
                    placeholder="Ej: 5493816203791"
                    value={newInstance.phone_number}
                    onChange={e => setNewInstance(p => ({ ...p, phone_number: e.target.value }))}
                    className="w-full border border-border rounded-md px-3 py-2 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Asignar a vendedor</label>
                  <select
                    value={newInstance.vendedor_id}
                    onChange={e => setNewInstance(p => ({ ...p, vendedor_id: e.target.value }))}
                    className="w-full border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value="">Sin asignar</option>
                    {users.map(v => (
                      <option key={v.id} value={v.id}>{v.full_name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Test resultado */}
              {testResults['__new__'] && !testResults['__new__'].loading && (
                <div className={`flex items-center gap-2 text-sm px-3 py-2 rounded-md ${
                  testResults['__new__'].connected
                    ? 'bg-green-50 text-green-700 border border-green-200'
                    : 'bg-red-50 text-red-700 border border-red-200'
                }`}>
                  {testResults['__new__'].connected
                    ? <><CheckCircle size={14} /> Conexión exitosa — estado: {testResults['__new__'].state}</>
                    : <><WifiOff size={14} /> Sin conexión — {testResults['__new__'].error ?? testResults['__new__'].state}</>
                  }
                </div>
              )}

              {instanceError && <p className="text-xs text-red-500">{instanceError}</p>}

              <div className="flex gap-2">
                <button
                  onClick={testNewInstance}
                  disabled={!newInstance.instance_name || !newInstance.api_key || testResults['__new__']?.loading}
                  className="flex items-center gap-1.5 border border-primary text-primary hover:bg-red-50 text-sm font-medium px-3 py-2 rounded-md transition-colors disabled:opacity-40"
                >
                  {testResults['__new__']?.loading ? <Loader2 size={14} className="animate-spin" /> : <Signal size={14} />}
                  Probar conexión
                </button>
                <button
                  onClick={saveNewInstance}
                  disabled={savingInstance || !newInstance.instance_name || !newInstance.api_key}
                  className="flex items-center gap-1.5 bg-primary hover:bg-primary-dark text-white text-sm font-semibold px-3 py-2 rounded-md transition-colors disabled:opacity-40"
                >
                  {savingInstance ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                  Guardar instancia
                </button>
              </div>
            </div>
          )}

          {/* Lista de instancias */}
          <div className="bg-surface rounded-lg shadow-sm border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-bg border-b border-border text-xs text-gray-500 uppercase tracking-wide">
                  <th className="text-left px-4 py-3">Instancia</th>
                  <th className="text-left px-4 py-3">Vendedor</th>
                  <th className="text-left px-4 py-3">Número</th>
                  <th className="text-left px-4 py-3">API Key</th>
                  <th className="text-left px-4 py-3">Estado</th>
                  <th className="text-left px-4 py-3">Último sync</th>
                  <th className="text-left px-4 py-3">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {loading ? (
                  <tr><td colSpan={7} className="px-4 py-6 text-center text-gray-400">Cargando...</td></tr>
                ) : instances.length === 0 ? (
                  <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">
                    No hay instancias. Hacé click en "Nueva instancia" para agregar la primera.
                  </td></tr>
                ) : (
                  instances.map(inst => {
                    const test = testResults[inst.id]
                    const isEditing = editingInstance === inst.id
                    return (
                      <React.Fragment key={inst.id}>
                      <tr className={`transition-colors ${isEditing ? 'bg-yellow-50' : 'hover:bg-bg'}`}>
                        <td className="px-4 py-3 font-mono text-xs font-semibold text-body">{inst.instance_name}</td>
                        <td className="px-4 py-3">
                          {isEditing ? (
                            <select
                              value={editValues.vendedor_id ?? inst.vendedor_id ?? ''}
                              onChange={e => setEditValues(p => ({ ...p, vendedor_id: e.target.value }))}
                              className="border border-border rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                            >
                              <option value="">Sin asignar</option>
                              {users.map(v => <option key={v.id} value={v.id}>{v.full_name}</option>)}
                            </select>
                          ) : inst.vendedor ? (
                            <div className="flex items-center gap-1.5">
                              <VendorAvatar vendor={inst.vendedor} size="sm" />
                              <span className="text-xs">{inst.vendedor.full_name}</span>
                            </div>
                          ) : <span className="text-gray-300 text-xs">Sin asignar</span>}
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-gray-500">
                          {isEditing ? (
                            <input
                              type="text"
                              value={editValues.phone_number ?? inst.phone_number ?? ''}
                              onChange={e => setEditValues(p => ({ ...p, phone_number: e.target.value }))}
                              className="border border-border rounded px-2 py-1 text-xs w-36 focus:outline-none focus:ring-1 focus:ring-primary"
                            />
                          ) : inst.phone_number ?? '—'}
                        </td>
                        <td className="px-4 py-3">
                          {isEditing ? (
                            <div className="flex items-center gap-1">
                              <input
                                type={showApiKeyFor === inst.id ? 'text' : 'password'}
                                value={editValues.api_key ?? inst.api_key}
                                onChange={e => setEditValues(p => ({ ...p, api_key: e.target.value }))}
                                className="border border-border rounded px-2 py-1 text-xs w-36 font-mono focus:outline-none focus:ring-1 focus:ring-primary"
                              />
                              <button onClick={() => setShowApiKeyFor(p => p === inst.id ? null : inst.id)} className="text-gray-400">
                                {showApiKeyFor === inst.id ? <EyeOff size={12} /> : <Eye size={12} />}
                              </button>
                            </div>
                          ) : (
                            <span className="font-mono text-xs text-gray-400">••••••••••••</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {test?.loading ? (
                            <span className="flex items-center gap-1 text-xs text-gray-400"><Loader2 size={12} className="animate-spin" /> Probando...</span>
                          ) : test ? (
                            <div>
                              <span className={`flex items-center gap-1 text-xs font-medium ${test.connected ? 'text-green-600' : 'text-red-500'}`}>
                                {test.connected
                                  ? <><Wifi size={12} /> {test.state}</>
                                  : <><WifiOff size={12} /> {test.state}</>}
                              </span>
                              {!test.connected && test.error && (
                                <div className="flex items-start gap-1 mt-0.5">
                                  <p className="text-xs text-red-400 max-w-[160px] wrap-break-word">{test.error}</p>
                                  <button
                                    onClick={() => navigator.clipboard.writeText(test.error!)}
                                    className="shrink-0 text-gray-400 hover:text-gray-600"
                                    title="Copiar error"
                                  >
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                                  </button>
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className={`flex items-center gap-1 text-xs font-medium ${inst.status === 'connected' ? 'text-green-600' : 'text-gray-400'}`}>
                              {inst.status === 'connected' ? <><Wifi size={12} /> Conectada</> : <><WifiOff size={12} /> {inst.status}</>}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-400">
                          {inst.last_sync_at ? formatDistanceToNow(new Date(inst.last_sync_at)) : 'Nunca'}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2 flex-wrap">
                            {isEditing ? (
                              <>
                                <button onClick={() => saveEditInstance(inst.id)} className="text-xs text-green-600 hover:text-green-700 font-medium flex items-center gap-0.5">
                                  <Save size={12} /> Guardar
                                </button>
                                <button onClick={() => { setEditingInstance(null); setEditValues({}) }} className="text-xs text-gray-400 hover:text-gray-600">
                                  <X size={12} />
                                </button>
                              </>
                            ) : (
                              <>
                                <button
                                  onClick={() => testInstance(inst.id)}
                                  disabled={test?.loading}
                                  className="text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center gap-0.5 disabled:opacity-40"
                                >
                                  <Signal size={12} /> Probar
                                </button>
                                <div className="flex flex-col items-start gap-0.5">
                                  <button
                                    onClick={() => syncInstance(inst.id)}
                                    disabled={syncing === inst.id}
                                    className="text-xs text-primary hover:text-primary-dark font-medium flex items-center gap-0.5 disabled:opacity-40"
                                  >
                                    <RefreshCw size={12} className={syncing === inst.id ? 'animate-spin' : ''} />
                                    {syncing === inst.id ? 'Sincronizando...' : 'Sync'}
                                  </button>
                                  {syncResults[inst.id] && (() => {
                                    const r = syncResults[inst.id]
                                    return (
                                      <div className="text-xs space-y-0.5">
                                        <span className={r.chatsFound === 0 ? 'text-orange-500' : r.errors > 0 ? 'text-yellow-600' : 'text-green-600'}>
                                          {r.chatsFound === 0
                                            ? 'Sin chats en Evolution'
                                            : `${r.synced} ok · ${r.skipped} omitidos`}
                                        </span>
                                        {r.errors > 0 && (
                                          <button
                                            onClick={() => setShowSyncErrors(showSyncErrors === inst.id ? null : inst.id)}
                                            className="block text-red-500 hover:text-red-700 underline"
                                          >
                                            {r.errors} errores — ver detalle
                                          </button>
                                        )}
                                      </div>
                                    )
                                  })()}
                                </div>
                                <button
                                  onClick={() => { setEditingInstance(inst.id); setEditValues({ api_key: inst.api_key, phone_number: inst.phone_number ?? '', vendedor_id: inst.vendedor_id ?? '' }) }}
                                  className="text-xs text-gray-500 hover:text-body flex items-center gap-0.5"
                                >
                                  <Edit2 size={12} /> Editar
                                </button>
                                {confirmDeleteInstance === inst.id ? (
                                  <div className="flex items-center gap-1">
                                    <span className="text-xs text-red-500">¿Confirmar?</span>
                                    <button
                                      onClick={() => deleteInstance(inst.id)}
                                      disabled={deletingInstance === inst.id}
                                      className="text-xs text-red-600 hover:text-red-700 font-semibold disabled:opacity-50"
                                    >
                                      {deletingInstance === inst.id ? '...' : 'Sí'}
                                    </button>
                                    <button
                                      onClick={() => setConfirmDeleteInstance(null)}
                                      className="text-xs text-gray-400 hover:text-gray-600"
                                    >
                                      No
                                    </button>
                                  </div>
                                ) : (
                                  <button
                                    onClick={() => setConfirmDeleteInstance(inst.id)}
                                    className="text-xs text-red-500 hover:text-red-700 flex items-center gap-0.5"
                                  >
                                    <Trash2 size={12} /> Eliminar
                                  </button>
                                )}
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                      {/* Fila expandible de errores de sync */}
                      {showSyncErrors === inst.id && syncErrors[inst.id]?.length > 0 && (
                        <tr className="bg-red-50">
                          <td colSpan={7} className="px-4 py-3">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-xs font-semibold text-red-600">
                                Detalle de errores ({syncErrors[inst.id].length})
                              </span>
                              <button onClick={() => setShowSyncErrors(null)} className="text-gray-400 hover:text-gray-600">
                                <X size={14} />
                              </button>
                            </div>
                            <div className="max-h-48 overflow-y-auto space-y-0.5">
                              {syncErrors[inst.id].map((err, i) => (
                                <p key={i} className="text-xs font-mono text-red-700 bg-red-100 px-2 py-1 rounded">
                                  {err}
                                </p>
                              ))}
                            </div>
                          </td>
                        </tr>
                      )}
                      </React.Fragment>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab: Proveedor IA */}
      {activeTab === 'ia' && (
        <div className="space-y-4">
          <div className="bg-surface rounded-lg shadow-sm border border-border p-6">
            <h3 className="font-semibold text-body flex items-center gap-2 mb-1">
              <Brain size={16} className="text-primary" /> Proveedor de Inteligencia Artificial
            </h3>
            <p className="text-sm text-gray-500 mb-6">
              Seleccioná qué modelo de IA se usa para analizar las conversaciones. El cambio aplica inmediatamente para todos los análisis nuevos.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Card Anthropic */}
              <button
                onClick={() => saveProvider('anthropic')}
                disabled={savingProvider}
                className={`relative text-left p-5 rounded-lg border-2 transition-all ${
                  aiProvider === 'anthropic'
                    ? 'border-primary bg-red-50'
                    : 'border-border bg-surface hover:border-gray-300'
                }`}
              >
                {aiProvider === 'anthropic' && (
                  <span className="absolute top-3 right-3 text-primary">
                    <CheckCircle size={18} />
                  </span>
                )}
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-lg bg-[#CC785C] flex items-center justify-center text-white font-bold text-lg">
                    A
                  </div>
                  <div>
                    <p className="font-semibold text-body">Anthropic Claude</p>
                    <p className="text-xs text-gray-500 font-mono">claude-sonnet-4-20250514</p>
                  </div>
                </div>
                <ul className="text-xs text-gray-600 space-y-1">
                  <li>✓ Mejor razonamiento en español</li>
                  <li>✓ Análisis más detallado y contextual</li>
                  <li>✓ Respuestas JSON muy precisas</li>
                </ul>
                {aiProvider === 'anthropic' && (
                  <div className="mt-3 text-xs font-semibold text-primary">Activo actualmente</div>
                )}
              </button>

              {/* Card Gemini */}
              <button
                onClick={() => saveProvider('gemini')}
                disabled={savingProvider}
                className={`relative text-left p-5 rounded-lg border-2 transition-all ${
                  aiProvider === 'gemini'
                    ? 'border-primary bg-red-50'
                    : 'border-border bg-surface hover:border-gray-300'
                }`}
              >
                {aiProvider === 'gemini' && (
                  <span className="absolute top-3 right-3 text-primary">
                    <CheckCircle size={18} />
                  </span>
                )}
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-lg bg-[#4285F4] flex items-center justify-center text-white font-bold text-lg">
                    G
                  </div>
                  <div>
                    <p className="font-semibold text-body">Google Gemini</p>
                    <p className="text-xs text-gray-500 font-mono">gemini-2.0-flash</p>
                  </div>
                </div>
                <ul className="text-xs text-gray-600 space-y-1">
                  <li>✓ Muy rápido en respuestas</li>
                  <li>✓ Costo menor por análisis</li>
                  <li>✓ Buen rendimiento general</li>
                </ul>
                {aiProvider === 'gemini' && (
                  <div className="mt-3 text-xs font-semibold text-primary">Activo actualmente</div>
                )}
              </button>
            </div>

            {providerSaved && (
              <div className="mt-4 flex items-center gap-2 text-sm text-green-600">
                <CheckCircle size={14} /> Proveedor guardado correctamente
              </div>
            )}
            {savingProvider && (
              <p className="mt-4 text-sm text-gray-400">Guardando...</p>
            )}
          </div>

          <div className="p-4 bg-blue-50 rounded-md border border-blue-200 text-xs text-blue-700">
            <p className="font-semibold mb-1">Variables de entorno requeridas según proveedor:</p>
            <ul className="list-disc list-inside space-y-1 font-mono">
              <li>ANTHROPIC_API_KEY — requerida si usás Claude</li>
              <li>GEMINI_API_KEY — requerida si usás Gemini</li>
            </ul>
          </div>
        </div>
      )}

      {/* Tab: API Keys */}
      {activeTab === 'api' && (
        <div className="bg-surface rounded-lg shadow-sm border border-border p-5 space-y-4">
          <h3 className="font-semibold text-body">Configuración de API</h3>
          <p className="text-sm text-gray-500">
            Las API keys se configuran como variables de entorno en el servidor (Vercel). No se almacenan en la base de datos.
          </p>

          <div className="space-y-3">
            <div className="p-4 bg-bg rounded-md border border-border">
              <p className="text-xs font-semibold text-gray-600 mb-1">ANTHROPIC_API_KEY</p>
              <p className="text-xs text-gray-400">Usada para el motor de análisis IA (Claude claude-sonnet-4-20250514)</p>
              <div className="flex items-center gap-2 mt-2">
                <input
                  type={showApiKey ? 'text' : 'password'}
                  value={apiKey}
                  onChange={e => setApiKey(e.target.value)}
                  placeholder="sk-ant-..."
                  className="flex-1 border border-border rounded-md px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary font-mono"
                />
                <button onClick={() => setShowApiKey(p => !p)} className="text-gray-400 hover:text-body">
                  {showApiKey ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>

            <div className="p-4 bg-blue-50 rounded-md border border-blue-200 text-xs text-blue-700">
              <p className="font-semibold mb-1">⚠️ Variables de entorno requeridas en Vercel:</p>
              <ul className="list-disc list-inside space-y-1 font-mono">
                <li>NEXT_PUBLIC_SUPABASE_URL</li>
                <li>NEXT_PUBLIC_SUPABASE_ANON_KEY</li>
                <li>SUPABASE_SERVICE_ROLE_KEY</li>
                <li>ANTHROPIC_API_KEY</li>
                <li>NEXT_PUBLIC_APP_URL (URL pública del deploy)</li>
                <li>EVOLUTION_API_BASE_URL (opcional, URL base)</li>
              </ul>
            </div>

            {savedMsg && (
              <p className="text-xs text-green-600">{savedMsg}</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
