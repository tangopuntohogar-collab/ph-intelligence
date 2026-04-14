import { createServerSupabaseClient, createServiceSupabaseClient, getServerUserProfile } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import ScoreBadge from '@/components/ui/ScoreBadge'
import VendorAvatar from '@/components/ui/VendorAvatar'
import VendorCardActions from '@/components/vendors/VendorCardActions'
import { Wifi, WifiOff } from 'lucide-react'

export default async function VendorsPage() {
  const profile = await getServerUserProfile()
  if (!profile) redirect('/login')
  if (profile.role === 'vendedor') redirect('/dashboard')

  const service = createServiceSupabaseClient()

  let vendorsQuery = service
    .from('users')
    .select(`
      *,
      daily_kpis(avg_quality_score, conversations_total, conversations_unresponded_24h, date)
    `)
    .eq('role', 'vendedor')
    .order('full_name')

  if (profile.role === 'supervisor') {
    vendorsQuery = vendorsQuery.eq('supervisor_id', profile.id)
  }

  const { data: vendors } = await vendorsQuery

  // Instancias por vendedor (query separada para evitar ambigüedad de FK)
  const { data: instances } = await service
    .from('whatsapp_instances')
    .select('vendedor_id, status, phone_number')

  const instanceByVendor = Object.fromEntries(
    (instances ?? []).map(i => [i.vendedor_id, i])
  )

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-body">Vendedores</h1>
          <p className="text-sm text-gray-500 mt-0.5">{vendors?.length ?? 0} vendedores en tu equipo</p>
        </div>
        {profile.role === 'admin' && (
          <Link
            href="/settings"
            className="bg-primary hover:bg-primary-dark text-white text-sm font-semibold px-4 py-2 rounded-md transition-colors"
          >
            + Nuevo vendedor
          </Link>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {(vendors ?? []).map(vendor => {
          const kpis = (vendor.daily_kpis as Array<{ avg_quality_score: number; conversations_total: number; conversations_unresponded_24h: number; date: string }> | null)
          const latestKpi = kpis?.sort((a, b) => b.date.localeCompare(a.date))[0]
          const instance = instanceByVendor[vendor.id] ?? null

          return (
            <Link key={vendor.id} href={`/vendors/${vendor.id}`}>
              <div className="bg-surface rounded-lg shadow-sm border border-border p-5 hover:shadow-md transition-shadow cursor-pointer">
                <div className="flex items-start justify-between mb-3">
                  <VendorAvatar vendor={vendor} size="lg" />
                  <div className="flex flex-col items-end gap-1">
                    <div className="flex items-center gap-1">
                      <span className={`flex items-center gap-1 text-xs ${
                        instance?.status === 'connected' ? 'text-green-600' : 'text-gray-400'
                      }`}>
                        {instance?.status === 'connected'
                          ? <><Wifi size={12} /> Online</>
                          : <><WifiOff size={12} /> Offline</>
                        }
                      </span>
                      {profile.role === 'admin' && (
                        <VendorCardActions vendor={{ id: vendor.id, full_name: vendor.full_name }} />
                      )}
                    </div>
                    {latestKpi && (
                      <ScoreBadge score={Math.round(latestKpi.avg_quality_score)} size="sm" />
                    )}
                  </div>
                </div>

                <h3 className="font-semibold text-body truncate">{vendor.full_name}</h3>
                <p className="text-xs text-gray-400 mb-3">{instance?.phone_number ?? vendor.email}</p>

                {latestKpi && (
                  <div className="space-y-1">
                    <div className="w-full bg-gray-100 rounded-full h-1.5">
                      <div
                        className="h-1.5 rounded-full bg-primary"
                        style={{ width: `${latestKpi.avg_quality_score}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-xs text-gray-500">
                      <span>{latestKpi.conversations_total} conv.</span>
                      {latestKpi.conversations_unresponded_24h > 0 && (
                        <span className="text-red-500 font-medium">
                          {latestKpi.conversations_unresponded_24h} sin resp.
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </Link>
          )
        })}

        {(vendors ?? []).length === 0 && (
          <div className="col-span-full text-center text-gray-400 py-12">
            No hay vendedores configurados aún
          </div>
        )}
      </div>
    </div>
  )
}
