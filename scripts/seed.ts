/**
 * SCRIPT DE SEED — PH-Intelligence
 * Genera datos de prueba realistas para demo
 *
 * Uso: npx tsx scripts/seed.ts
 * Requiere: NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY en .env.local
 */

import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

// ── Datos de prueba ───────────────────────────────────────────────────────────
const VENDEDORES = [
  'María González', 'Carlos Rodríguez', 'Ana Martínez', 'Juan Pérez',
  'Laura Sánchez', 'Diego Fernández', 'Sofía López', 'Martín García',
  'Valeria Torres', 'Lucas Romero', 'Camila Díaz', 'Facundo Ruiz',
]

const SUPERVISORES = ['Roberto Medina', 'Claudia Vargas']

const CLIENTES = [
  { name: 'Graciela Suárez', phone: '3814001001' },
  { name: 'Hernán Villareal', phone: '3814001002' },
  { name: 'Patricia Acosta', phone: '3814001003' },
  { name: 'Ramón Ibáñez', phone: '3814001004' },
  { name: 'Susana Morales', phone: '3814001005' },
  { name: 'Jorge Herrera', phone: '3814001006' },
  { name: 'Beatriz Castillo', phone: '3814001007' },
  { name: 'Gustavo Ríos', phone: '3814001008' },
  { name: 'Norma Quiroga', phone: '3814001009' },
  { name: 'Pablo Gutiérrez', phone: '3814001010' },
  { name: 'Liliana Vera', phone: '3814001011' },
  { name: 'Sergio Molina', phone: '3814001012' },
  { name: 'Rosa Jiménez', phone: '3814001013' },
  { name: 'Adrián Navarro', phone: '3814001014' },
  { name: 'Elena Paredes', phone: '3814001015' },
]

const MENSAJES_VENDEDOR = [
  '¡Buenas! Soy {vendedor} de Punto Hogar. ¿En qué te puedo ayudar hoy?',
  'Contamos con ese modelo disponible en stock. ¿Te interesa ver las características?',
  'El precio actual es de $180.000. Podemos financiarlo en hasta 18 cuotas sin interés con tarjeta.',
  'Es un producto con muy buenas reseñas. La garantía es de 1 año de fábrica.',
  'Te puedo enviar las fotos del producto si querés. ¿Me das tu email?',
  'Perfecto, lo reservamos a tu nombre. ¿Cómo preferís pagar?',
  'Con Naranja X tenés 18 cuotas sin interés. Con transferencia te hacemos un 10% de descuento.',
  'El envío a domicilio tiene un costo de $3.000 o podés retirarlo gratis por el local.',
  'Te confirmo que el pedido está listo. ¿Cuándo podés venir a buscarlo?',
  '¡Muchas gracias por elegirnos! Cualquier consulta estamos a disposición.',
]

const MENSAJES_CLIENTE = [
  'Hola, buenas tardes. Quiero consultar por una heladera.',
  '¿Tienen el modelo Samsung con freezer arriba?',
  '¿Cuánto cuesta? ¿Tienen financiación?',
  'Ah, me parece un poco caro. ¿No hay alguna promoción?',
  'Sí, me interesa verla. ¿Pueden mandarme fotos?',
  'Perfecto, voy a pensarlo. ¿Hasta cuándo tiene ese precio?',
  'Dale, lo quiero. ¿Cómo hago para comprarlo?',
  'Tengo tarjeta Mastercard del Banco Galicia.',
  '¿Hacen envío a San Miguel de Tucumán?',
  'Genial, muchas gracias por la atención.',
]

const STAGES: string[] = ['new', 'negotiation', 'proposal', 'closed_won', 'closed_lost']
const SENTIMENTS = ['positive', 'neutral', 'negative'] as const

function randomItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

function randomScore() {
  return Math.floor(Math.random() * 60) + 40 // 40-100
}

function daysAgo(n: number) {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString()
}

