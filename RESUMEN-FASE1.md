# RESUMEN FASE 1 — PH-Intelligence

Plataforma de Inteligencia Conversacional para Punto Hogar · Tucumán, Argentina

---

## ¿Qué se implementó?

### Infraestructura
- Proyecto **Next.js 16** (App Router) + TypeScript + Tailwind CSS
- Identidad visual de Punto Hogar: rojo `#E30613`, tipografía Inter, logo oficial
- Estructura de carpetas completa con grupos de rutas `(auth)` y `(dashboard)`

### Base de Datos (Supabase)
- **5 tablas** con schema completo:
  - `users` — extiende `auth.users` con roles y jerarquía
  - `whatsapp_instances` — 12 instancias Evolution API por vendedor
  - `conversations` — sincronizadas desde Evolution API
  - `messages` — todos los mensajes con soporte multimedia
  - `ai_analyses` — análisis de IA con score, stage, coaching note
  - `daily_kpis` — métricas diarias por vendedor
- **Row Level Security** (RLS) completo: admin ve todo, supervisor ve su equipo, vendedor solo sus datos
- Trigger automático que actualiza `message_count` y `last_message_at` al insertar mensajes
- Trigger que crea perfil de usuario al registrarse en Auth

### Autenticación y Roles
- Login con email/password via Supabase Auth
- Recuperación de contraseña por email
- Middleware de protección de rutas (`/middleware.ts`)
- 3 roles: `admin`, `supervisor`, `vendedor`
- Helpers `requireAuth()` y `requireRole()` para Server Components

### Integración Evolution API (`/lib/evolution.ts`)
- Clase `EvolutionAPIClient` que maneja instancias individuales
- Sincronización de conversaciones e historial de mensajes
- Registro automático de webhook al crear instancias
- Procesamiento de eventos webhook en tiempo real
- Soporte para tipos: texto, imagen, audio, documento

### Motor de Análisis IA (`/lib/ai-analyzer.ts`)
- Llama a **Claude claude-sonnet-4-20250514** via Anthropic SDK
- System prompt especializado en ventas de electrodomésticos argentinos
- Evalúa 7 dimensiones con peso (saludo, necesidad, producto, objeciones, propuesta, cierre, ortografía)
- Genera: `quality_score`, `strengths`, `weaknesses`, `suggestions`, `conversation_stage`, `talk_ratio`, `keywords`, `sentiment`, `executive_summary`, `vendor_coaching_note`
- Persiste en Supabase y actualiza KPIs del día automáticamente

### API Routes
| Ruta | Método | Descripción |
|------|--------|-------------|
| `/api/webhooks/evolution` | POST/GET | Recibe eventos de Evolution API en tiempo real |
| `/api/sync/conversations` | POST | Sincronización manual de instancias |
| `/api/analyze/conversation` | POST | Dispara análisis IA de una conversación |
| `/api/conversations` | GET/PATCH | Lista y actualiza conversaciones |
| `/api/vendors` | GET/POST/PATCH | Gestión de vendedores |
| `/api/kpis` | GET | KPIs agregados del dashboard |
| `/api/instances` | GET/POST/PATCH | Gestión de instancias WhatsApp |
| `/api/pipeline` | PATCH | Mover conversación entre etapas |

### Páginas y Vistas

#### `/login` — Login
- Logo de Punto Hogar en header rojo corporativo
- Email/password + recuperación de contraseña
- Redirección automática si ya está autenticado

#### `/dashboard` — Panel Principal
- 5 KPI Cards: Score promedio (con semáforo), Sin respuesta +24hs, Conversiones, Pipeline activo, Índice de mejora
- Tabla de vendedores ordenable por columna con: score + barra, conv. activas, sin respuesta, estado WhatsApp, tendencia semanal
- Colores de fila por performance (verde/rojo)

#### `/conversations` — Centro de Conversaciones
- Lista con búsqueda y filtros (estado, etapa pipeline)
- Panel lateral con chat estilo WhatsApp (burbujas rojo/gris)
- Soporte visual para imagen, audio y documento
- Botón "🤖 Analizar con IA" prominente
- Si ya fue analizada: badge de score + link al informe
- Actualización en tiempo real via Supabase Realtime

#### `/analysis/:id` — Informe de Análisis IA
- Score circular con color semáforo
- 3 columnas: ✅ Fortalezas · ❌ Debilidades · 💡 Sugerencias
- Gráfico de donut con ratio de conversación (Recharts)
- Keywords como chips/badges rojos
- Resumen ejecutivo para el gerente
- Nota de coaching privada (solo admin/supervisor/propio vendedor)

#### `/vendors` — Lista de Vendedores
- Grid de cards con avatar, score, barra de progreso, estado de conexión
- Solo visible para admin y supervisor

#### `/vendors/:id` — Perfil del Vendedor
- Header con avatar, datos, score actual
- Gráfico de línea de evolución del score (últimas semanas)
- Pipeline Kanban por etapas con cambio de etapa desde selector
- Historial de conversaciones analizadas con scores

#### `/pipeline` — Pipeline Global (Admin)
- Board Kanban con 5 columnas
- Cards arrastrables (drag & drop nativo HTML5)
- Filtro por vendedor
- Cambio de etapa también via selector en cada card

