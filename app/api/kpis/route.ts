import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient, createServiceSupabaseClient } from '@/lib/supabase-server'

export async function GET(req: NextRequest) {
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

    const service = createServiceSupabaseClient()

    const today = new Date().toISOString().split('T')[0]
    const yesterday = new Date(Date.now() - 86400000 * 7)
      .toISOString()
      .split('T')[0]

    let kpisQuery = service
      .from('daily_kpis')
      .select('*, vendedor:users!vendedor_id(full_name, avatar_url)')
      .gte('date', yesterday)
      .order('date', { ascending: false })

    if (profile?.role === 'supervisor') {
      const { data: myVendors } = await service
        .from('users')
        .select('id')
        .eq('supervisor_id', user.id)

      const vendorIds = myVendors?.map(v => v.id) ?? []
      kpisQuery = kpisQuery.in('vendedor_id', vendorIds)
    } else if (profile?.role === 'vendedor') {
      kpisQuery = kpisQuery.eq('vendedor_id', user.id)
    }

    const { data: kpis } = await kpisQuery

    const { data: instances } = await service
      .from('whatsapp_instances')
      .select('id, status')

    const connected = instances?.filter(i => i.status === 'connected').length ?? 0
    const total = instances?.length ?? 0

    const todayKpis = kpis?.filter(k => k.date === today) ?? []
    const prevKpis = kpis?.filter(k => k.date !== today) ?? []

    const avgScore = todayKpis.length
      ? todayKpis.reduce((s, k) => s + k.avg_quality_score, 0) / todayKpis.length
      : 0

    const avgScorePrev = prevKpis.length
      ? prevKpis.reduce((s, k) => s + k.avg_quality_score, 0) / prevKpis.length
      : 0

    const unresponded = todayKpis.reduce((s, k) => s + k.conversations_unresponded_24h, 0)
    const totalConvs = todayKpis.reduce((s, k) => s + k.conversations_total, 0)
    const estimatedConversions = todayKpis.reduce((s, k) => s + k.estimated_conversions, 0)

    const pipelineCounts = todayKpis.reduce((acc, k) => {
      const counts = k.pipeline_stage_counts as Record<string, number>
      Object.entries(counts).forEach(([stage, count]) => {
        acc[stage] = (acc[stage] ?? 0) + count
      })
      return acc
    }, {} as Record<string, number>)

    const vendorsImproved = todayKpis.filter(k => {
      const prev = prevKpis.find(p => p.vendedor_id === k.vendedor_id)
      return prev && k.avg_quality_score > prev.avg_quality_score
    }).length

    const vendorsDeclined = todayKpis.filter(k => {
      const prev = prevKpis.find(p => p.vendedor_id === k.vendedor_id)
      return prev && k.avg_quality_score < prev.avg_quality_score
    }).length

    return NextResponse.json({
      avg_quality_score: Math.round(avgScore * 10) / 10,
      avg_quality_score_prev: Math.round(avgScorePrev * 10) / 10,
      unresponded_24h: unresponded,
      estimated_conversions: estimatedConversions,
      estimated_conversions_prev: 0,
      active_conversations: totalConvs,
      pipeline_counts: pipelineCounts,
      vendors_improved: vendorsImproved,
      vendors_declined: vendorsDeclined,
      connected_instances: connected,
      total_instances: total,
      kpis_by_vendor: todayKpis,
    })
  } catch (error) {
    console.error('Error en KPIs:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
