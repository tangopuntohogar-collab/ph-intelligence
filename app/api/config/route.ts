import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { getActiveProvider, setActiveProvider, AIProvider } from '@/lib/ai-providers'

export async function GET() {
  try {
    const provider = await getActiveProvider()
    return NextResponse.json({ ai_provider: provider })
  } catch {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const { data: profile } = await supabase
      .from('users').select('role').eq('id', user.id).single()
    if (profile?.role !== 'admin') {
      return NextResponse.json({ error: 'Solo admins pueden cambiar la configuración' }, { status: 403 })
    }

    const body = await req.json()
    const { ai_provider } = body as { ai_provider: AIProvider }

    if (!['anthropic', 'gemini'].includes(ai_provider)) {
      return NextResponse.json({ error: 'Proveedor inválido' }, { status: 400 })
    }

    await setActiveProvider(ai_provider)
    return NextResponse.json({ success: true, ai_provider })
  } catch {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
