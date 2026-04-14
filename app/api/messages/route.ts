import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import {
  EvolutionAPIClient,
  extractMessageContent,
  detectMessageType,
  extractMediaUrl,
} from '@/lib/evolution'

export async function GET(req: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const conversationId = req.nextUrl.searchParams.get('conversationId')
    if (!conversationId) {
      return NextResponse.json({ error: 'conversationId requerido' }, { status: 400 })
    }

    // Obtener conversación con su instancia de WhatsApp
    const { data: conv, error } = await supabase
      .from('conversations')
      .select('*, instance:whatsapp_instances(*)')
      .eq('id', conversationId)
      .single()

    if (error || !conv) {
      return NextResponse.json({ error: 'Conversación no encontrada' }, { status: 404 })
    }

    const instance = conv.instance
    if (!instance) {
      return NextResponse.json({ messages: [] })
    }

    const client = new EvolutionAPIClient(instance)
    const rawMessages = await client.getMessages(conv.remote_jid, 100)

    const messages = rawMessages
      .filter(msg => extractMessageContent(msg) !== '')
      .map(msg => ({
        id: msg.key.id,
        conversation_id: conversationId,
        content: extractMessageContent(msg),
        type: detectMessageType(msg),
        from_me: msg.key.fromMe,
        msg_timestamp: new Date(msg.messageTimestamp * 1000).toISOString(),
        media_url: extractMediaUrl(msg) ?? null,
      }))
      .sort((a, b) => new Date(a.msg_timestamp).getTime() - new Date(b.msg_timestamp).getTime())

    return NextResponse.json({ messages })
  } catch (error) {
    console.error('Error fetching messages from Evolution API:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
