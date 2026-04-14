import { createServiceSupabaseClient } from './supabase-server'
import { EvolutionChat, EvolutionMessage, WhatsappInstance } from '@/types'

// ── Cliente Evolution API ─────────────────────────────────────────────────────
export class EvolutionAPIClient {
  private apiUrl: string
  private apiKey: string
  private instanceName: string

  constructor(instance: WhatsappInstance) {
    // La URL base se toma del env var si está definida; la almacenada puede estar desactualizada
    this.apiUrl = process.env.EVOLUTION_API_BASE_URL || instance.api_url
    this.apiKey = instance.api_key
    this.instanceName = instance.instance_name
  }

  private async fetch<T>(path: string, options?: RequestInit): Promise<T> {
    const url = `${this.apiUrl}${path}`
    const res = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        apikey: this.apiKey,
        ...options?.headers,
      },
    })

    if (!res.ok) {
      const text = await res.text()
      throw new Error(`Evolution API error [${res.status}]: ${text}`)
    }

    return res.json()
  }

  // Listar conversaciones de la instancia
  async listChats(): Promise<EvolutionChat[]> {
    try {
      const data = await this.fetch<unknown>(
        `/chat/findChats/${this.instanceName}`
      )
      // La API puede devolver array directo u objeto con array
      if (Array.isArray(data)) return data as EvolutionChat[]
      const arr = (data as { chats?: EvolutionChat[] })?.chats
      if (Array.isArray(arr)) return arr
      console.error(`[Evolution] listChats respuesta inesperada para ${this.instanceName}:`, JSON.stringify(data).slice(0, 300))
      return []
    } catch (e) {
      console.error(`[Evolution] listChats error para ${this.instanceName}:`, e)
      return []
    }
  }

  // Obtener mensajes de una conversación
  async getMessages(remoteJid: string, limit = 50): Promise<EvolutionMessage[]> {
    try {
      const data = await this.fetch<unknown>(
        `/chat/findMessages/${this.instanceName}`,
        {
          method: 'POST',
          body: JSON.stringify({
            where: { key: { remoteJid } },
            limit,
          }),
        }
      )
      // Distintos formatos posibles
      const records =
        (data as { messages?: { records?: EvolutionMessage[] } })?.messages?.records ??
        (data as { records?: EvolutionMessage[] })?.records ??
        (Array.isArray(data) ? data as EvolutionMessage[] : [])
      return records
    } catch (e) {
      console.error(`[Evolution] getMessages error para ${remoteJid}:`, e)
      return []
    }
  }

  // Registrar webhook para recibir mensajes en tiempo real
  async registerWebhook(webhookUrl: string): Promise<boolean> {
    try {
      await this.fetch(`/webhook/set/${this.instanceName}`, {
        method: 'POST',
        body: JSON.stringify({
          url: webhookUrl,
          webhook_by_events: false,
          webhook_base64: false,
          events: [
            'MESSAGES_UPSERT',
            'MESSAGES_UPDATE',
            'CONNECTION_UPDATE',
          ],
        }),
      })
      return true
    } catch {
      return false
    }
  }

  // Verificar estado de conexión
  async getConnectionState(): Promise<'open' | 'close' | 'connecting'> {
    try {
      const data = await this.fetch<{ instance: { state: string } }>(
        `/instance/connectionState/${this.instanceName}`
      )
      return (data?.instance?.state as 'open' | 'close' | 'connecting') ?? 'close'
    } catch {
      return 'close'
    }
  }
}

