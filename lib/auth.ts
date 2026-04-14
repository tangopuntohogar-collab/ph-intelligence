import { createServerSupabaseClient } from './supabase-server'
import { redirect } from 'next/navigation'
import { UserRole } from '@/types'

// ── Verificar sesión y redirigir si no está autenticado ───────────────────────
export async function requireAuth() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  return user
}

// ── Verificar rol mínimo requerido ────────────────────────────────────────────
export async function requireRole(minRole: UserRole) {
  const user = await requireAuth()
  const supabase = await createServerSupabaseClient()

  const { data: profile } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile) redirect('/login')

  const roleHierarchy: Record<UserRole, number> = {
    vendedor: 1,
    supervisor: 2,
    admin: 3,
  }

  if (roleHierarchy[profile.role as UserRole] < roleHierarchy[minRole]) {
    redirect('/dashboard')
  }

  return { user, role: profile.role as UserRole }
}

// ── Helper: verificar si usuario puede ver a un vendedor ──────────────────────
export async function canAccessVendor(vendorId: string): Promise<boolean> {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return false

  const { data: profile } = await supabase
    .from('users')
    .select('role, supervisor_id')
    .eq('id', user.id)
    .single()

  if (!profile) return false

  if (profile.role === 'admin') return true
  if (profile.role === 'vendedor') return user.id === vendorId

  // Supervisor: verificar si el vendedor está en su equipo
  if (profile.role === 'supervisor') {
    const { data: vendor } = await supabase
      .from('users')
      .select('supervisor_id')
      .eq('id', vendorId)
      .single()
    return vendor?.supervisor_id === user.id
  }

  return false
}
