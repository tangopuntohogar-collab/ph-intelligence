// ── Formatear tiempo relativo ─────────────────────────────────────────────────
export function formatDistanceToNow(date: Date): string {
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMin = Math.floor(diffMs / 60000)
  const diffHr = Math.floor(diffMin / 60)
  const diffDay = Math.floor(diffHr / 24)

  if (diffMin < 1) return 'ahora'
  if (diffMin < 60) return `hace ${diffMin}m`
  if (diffHr < 24) return `hace ${diffHr}h`
  if (diffDay < 7) return `hace ${diffDay}d`
  return date.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' })
}

// ── Formatear fecha larga ─────────────────────────────────────────────────────
export function formatDateLong(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleDateString('es-AR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

// ── Color del score (semántico: verde/amarillo/rojo) ──────────────────────────
export function getScoreColor(score: number): string {
  if (score >= 75) return '#22c55e'  // verde: buen desempeño
  if (score >= 50) return '#eab308'  // amarillo: desempeño medio
  return '#dc2626'                   // rojo: bajo desempeño
}

// ── Etiqueta de etapa de pipeline ─────────────────────────────────────────────
export const STAGE_LABELS: Record<string, string> = {
  new: 'Nuevo Contacto',
  negotiation: 'En Negociación',
  proposal: 'Propuesta Enviada',
  closed_won: 'Ganado ✅',
  closed_lost: 'Perdido ❌',
}

export const STAGE_COLORS: Record<string, string> = {
  new: 'bg-blue-50 text-blue-700 border-blue-200',
  negotiation: 'bg-yellow-50 text-yellow-700 border-yellow-200',
  proposal: 'bg-orange-50 text-orange-700 border-orange-200',
  closed_won: 'bg-green-50 text-green-700 border-green-200',
  closed_lost: 'bg-gray-50 text-gray-600 border-gray-200',
}

// ── Truncar texto ─────────────────────────────────────────────────────────────
export function truncate(str: string, maxLen: number): string {
  return str.length > maxLen ? str.slice(0, maxLen) + '...' : str
}
