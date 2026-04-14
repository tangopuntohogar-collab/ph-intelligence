import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient, createServiceSupabaseClient } from '@/lib/supabase-server'
import { ConversationStage } from '@/types'

export async function PATCH(req: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const body = await req.json()
    const { conversationId, stage } = body as { conversationId: string; stage: ConversationStage }

    const validStages: ConversationStage[] = ['new', 'negotiation', 'proposal', 'closed_won', 'closed_lost']
    if (!validStages.includes(stage)) {
      return NextResponse.json({ error: 'Etapa inválida' }, { status: 400 })
    }

    const service = createServiceSupabaseClient()

    const { data: analysis } = await service
      .from('ai_analyses')
      .select('id')
      .eq('conversation_id', conversationId)
      .order('analyzed_at', { ascending: false })
      .limit(1)
      .single()

    if (analysis) {
      await service
        .from('ai_analyses')
        .update({ conversation_stage: stage })
        .eq('id', analysis.id)
    } else {
      const { data: conversation } = await service
        .from('conversations')
        .select('vendedor_id')
        .eq('id', conversationId)
        .single()

      if (conversation) {
        await service.from('ai_analyses').insert({
          conversation_id: conversationId,
          vendedor_id: conversation.vendedor_id,
          quality_score: 0,
          conversation_stage: stage,
          model_used: 'manual',
        })
      }
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error en pipeline PATCH:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
