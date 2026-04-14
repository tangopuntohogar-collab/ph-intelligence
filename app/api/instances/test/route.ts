import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient, createServiceSupabaseClient } from '@/lib/supabase-server'

export async function POST(req: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const body = await req.json()
    const { instanceId, api_url, api_key, instance_name } = body

    const defaultUrl = process.env.EVOLUTION_API_BASE_URL

    let url = api_url
    let key = api_key
    let name = instance_name

    if (instanceId) {
      const service = createServiceSupabaseClient()
      const { data: inst } = await service
        .from('whatsapp_instances')
        .select('api_url, api_key, instance_name')
        .eq('id', instanceId)
        .single()

      if (!inst) return NextResponse.json({ error: 'Instancia no encontrada' }, { status: 404 })
      // Siempre usar la URL del env var si está definida
      url = defaultUrl || inst.api_url
      key = inst.api_key
      name = inst.instance_name
    } else {
      // Para test de nueva instancia, también preferir env var
      url = defaultUrl || api_url
    }

    if (!url || !key || !name) {
      return NextResponse.json({ error: 'Faltan datos: api_url, api_key, instance_name' }, { status: 400 })
    }

    // Llamar a Evolution API para verificar estado de conexión
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 8000)

    try {
      const res = await fetch(
        `${url}/instance/connectionState/${name}`,
        {
          headers: { apikey: key },
          signal: controller.signal,
        }
      )
      clearTimeout(timeout)

      if (!res.ok) {
        const text = await res.text()
        return NextResponse.json({
          connected: false,
          state: 'error',
          error: `HTTP ${res.status}: ${text.slice(0, 200)}`,
        })
      }

      const data = await res.json()
      const state = data?.instance?.state ?? data?.state ?? 'unknown'
      const connected = state === 'open'

      // Actualizar estado en BD si viene por instanceId
      if (instanceId) {
        const service = createServiceSupabaseClient()
        await service
          .from('whatsapp_instances')
          .update({ status: connected ? 'connected' : 'disconnected' })
          .eq('id', instanceId)
      }

      return NextResponse.json({ connected, state, raw: data })
    } catch (fetchError) {
      clearTimeout(timeout)
      const isTimeout = (fetchError as Error).name === 'AbortError'
      return NextResponse.json({
        connected: false,
        state: 'unreachable',
        error: isTimeout ? 'Timeout: la instancia no respondió en 8 segundos' : String(fetchError),
      })
    }
  } catch (error) {
    return NextResponse.json({ error: 'Error interno', detail: String(error) }, { status: 500 })
  }
}