// ── Servicio de Sincronización ────────────────────────────────────────────────
export async function syncInstanceConversations(instance: WhatsappInstance): Promise<{
  synced: number
  errors: number
  chatsFound: number
}> {
  const supabase = createServiceSupabaseClient()
  const client = new EvolutionAPIClient(instance)
  let synced = 0
  let errors = 0

  const chats = await client.listChats()
  console.log(`[Sync] ${instance.instance_name}: ${chats.length} chats encontrados en Evolution API`)

  for (const chat of chats) {
    try {
      const phone = chat.remoteJid.replace('@s.whatsapp.net', '').replace('@g.us', '')
      const isGroup = chat.remoteJid.endsWith('@g.us')
      if (isGroup) continue // Ignorar grupos por ahora

      // Upsert conversación
      const { data: conv, error: convError } = await supabase
        .from('conversations')
        .upsert({
          instance_id: instance.id,
          remote_jid: chat.remoteJid,
          vendedor_id: instance.vendedor_id,
          client_name: chat.name ?? null,
          client_phone: phone,
          last_message_at: chat.lastMessage?.messageTimestamp
            ? new Date(chat.lastMessage.messageTimestamp * 1000).toISOString()
            : null,
          status: 'active',
        }, { onConflict: 'instance_id,remote_jid' })
        .select()
        .single()

      if (convError || !conv) {
        console.error(`[Sync] Error upsert conversación ${chat.remoteJid}:`, convError?.message)
        errors++
        continue
      }

      // Sincronizar mensajes
      const messages = await client.getMessages(chat.remoteJid, 100)
      for (const msg of messages) {
        const content = extractMessageContent(msg)
        if (!content) continue

        await supabase.from('messages').upsert({
          conversation_id: conv.id,
          external_id: msg.key.id,
          content,
          type: detectMessageType(msg),
          from_me: msg.key.fromMe,
          msg_timestamp: new Date(msg.messageTimestamp * 1000).toISOString(),
          media_url: extractMediaUrl(msg),
        }, { onConflict: 'external_id', ignoreDuplicates: true })
      }

      console.log(`[Sync] ${instance.instance_name}: conversación ${phone} sincronizada (${messages.length} mensajes)`)
      synced++
    } catch (e) {
      console.error(`[Sync] Error procesando chat:`, e)
      errors++
    }
  }

  // Actualizar last_sync_at
  await supabase
    .from('whatsapp_instances')
    .update({ last_sync_at: new Date().toISOString() })
    .eq('id', instance.id)

  console.log(`[Sync] ${instance.instance_name}: finalizado — ${synced} sync, ${errors} errores`)
  return { synced, errors, chatsFound: chats.length }
}

// ── Helpers para procesar mensajes ────────────────────────────────────────────
export function extractMessageContent(msg: EvolutionMessage): string {
  const m = msg.message
  if (m.conversation) return m.conversation
  if (m.imageMessage?.caption) return m.imageMessage.caption
  if (m.imageMessage) return '[Imagen]'
  if (m.audioMessage) return '[Audio]'
  if (m.documentMessage?.caption) return m.documentMessage.caption
  if (m.documentMessage?.fileName) return `[Documento: ${m.documentMessage.fileName}]`
  if (m.documentMessage) return '[Documento]'
  return ''
}

export function detectMessageType(msg: EvolutionMessage): 'text' | 'image' | 'audio' | 'document' {
  if (msg.message.imageMessage) return 'image'
  if (msg.message.audioMessage) return 'audio'
  if (msg.message.documentMessage) return 'document'
  return 'text'
}

export function extractMediaUrl(msg: EvolutionMessage): string | null {
  if (msg.message.imageMessage?.url) return msg.message.imageMessage.url
  if (msg.message.audioMessage?.url) return msg.message.audioMessage.url
  if (msg.message.documentMessage?.url) return msg.message.documentMessage.url
  return null
}

/**
 * @deprecated No se usa desde el webhook directo.
 * Los mensajes entrantes son procesados por N8N antes de llegar a esta app.
 * Conservada como referencia hasta confirmar migración completa.
 */
// ── Procesar mensaje entrante del webhook ─────────────────────────────────────
export async function processWebhookMessage(payload: {
  instance: string
  data: EvolutionMessage
}): Promise<void> {
  const supabase = createServiceSupabaseClient()
  const msg = payload.data

  if (!msg?.key?.remoteJid || !msg?.message) return

  const isGroup = msg.key.remoteJid.endsWith('@g.us')
  if (isGroup) return

  // Buscar instancia
  const { data: instance } = await supabase
    .from('whatsapp_instances')
    .select('*')
    .eq('instance_name', payload.instance)
    .single()

  if (!instance) return

  const phone = msg.key.remoteJid.replace('@s.whatsapp.net', '')

  // Upsert conversación
  const { data: conv } = await supabase
    .from('conversations')
    .upsert({
      instance_id: instance.id,
      remote_jid: msg.key.remoteJid,
      vendedor_id: instance.vendedor_id,
      client_phone: phone,
      status: 'active',
    }, { onConflict: 'instance_id,remote_jid' })
    .select()
    .single()

  if (!conv) return

  const content = extractMessageContent(msg)
  if (!content) return

  await supabase.from('messages').upsert({
    conversation_id: conv.id,
    external_id: msg.key.id,
    content,
    type: detectMessageType(msg),
    from_me: msg.key.fromMe,
    msg_timestamp: new Date(msg.messageTimestamp * 1000).toISOString(),
    media_url: extractMediaUrl(msg),
  }, { onConflict: 'external_id', ignoreDuplicates: true })
}