// ── Main ───────────────────────────────────────────────────────────────────────
async function main() {
  console.log('🌱 Iniciando seed de PH-Intelligence...\n')

  // ── 1. Crear Admin ─────────────────────────────────────────────────────────
  console.log('👤 Creando usuario admin...')
  const { data: adminAuth } = await supabase.auth.admin.createUser({
    email: 'admin@puntohogar.com.ar',
    password: 'Admin123!',
    email_confirm: true,
    user_metadata: { full_name: 'Administrador General', role: 'admin' },
  })

  if (adminAuth?.user) {
    await supabase.from('users').update({
      full_name: 'Administrador General',
      role: 'admin',
    }).eq('id', adminAuth.user.id)
    console.log(`  ✅ Admin creado: admin@puntohogar.com.ar / Admin123!`)
  }

  // ── 2. Crear Supervisores ──────────────────────────────────────────────────
  console.log('\n👥 Creando supervisores...')
  const supervisorIds: string[] = []

  for (let i = 0; i < SUPERVISORES.length; i++) {
    const nombre = SUPERVISORES[i]
    const email = `supervisor${i + 1}@puntohogar.com.ar`
    const { data: sup } = await supabase.auth.admin.createUser({
      email,
      password: 'Supervisor123!',
      email_confirm: true,
      user_metadata: { full_name: nombre, role: 'supervisor' },
    })
    if (sup?.user) {
      await supabase.from('users').update({ full_name: nombre, role: 'supervisor' }).eq('id', sup.user.id)
      supervisorIds.push(sup.user.id)
      console.log(`  ✅ Supervisor: ${email}`)
    }
  }

  // ── 3. Crear 12 Vendedores ─────────────────────────────────────────────────
  console.log('\n🧑‍💼 Creando vendedores...')
  const vendedorIds: string[] = []

  for (let i = 0; i < VENDEDORES.length; i++) {
    const nombre = VENDEDORES[i]
    const email = `vendedor${i + 1}@puntohogar.com.ar`
    const supervisorId = supervisorIds[i % supervisorIds.length]

    const { data: vend } = await supabase.auth.admin.createUser({
      email,
      password: 'Vendedor123!',
      email_confirm: true,
      user_metadata: { full_name: nombre, role: 'vendedor' },
    })

    if (vend?.user) {
      await supabase.from('users').update({
        full_name: nombre,
        role: 'vendedor',
        supervisor_id: supervisorId,
      }).eq('id', vend.user.id)
      vendedorIds.push(vend.user.id)
      console.log(`  ✅ Vendedor: ${email}`)
    }
  }

  // ── 4. Crear 12 Instancias WhatsApp ────────────────────────────────────────
  console.log('\n📱 Creando instancias WhatsApp...')
  const instanceIds: string[] = []

  for (let i = 0; i < vendedorIds.length; i++) {
    const { data: inst } = await supabase.from('whatsapp_instances').insert({
      instance_name: `vendedor${String(i + 1).padStart(2, '0')}`,
      vendedor_id: vendedorIds[i],
      api_url: process.env.EVOLUTION_API_BASE_URL ?? 'https://api.evolution.example.com',
      api_key: `api-key-vendedor-${i + 1}-demo`,
      status: Math.random() > 0.2 ? 'connected' : 'disconnected',
      phone_number: `381400${String(i + 1).padStart(4, '0')}`,
      last_sync_at: daysAgo(Math.floor(Math.random() * 3)),
    }).select().single()

    if (inst) {
      instanceIds.push(inst.id)
      // Actualizar el vendedor con la instancia
      await supabase.from('users').update({ whatsapp_instance_id: inst.id }).eq('id', vendedorIds[i])
    }
  }
  console.log(`  ✅ ${instanceIds.length} instancias creadas`)

  // ── 5. Crear 30 Conversaciones ─────────────────────────────────────────────
  console.log('\n💬 Creando conversaciones...')
  const conversationIds: string[] = []

  for (let i = 0; i < 30; i++) {
    const vendedorIdx = i % vendedorIds.length
    const cliente = CLIENTES[i % CLIENTES.length]
    const daysBack = Math.floor(Math.random() * 14)

    const { data: conv } = await supabase.from('conversations').insert({
      instance_id: instanceIds[vendedorIdx],
      remote_jid: `${cliente.phone}@s.whatsapp.net`,
      vendedor_id: vendedorIds[vendedorIdx],
      client_name: cliente.name,
      client_phone: cliente.phone,
      status: randomItem(['active', 'active', 'active', 'closed', 'pending']),
      last_message_at: daysAgo(daysBack),
      created_at: daysAgo(daysBack + 1),
    }).select().single()

    if (!conv) continue
    conversationIds.push(conv.id)

    // Generar 5-20 mensajes por conversación
    const msgCount = Math.floor(Math.random() * 15) + 5
    const messages = []
    for (let m = 0; m < msgCount; m++) {
      const fromMe = m % 2 === 0 || Math.random() > 0.6
      const msgTime = new Date(daysAgo(daysBack))
      msgTime.setMinutes(msgTime.getMinutes() + m * 3)

      const content = fromMe
        ? randomItem(MENSAJES_VENDEDOR).replace('{vendedor}', VENDEDORES[vendedorIdx].split(' ')[0])
        : randomItem(MENSAJES_CLIENTE)

      messages.push({
        conversation_id: conv.id,
        content,
        type: 'text',
        from_me: fromMe,
        timestamp: msgTime.toISOString(),
      })
    }

    await supabase.from('messages').insert(messages)
    // Actualizar message_count manualmente (el trigger lo maneja pero este es seed)
    await supabase.from('conversations').update({ message_count: msgCount }).eq('id', conv.id)
  }
  console.log(`  ✅ ${conversationIds.length} conversaciones con mensajes creadas`)

  // ── 6. Crear 10 Análisis IA precargados ────────────────────────────────────
  console.log('\n🤖 Creando análisis IA de demostración...')

  const sampleStrengths = [
    ['Saludo profesional y cálido', 'Conocimiento profundo del producto', 'Propuesta de financiación clara'],
    ['Rápida respuesta al cliente', 'Manejo eficiente de objeciones', 'Comunicación clara y directa'],
    ['Seguimiento proactivo', 'Empatía con las necesidades del cliente', 'Oferta de alternativas'],
  ]

  const sampleWeaknesses = [
    ['No indagó suficiente sobre la necesidad real', 'Faltó propuesta de cierre concreta'],
    ['Tardanza en responder consulta de precio', 'No mencionó la garantía del producto'],
    ['Ortografía con errores menores', 'No ofreció envío a domicilio'],
  ]

  const sampleSuggestions = [
    ['Hacer más preguntas de diagnóstico al inicio', 'Ofrecer descuento por pago en efectivo antes del cierre'],
    ['Mencionar siempre la garantía y el servicio técnico', 'Crear urgencia mencionando stock limitado'],
    ['Revisar ortografía antes de enviar', 'Proponer una visita al local para ver el producto'],
  ]

  for (let i = 0; i < Math.min(10, conversationIds.length); i++) {
    const score = randomScore()
    const vendedorIdx = i % vendedorIds.length
    const stage = randomItem(STAGES)
    const sentiment = score >= 70 ? 'positive' : score >= 50 ? 'neutral' : 'negative'

    await supabase.from('ai_analyses').insert({
      conversation_id: conversationIds[i],
      vendedor_id: vendedorIds[vendedorIdx],
      quality_score: score,
      strengths: randomItem(sampleStrengths),
      weaknesses: randomItem(sampleWeaknesses),
      suggestions: randomItem(sampleSuggestions),
      conversation_stage: stage,
      talk_ratio_vendor: Math.floor(Math.random() * 30) + 40,
      talk_ratio_client: Math.floor(Math.random() * 30) + 20,
      keywords_detected: ['heladera', 'precio', 'cuotas', 'garantía', 'entrega'].slice(0, Math.floor(Math.random() * 4) + 2),
      sentiment,
      executive_summary: `El vendedor ${VENDEDORES[vendedorIdx].split(' ')[0]} mostró un desempeño ${score >= 75 ? 'excelente' : score >= 50 ? 'aceptable' : 'que necesita mejorar'} en esta conversación. El cliente mostró interés en el producto y la etapa del pipeline es "${stage}". El score de calidad de ${score}/100 refleja el nivel de atención brindado.`,
      vendor_coaching_note: `${VENDEDORES[vendedorIdx].split(' ')[0]}, tu desempeño en esta conversación fue ${score >= 75 ? 'muy bueno' : score >= 50 ? 'correcto pero con oportunidades de mejora' : 'mejorable'}. ${randomItem(sampleSuggestions)[0]}. ¡Seguí esforzándote, el equipo confía en vos!`,
      full_report: JSON.stringify({ score, stage, sentiment }),
      model_used: 'seed-demo',
      analyzed_at: daysAgo(Math.floor(Math.random() * 7)),
    })
  }
  console.log('  ✅ 10 análisis IA de demostración creados')

  // ── 7. KPIs de los últimos 7 días ──────────────────────────────────────────
  console.log('\n📊 Generando KPIs históricos...')

  for (const vendedorId of vendedorIds) {
    for (let day = 0; day < 7; day++) {
      const date = new Date()
      date.setDate(date.getDate() - day)
      const dateStr = date.toISOString().split('T')[0]
      const baseScore = Math.floor(Math.random() * 40) + 50

      await supabase.from('daily_kpis').upsert({
        vendedor_id: vendedorId,
        date: dateStr,
        conversations_total: Math.floor(Math.random() * 8) + 2,
        conversations_responded_24h: Math.floor(Math.random() * 6) + 1,
        conversations_unresponded_24h: Math.floor(Math.random() * 3),
        avg_quality_score: baseScore + (day === 0 ? 0 : Math.floor(Math.random() * 10) - 5),
        estimated_conversions: Math.floor(Math.random() * 3),
        pipeline_stage_counts: {
          new: Math.floor(Math.random() * 4),
          negotiation: Math.floor(Math.random() * 3),
          proposal: Math.floor(Math.random() * 2),
          closed_won: Math.floor(Math.random() * 2),
          closed_lost: Math.floor(Math.random() * 2),
        },
      }, { onConflict: 'vendedor_id,date' })
    }
  }
  console.log('  ✅ KPIs de 7 días generados para todos los vendedores')

  console.log('\n✨ Seed completado exitosamente!\n')
  console.log('Credenciales de acceso:')
  console.log('  Admin:      admin@puntohogar.com.ar / Admin123!')
  console.log('  Supervisor: supervisor1@puntohogar.com.ar / Supervisor123!')
  console.log('  Vendedor:   vendedor1@puntohogar.com.ar / Vendedor123!')
}

main().catch(console.error)
