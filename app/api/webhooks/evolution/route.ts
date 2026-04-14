import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const payload = await req.json()
    const event: string = payload.event ?? ''

    // Actualizar estado de conexión
    if (event === 'CONNECTION_UPDATE') {
      const { createServiceSupabaseClient } = await import('@/lib/supabase-server')
      const supabase = createServiceSupabaseClient()
      const isConnected = payload.data?.state === 'open'

      await supabase
        .from('whatsapp_instances')
        .update({ status: isConnected ? 'connected' : 'disconnected' })
        .eq('instance_name', payload.instance)

      return NextResponse.json({ ok: true, event: 'CONNECTION_UPDATE' })
    }

    // Mensajes entrantes — procesados por N8N, no por esta ruta
    if (event === 'MESSAGES_UPSERT' || event === 'messages.upsert') {
      return NextResponse.json({ ok: true, handled_by: 'n8n' })
    }

    // Cualquier otro evento
    return NextResponse.json({ ok: true, event })
  } catch (error) {
    console.error('Error en webhook Evolution API:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

// GET para verificación del webhook
export async function GET() {
  return NextResponse.json({ status: 'ok', service: 'PH-Intelligence Webhook' })
}
