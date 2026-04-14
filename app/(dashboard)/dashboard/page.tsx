'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import KpiCard from '@/components/ui/KpiCard'
import ScoreBadge, { getScoreRowClass } from '@/components/ui/ScoreBadge'
import VendorAvatar from '@/components/ui/VendorAvatar'
import { SkeletonCard, SkeletonTable } from '@/components/ui/LoadingSkeleton'
import { DashboardStats, User } from '@/types'
import {
  Star,
  AlertCircle,
  TrendingUp,
  Layers,
  BarChart2,
  ArrowUpDown,
  Wifi,
  WifiOff,
  ChevronUp,
  ChevronDown,
} from 'lucide-react'

interface VendorRow {
  id: string
  full_name: string
  avatar_url: string | null
  avg_quality_score: number
  conversations_total: number
  conversations_unresponded_24h: number
  pipeline_majority: string
  trend: number
  whatsapp_instance?: { status: string }
}

type SortKey = 'full_name' | 'avg_quality_score' | 'conversations_total' | 'conversations_unresponded_24h'
type SortDir = 'asc' | 'desc'

const stageLabel: Record<string, string> = {
  new: 'Nuevo',
  negotiation: 'Negociación',
  proposal: 'Propuesta',
  closed_won: 'Ganado',
  closed_lost: 'Perdido',
}

