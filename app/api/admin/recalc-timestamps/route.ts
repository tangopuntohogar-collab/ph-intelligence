import { NextResponse } from 'next/server'
import { createServerSupabaseClient, createServiceSupabaseClient } from '@/lib/supabase-server'
import { EvolutionAPIClient } from '@/lib/evolution'
import { WhatsappInstance } from '@/types'

// POST /api/admin/recalc-timestamps
// Para cada conversación, obtiene los mensajes reales de Evolution API
// y actualiza last_message_at con el timestamp del mensaje más reciente
export async function POST() {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const { data: profile } = await supabase.from('users').select('role').eq('id', user.id).single()
    if (profile?.role !== 'admin') return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })

    const service = createServiceSupabaseClient()

    // Traer todas las conversaciones con su instancia
    const { data: convs, error } = await service
      .from('conversations')
      .select('id, remote_jid, instance:whatsapp_instances(*)')
      .not('remote_jid', 'is', null)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    let updated = 0
    let skipped = 0

    for (const conv of convs ?? []) {
      try {
        const instance = conv.instance as unknown as WhatsappInstance | null
        if (!instance) { skipped++; continue }

        const client = new EvolutionAPIClient(instance)
        const msgs = await client.getMessages(conv.remote_jid, 50)

        if (msgs.length === 0) { skipped++; continue }

        const maxTs = msgs.reduce((max, m) => {
          const ts = (m.messageTimestamp ?? 0) * 1000
          return ts > max ? ts : max
        }, 0)

        if (maxTs === 0) { skipped++; continue }

        await service
          .from('conversations')
          .update({ last_message_at: new Date(maxTs).toISOString() })
          .eq('id', conv.id)

        updated++
      } catch {
        skipped++
      }
    }

    return NextResponse.json({ updated, skipped, total: (convs ?? []).length })
  } catch {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
