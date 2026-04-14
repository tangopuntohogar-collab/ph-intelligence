import { NextResponse } from 'next/server'
import { createServerSupabaseClient, createServiceSupabaseClient } from '@/lib/supabase-server'

// DELETE /api/admin/reset-conversations
// Elimina TODAS las conversaciones y mensajes de la base de datos.
// Solo accesible por admins.
export async function DELETE() {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role !== 'admin') {
      return NextResponse.json({ error: 'Solo admins pueden hacer esto' }, { status: 403 })
    }

    const service = createServiceSupabaseClient()

    // Borrar mensajes primero (FK)
    const { error: msgError } = await service.from('messages').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    if (msgError) return NextResponse.json({ error: msgError.message }, { status: 500 })

    // Borrar análisis IA
    const { error: aiError } = await service.from('ai_analyses').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    if (aiError) return NextResponse.json({ error: aiError.message }, { status: 500 })

    // Borrar daily_kpis
    await service.from('daily_kpis').delete().neq('id', '00000000-0000-0000-0000-000000000000')

    // Borrar conversaciones
    const { error: convError } = await service.from('conversations').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    if (convError) return NextResponse.json({ error: convError.message }, { status: 500 })

    return NextResponse.json({ success: true, message: 'Datos de ficción eliminados correctamente' })
  } catch (error) {
    console.error('Error en reset-conversations:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
