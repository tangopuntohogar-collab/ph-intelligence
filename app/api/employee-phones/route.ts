import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient, createServiceSupabaseClient } from '@/lib/supabase-server'

// ── GET: listar todos los teléfonos de empleados ──────────────────────────────
export async function GET() {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const service = createServiceSupabaseClient()
    const { data, error } = await service
      .from('employee_phones')
      .select('id, phone, name, notes, created_at')
      .order('name', { ascending: true, nullsFirst: false })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ data })
  } catch {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

// ── POST: agregar teléfono ────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const body = await req.json()
    const phone = body.phone?.toString().trim().replace(/\D/g, '')
    const name  = body.name?.toString().trim() || null
    const notes = body.notes?.toString().trim() || null

    if (!phone) return NextResponse.json({ error: 'El teléfono es requerido' }, { status: 400 })

    const service = createServiceSupabaseClient()
    const { data, error } = await service
      .from('employee_phones')
      .insert({ phone, name, notes, created_by: user.id })
      .select()
      .single()

    if (error) {
      const msg = error.code === '23505' ? 'Ese número ya está registrado' : error.message
      return NextResponse.json({ error: msg }, { status: 400 })
    }

    return NextResponse.json({ data })
  } catch {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

// ── PATCH: editar teléfono ────────────────────────────────────────────────────
export async function PATCH(req: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const body = await req.json()
    const { id, phone: rawPhone, name: rawName, notes: rawNotes } = body

    if (!id) return NextResponse.json({ error: 'ID requerido' }, { status: 400 })

    const updates: Record<string, string | null> = { updated_at: new Date().toISOString() }
    if (rawPhone !== undefined) updates.phone = rawPhone.toString().trim().replace(/\D/g, '')
    if (rawName  !== undefined) updates.name  = rawName?.toString().trim() || null
    if (rawNotes !== undefined) updates.notes = rawNotes?.toString().trim() || null

    const service = createServiceSupabaseClient()
    const { data, error } = await service
      .from('employee_phones')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      const msg = error.code === '23505' ? 'Ese número ya está registrado' : error.message
      return NextResponse.json({ error: msg }, { status: 400 })
    }

    return NextResponse.json({ data })
  } catch {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

// ── DELETE: eliminar teléfono ─────────────────────────────────────────────────
export async function DELETE(req: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'ID requerido' }, { status: 400 })

    const service = createServiceSupabaseClient()
    const { error } = await service.from('employee_phones').delete().eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