#### `/settings` — Configuración (Admin)
- **Tab Usuarios**: crear vendedores/supervisores, lista con roles
- **Tab Instancias**: tabla con estado conexión, último sync, botón "Sincronizar"
- **Tab API**: documentación de variables de entorno requeridas

### Componentes Compartidos
- `<KpiCard />` — card de KPI con ícono, valor, trend y estado de alerta
- `<ScoreBadge />` — badge con color semáforo (verde/amarillo/rojo)
- `<VendorAvatar />` — avatar con foto o iniciales en rojo
- `<ChatBubble />` — burbuja estilo WhatsApp
- `<ConversationCard />` — card de lista de conversaciones
- `<AnalysisReport />` — informe completo de análisis IA
- `<LoadingSkeleton />` — skeletons para estados de carga

### Script de Seed
- **1 admin**: `admin@puntohogar.com.ar` / `Admin123!`
- **2 supervisores**: `supervisor1-2@puntohogar.com.ar` / `Supervisor123!`
- **12 vendedores**: `vendedor1-12@puntohogar.com.ar` / `Vendedor123!`
- **12 instancias** WhatsApp (una por vendedor)
- **30 conversaciones** con 5-20 mensajes cada una (nombres argentinos reales)
- **10 análisis IA** precargados con datos realistas
- **KPIs de 7 días** para todos los vendedores

---

## Variables de Entorno a Configurar

### En `.env.local` (desarrollo local)
```env
NEXT_PUBLIC_SUPABASE_URL=https://tuproyecto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
ANTHROPIC_API_KEY=sk-ant-api03-...
NEXT_PUBLIC_APP_URL=http://localhost:3000
EVOLUTION_API_BASE_URL=https://tu-evolution-api.com  # opcional
```

### En Vercel (producción)
Agregar las mismas variables en **Settings → Environment Variables** del proyecto en Vercel:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `ANTHROPIC_API_KEY`
- `NEXT_PUBLIC_APP_URL` → URL pública del deploy (ej: `https://ph-intelligence.vercel.app`)
- `EVOLUTION_API_BASE_URL` → URL base de la Evolution API

---

## Cómo Hacer el Deploy en Vercel

### 1. Supabase (primero)
1. Crear proyecto en [app.supabase.com](https://app.supabase.com)
2. Ir a **SQL Editor** y ejecutar en orden:
   - `supabase/migrations/001_initial_schema.sql`
   - `supabase/migrations/002_rls_policies.sql`
3. Copiar las credenciales desde **Settings → API**

### 2. Variables de entorno locales
```bash
cp .env.local.example .env.local
# Editar .env.local con las credenciales de Supabase y Anthropic
```

### 3. Seed de datos de prueba
```bash
npm run seed
```

### 4. Deploy en Vercel
```bash
# Instalar Vercel CLI (si no lo tenés)
npm i -g vercel

# Deploy
vercel

# O conectar el repositorio en vercel.com:
# 1. Push del código a GitHub
# 2. Import en vercel.com
# 3. Agregar variables de entorno
# 4. Deploy automático
```

### 5. Registrar webhooks de Evolution API
Después del deploy, desde **Configuración → Instancias → Sincronizar** o via API:
```bash
POST https://tu-evolution-api.com/webhook/set/{instance_name}
{
  "url": "https://ph-intelligence.vercel.app/api/webhooks/evolution",
  "webhook_by_events": false,
  "events": ["MESSAGES_UPSERT", "CONNECTION_UPDATE"]
}
```

### 6. Verificar
- Acceder a `https://ph-intelligence.vercel.app/login`
- Login con `admin@puntohogar.com.ar` / `Admin123!`

---

## Decisiones Técnicas Relevantes

| Decisión | Alternativa considerada | Motivo |
|----------|------------------------|--------|
| Drag & drop nativo HTML5 en Pipeline | `@dnd-kit` (instalado pero no usado en Pipeline) | Suficiente para MVP, menor complejidad. `@dnd-kit` disponible para Fase 2 si se necesita más control |
| `any` en `ai_analysis` del tipo `Conversation` | Tipo específico de unión | Supabase retorna análisis con estructura variable (array o null) dependiendo del join; `any` evita casts repetitivos sin perder type safety en componentes |
| Service Role key solo en backend | Exponer anon key en cliente | Seguridad: operaciones admin (crear usuarios, sync) usan service role server-side; el cliente usa la anon key respetando RLS |
| Recharts para gráficos | Chart.js, Nivo | Mejor integración con React, tree-shakeable, SSR compatible |
| CSS variables + Tailwind para colores | Solo Tailwind | Permite usar colores corporativos Punto Hogar en contextos donde Tailwind no alcanza (ej: estilos inline en SVGs) |
| Migraciones SQL manuales | Supabase CLI | Más simple para el equipo sin CLI configurado; se ejecutan directamente en el SQL Editor de Supabase |

---

## Pendiente para Fase 2

- Análisis automático al cerrar conversación (webhook trigger)
- Notificaciones push en tiempo real (Supabase Realtime + toast)
- Exportación a PDF (react-pdf)
- Librería de coaching con mejores conversaciones
- Email digest semanal al gerente
- Integración SQL Server / Tango Gestión
- Pronóstico de ventas con IA

---

*Generado automáticamente al finalizar la Fase 1 — PH-Intelligence*
