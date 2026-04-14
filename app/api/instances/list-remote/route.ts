import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

// Devuelve las instancias registradas en Evolution API
export async function GET() {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const baseUrl = process.env.EVOLUTION_API_BASE_URL
    if (!baseUrl) return NextResponse.json({ error: 'EVOLUTION_API_BASE_URL no configurada' }, { status: 500 })

    // Evolution API no tiene una clave global — buscamos la primera instancia guardada para usar su api_key
    const { createServiceSupabaseClient } = await import('@/lib/supabase-server')
    const service = createServiceSupabaseClient()
    const { data: inst } = await service.from('whatsapp_instances').select('api_key').limit(1).single()

    if (!inst?.api_key) return NextResponse.json({ error: 'No hay instancias configuradas para obtener la API key' }, { status: 400 })

    const res = await fetch(`${baseUrl}/instance/fetchInstances`, {
      headers: { apikey: inst.api_key },
    })

    if (!res.ok) {
      const text = await res.text()
      return NextResponse.json({ error: `Evolution API: ${res.status} ${text.slice(0, 200)}` }, { status: 500 })
    }

    const data = await res.json()
    // Puede ser un array directo o un objeto con .data
    const instances = Array.isArray(data) ? data : (data?.data ?? data?.instances ?? [])

    const names = instances.map((i: { instance?: { instanceName?: string }; instanceName?: string; name?: string }) =>
      i?.instance?.instanceName ?? i?.instanceName ?? i?.name ?? ''
    ).filter(Boolean)

    return NextResponse.json({ instances: names })
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