export default function DashboardPage() {
  const router = useRouter()
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [vendors, setVendors] = useState<VendorRow[]>([])
  const [loading, setLoading] = useState(true)
  const [sortKey, setSortKey] = useState<SortKey>('avg_quality_score')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  useEffect(() => {
    loadDashboard()
  }, [])

  const loadDashboard = async () => {
    setLoading(true)
    try {
      const [kpisRes, vendorsRes] = await Promise.all([
        fetch('/api/kpis'),
        fetch('/api/vendors'),
      ])
      const kpisData = await kpisRes.json()
      const vendorsData = await vendorsRes.json()

      setStats(kpisData)

      // Construir rows de vendedores cruzando KPIs
      const kpisByVendor: Record<string, typeof kpisData.kpis_by_vendor[0]> = {}
      ;(kpisData.kpis_by_vendor ?? []).forEach((k: { vendedor_id: string; avg_quality_score: number; conversations_total: number; conversations_unresponded_24h: number }) => {
        kpisByVendor[k.vendedor_id] = k
      })

      const rows: VendorRow[] = (vendorsData.data ?? []).map((v: User & { whatsapp_instance?: { status: string }, daily_kpis?: { avg_quality_score: number; conversations_total: number; conversations_unresponded_24h: number; date: string }[] }) => {
        const kpi = kpisByVendor[v.id]
        const recentKpis = (v.daily_kpis ?? []).sort((a, b) => b.date.localeCompare(a.date))
        const prevKpi = recentKpis[1]
        const trend = kpi && prevKpi
          ? Math.round(kpi.avg_quality_score - prevKpi.avg_quality_score)
          : 0

        return {
          id: v.id,
          full_name: v.full_name,
          avatar_url: v.avatar_url,
          avg_quality_score: kpi?.avg_quality_score ?? 0,
          conversations_total: kpi?.conversations_total ?? 0,
          conversations_unresponded_24h: kpi?.conversations_unresponded_24h ?? 0,
          pipeline_majority: 'new',
          trend,
          whatsapp_instance: v.whatsapp_instance,
        }
      })

      setVendors(rows)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const sortedVendors = [...vendors].sort((a, b) => {
    const aVal = a[sortKey]
    const bVal = b[sortKey]
    const dir = sortDir === 'asc' ? 1 : -1
    if (typeof aVal === 'string') return aVal.localeCompare(bVal as string) * dir
    return ((aVal as number) - (bVal as number)) * dir
  })

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortDir('desc')
    }
  }

  const scoreDiff = stats
    ? Math.round((stats.avg_quality_score - stats.avg_quality_score_prev) * 10) / 10
    : 0

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-body">Dashboard</h1>
          <p className="text-sm text-muted mt-0.5">
            Visión general del equipo · {new Date().toLocaleDateString('es-AR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm">
          {stats ? (
            <>
              <span className={`flex items-center gap-1 ${stats.connected_instances > 0 ? 'text-green-600' : 'text-red-500'}`}>
                {stats.connected_instances > 0 ? <Wifi size={14} /> : <WifiOff size={14} />}
                {stats.connected_instances}/{stats.total_instances} online
              </span>
            </>
          ) : null}
        </div>
      </div>

      {/* KPI Cards */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
          {Array.from({ length: 5 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
          <KpiCard
            title="Score de Calidad Promedio"
            value={`${stats?.avg_quality_score ?? 0}/100`}
            icon={<Star size={18} />}
            trend={scoreDiff}
            trendLabel={`${scoreDiff > 0 ? '+' : ''}${scoreDiff} vs semana ant.`}
          />
          <KpiCard
            title="Sin Respuesta +24hs"
            value={stats?.unresponded_24h ?? 0}
            icon={<AlertCircle size={18} />}
            alert={(stats?.unresponded_24h ?? 0) > 0}
            alertLabel="Requiere atención"
            onClick={() => router.push('/conversations?status=active')}
          />
          <KpiCard
            title="Conversiones Estimadas"
            value={stats?.estimated_conversions ?? 0}
            icon={<TrendingUp size={18} />}
          />
          <KpiCard
            title="Pipeline Activo"
            value={stats?.active_conversations ?? 0}
            icon={<Layers size={18} />}
          />
          <KpiCard
            title="Índice de Mejora"
            value={`${stats?.vendors_improved ?? 0} ↑ / ${stats?.vendors_declined ?? 0} ↓`}
            icon={<BarChart2 size={18} />}
          />
        </div>
      )}

      {/* Tabla de vendedores */}
      <div className="bg-surface rounded-lg shadow-sm border border-border overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <h2 className="font-semibold text-body">Equipo de Vendedores</h2>
          <button
            onClick={() => router.push('/vendors')}
            className="text-sm text-primary hover:text-primary-dark font-medium"
          >
            Ver todos →
          </button>
        </div>

        {loading ? (
          <SkeletonTable rows={6} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-bg border-b border-border text-xs font-semibold text-muted uppercase tracking-wide">
                  <th className="text-left px-4 py-3">
                    <button onClick={() => handleSort('full_name')} className="flex items-center gap-1 hover:text-primary">
                      Vendedor <ArrowUpDown size={12} />
                    </button>
                  </th>
                  <th className="text-left px-4 py-3">
                    <button onClick={() => handleSort('avg_quality_score')} className="flex items-center gap-1 hover:text-primary">
                      Score IA <ArrowUpDown size={12} />
                    </button>
                  </th>
                  <th className="text-left px-4 py-3">
                    <button onClick={() => handleSort('conversations_total')} className="flex items-center gap-1 hover:text-primary">
                      Conv. activas <ArrowUpDown size={12} />
                    </button>
                  </th>
                  <th className="text-left px-4 py-3">
                    <button onClick={() => handleSort('conversations_unresponded_24h')} className="flex items-center gap-1 hover:text-primary">
                      Sin resp. <ArrowUpDown size={12} />
                    </button>
                  </th>
                  <th className="text-left px-4 py-3">WhatsApp</th>
                  <th className="text-left px-4 py-3">Tendencia</th>
                  <th className="text-left px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {sortedVendors.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-muted">
                      No hay vendedores configurados aún
                    </td>
                  </tr>
                ) : (
                  sortedVendors.map(vendor => (
                    <tr
                      key={vendor.id}
                      className={`hover:bg-bg transition-colors cursor-pointer ${getScoreRowClass(vendor.avg_quality_score)}`}
                      onClick={() => router.push(`/vendors/${vendor.id}`)}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <VendorAvatar vendor={{ full_name: vendor.full_name, avatar_url: vendor.avatar_url }} size="sm" />
                          <span className="font-medium text-body">{vendor.full_name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <ScoreBadge score={Math.round(vendor.avg_quality_score)} size="sm" />
                          <div className="w-16 bg-gray-100 rounded-full h-1.5">
                            <div
                              className="h-1.5 rounded-full bg-primary"
                              style={{ width: `${vendor.avg_quality_score}%` }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-600">{vendor.conversations_total}</td>
                      <td className="px-4 py-3">
                        <span className={vendor.conversations_unresponded_24h > 0 ? 'text-primary font-semibold' : 'text-muted'}>
                          {vendor.conversations_unresponded_24h}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`flex items-center gap-1 text-xs ${
                          vendor.whatsapp_instance?.status === 'connected'
                            ? 'text-green-600'
                            : 'text-red-500'
                        }`}>
                          {vendor.whatsapp_instance?.status === 'connected'
                            ? <><Wifi size={12} /> Online</>
                            : <><WifiOff size={12} /> Offline</>
                          }
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {vendor.trend > 0 ? (
                          <span className="flex items-center gap-1 text-green-600 text-xs font-medium">
                            <ChevronUp size={14} /> +{vendor.trend}
                          </span>
                        ) : vendor.trend < 0 ? (
                          <span className="flex items-center gap-1 text-red-500 text-xs font-medium">
                            <ChevronDown size={14} /> {vendor.trend}
                          </span>
                        ) : (
                          <span className="text-gray-400 text-xs">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={e => { e.stopPropagation(); router.push(`/vendors/${vendor.id}`) }}
                          className="text-xs text-primary hover:text-primary-dark font-medium border border-primary hover:border-primary-dark px-2 py-1 rounded transition-colors"
                        >
                          Ver detalle
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
