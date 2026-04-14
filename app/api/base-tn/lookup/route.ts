import { NextResponse } from 'next/server'
import { createServerSupabaseClient, createServiceSupabaseClient } from '@/lib/supabase-server'
import { normalizePhone } from '@/lib/utils'

// GET /api/base-tn/lookup
// Devuelve un mapa de teléfono normalizado (10 dígitos) → cod_cliente
// El frontend lo usa para mostrar el cod_cliente bajo el número de la conversación
export async function GET() {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const service = createServiceSupabaseClient()
    const { data, error } = await service
      .from('base_tn')
      .select('cod_cliente, telefono_1, telefono_2')

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Construir mapa normalizado: teléfono → cod_cliente
    const map: Record<string, string> = {}
    for (const row of data ?? []) {
      if (!row.cod_cliente) continue
      if (row.telefono_1) {
        const norm = normalizePhone(row.telefono_1)
        if (norm.length >= 8) map[norm] = row.cod_cliente
      }
      if (row.telefono_2) {
        const norm = normalizePhone(row.telefono_2)
        if (norm.length >= 8) map[norm] = row.cod_cliente
      }
    }

    return NextResponse.json({ data: map })
  } catch {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
