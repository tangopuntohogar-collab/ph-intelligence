-- ============================================================
-- MIGRACIÓN 001: Schema inicial — PH-Intelligence
-- ============================================================

-- Habilitar extensiones necesarias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── Tabla de usuarios (extiende auth.users de Supabase) ───────────────────────
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'supervisor', 'vendedor')) DEFAULT 'vendedor',
  whatsapp_instance_id UUID,
  supervisor_id UUID REFERENCES public.users(id),
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- ── Instancias WhatsApp (Evolution API) ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.whatsapp_instances (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  instance_name TEXT NOT NULL UNIQUE,
  vendedor_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  api_url TEXT NOT NULL,
  api_key TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('connected', 'disconnected')) DEFAULT 'disconnected',
  phone_number TEXT,
  last_sync_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Agregar FK whatsapp_instance_id en users
ALTER TABLE public.users
  ADD CONSTRAINT fk_users_whatsapp_instance
  FOREIGN KEY (whatsapp_instance_id) REFERENCES public.whatsapp_instances(id) ON DELETE SET NULL;

-- ── Conversaciones ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.conversations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  instance_id UUID REFERENCES public.whatsapp_instances(id) ON DELETE SET NULL,
  remote_jid TEXT NOT NULL,
  vendedor_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  status TEXT NOT NULL CHECK (status IN ('active', 'closed', 'pending')) DEFAULT 'active',
  last_message_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  message_count INTEGER DEFAULT 0,
  client_name TEXT,
  client_phone TEXT NOT NULL,
  UNIQUE(instance_id, remote_jid)
);

-- ── Mensajes ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  content TEXT NOT NULL DEFAULT '',
  type TEXT NOT NULL CHECK (type IN ('text', 'image', 'audio', 'document')) DEFAULT 'text',
  from_me BOOLEAN NOT NULL DEFAULT FALSE,
  msg_timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  media_url TEXT,
  external_id TEXT UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- ── Análisis IA ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.ai_analyses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  vendedor_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  quality_score INTEGER NOT NULL CHECK (quality_score >= 0 AND quality_score <= 100),
  strengths TEXT[] DEFAULT '{}',
  weaknesses TEXT[] DEFAULT '{}',
  suggestions TEXT[] DEFAULT '{}',
  conversation_stage TEXT NOT NULL CHECK (conversation_stage IN ('new','negotiation','proposal','closed_won','closed_lost')) DEFAULT 'new',
  talk_ratio_vendor FLOAT NOT NULL DEFAULT 50,
  talk_ratio_client FLOAT NOT NULL DEFAULT 50,
  keywords_detected TEXT[] DEFAULT '{}',
  sentiment TEXT NOT NULL CHECK (sentiment IN ('positive','neutral','negative')) DEFAULT 'neutral',
  full_report TEXT DEFAULT '',
  executive_summary TEXT DEFAULT '',
  vendor_coaching_note TEXT DEFAULT '',
  analyzed_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  model_used TEXT NOT NULL DEFAULT 'claude-sonnet-4-20250514'
);

-- ── KPIs diarios ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.daily_kpis (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  vendedor_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  conversations_total INTEGER DEFAULT 0,
  conversations_responded_24h INTEGER DEFAULT 0,
  conversations_unresponded_24h INTEGER DEFAULT 0,
  avg_quality_score FLOAT DEFAULT 0,
  estimated_conversions INTEGER DEFAULT 0,
  pipeline_stage_counts JSONB DEFAULT '{"new":0,"negotiation":0,"proposal":0,"closed_won":0,"closed_lost":0}',
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE(vendedor_id, date)
);

-- ── Índices para performance ──────────────────────────────────────────────────
CREATE INDEX idx_conversations_vendedor ON public.conversations(vendedor_id);
CREATE INDEX idx_conversations_status ON public.conversations(status);
CREATE INDEX idx_conversations_last_message ON public.conversations(last_message_at DESC);
CREATE INDEX idx_messages_conversation ON public.messages(conversation_id);
CREATE INDEX idx_messages_timestamp ON public.messages(msg_timestamp DESC);
CREATE INDEX idx_ai_analyses_conversation ON public.ai_analyses(conversation_id);
CREATE INDEX idx_ai_analyses_vendedor ON public.ai_analyses(vendedor_id);
CREATE INDEX idx_daily_kpis_vendedor_date ON public.daily_kpis(vendedor_id, date DESC);

-- ── Función para actualizar message_count automáticamente ─────────────────────
CREATE OR REPLACE FUNCTION update_conversation_on_message()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.conversations
  SET
    message_count = message_count + 1,
    last_message_at = NEW.msg_timestamp
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_conversation_on_message
  AFTER INSERT ON public.messages
  FOR EACH ROW EXECUTE FUNCTION update_conversation_on_message();

-- ── Función para crear perfil de usuario al registrarse ───────────────────────
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    COALESCE(NEW.raw_user_meta_data->>'role', 'vendedor')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
