import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient, createServiceSupabaseClient } from '@/lib/supabase-server'
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

    const service = createServiceSupabaseClient()

    // ── 1. Leer mensajes desde Supabase (insertados por N8N) ──────────────────
    const { data: dbMessages, error: dbError } = await service
      .from('messages')
      .select('id, conversation_id, content, type, from_me, msg_timestamp, media_url')
      .eq('conversation_id', conversationId)
      .order('msg_timestamp', { ascending: true })

    if (!dbError && dbMessages && dbMessages.length > 0) {
      // Corregir last_message_at con el timestamp real del último mensaje
      const latestTs = dbMessages[dbMessages.length - 1].msg_timestamp
      await service
        .from('conversations')
        .update({ last_message_at: latestTs })
        .eq('id', conversationId)

      return NextResponse.json({ messages: dbMessages, source: 'db' })
    }

    // ── 2. Fallback: Evolution API (para conversaciones sin mensajes en DB) ───
    const { data: conv, error: convError } = await supabase
      .from('conversations')
      .select('*, instance:whatsapp_instances(*)')
      .eq('id', conversationId)
      .single()

    if (convError || !conv) {
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
        msg_timestamp: new Date((msg.messageTimestamp ?? 0) * 1000).toISOString(),
        media_url: extractMediaUrl(msg) ?? null,
      }))
      .sort((a, b) => new Date(a.msg_timestamp).getTime() - new Date(b.msg_timestamp).getTime())

    if (messages.length > 0) {
      const latestTs = messages[messages.length - 1].msg_timestamp
      await service
        .from('conversations')
        .update({ last_message_at: latestTs })
        .eq('id', conversationId)
    }

    return NextResponse.json({ messages, source: 'evolution' })
  } catch (error) {
    console.error('Error fetching messages:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
