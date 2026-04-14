-- ============================================================
-- MIGRACIÓN 002: Row Level Security Policies
-- ============================================================

-- Habilitar RLS en todas las tablas
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_instances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_kpis ENABLE ROW LEVEL SECURITY;

-- ── Función helper para obtener rol del usuario actual ────────────────────────
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS TEXT AS $$
  SELECT role FROM public.users WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.get_supervisor_id()
RETURNS UUID AS $$
  SELECT supervisor_id FROM public.users WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ── Políticas: users ──────────────────────────────────────────────────────────
-- Admin: ver todos los usuarios
CREATE POLICY "admin_select_users" ON public.users
  FOR SELECT USING (public.get_user_role() = 'admin');

-- Supervisor: ver usuarios de su equipo
CREATE POLICY "supervisor_select_users" ON public.users
  FOR SELECT USING (
    public.get_user_role() = 'supervisor' AND (
      id = auth.uid() OR supervisor_id = auth.uid()
    )
  );

-- Vendedor: solo se ve a sí mismo
CREATE POLICY "vendedor_select_self" ON public.users
  FOR SELECT USING (id = auth.uid());

-- Admin: insertar y actualizar usuarios
CREATE POLICY "admin_insert_users" ON public.users
  FOR INSERT WITH CHECK (public.get_user_role() = 'admin');

CREATE POLICY "admin_update_users" ON public.users
  FOR UPDATE USING (public.get_user_role() = 'admin');

-- Cualquier usuario puede actualizar su propio perfil
CREATE POLICY "self_update_users" ON public.users
  FOR UPDATE USING (id = auth.uid());

-- ── Políticas: whatsapp_instances ─────────────────────────────────────────────
-- Admin: acceso total
CREATE POLICY "admin_all_instances" ON public.whatsapp_instances
  FOR ALL USING (public.get_user_role() = 'admin');

-- Supervisor: ver instancias de su equipo
CREATE POLICY "supervisor_select_instances" ON public.whatsapp_instances
  FOR SELECT USING (
    public.get_user_role() = 'supervisor' AND
    vendedor_id IN (SELECT id FROM public.users WHERE supervisor_id = auth.uid())
  );

-- Vendedor: ver solo su instancia
CREATE POLICY "vendedor_select_own_instance" ON public.whatsapp_instances
  FOR SELECT USING (
    public.get_user_role() = 'vendedor' AND vendedor_id = auth.uid()
  );

-- ── Políticas: conversations ──────────────────────────────────────────────────
CREATE POLICY "admin_all_conversations" ON public.conversations
  FOR ALL USING (public.get_user_role() = 'admin');

CREATE POLICY "supervisor_select_conversations" ON public.conversations
  FOR SELECT USING (
    public.get_user_role() = 'supervisor' AND
    vendedor_id IN (SELECT id FROM public.users WHERE supervisor_id = auth.uid())
  );

CREATE POLICY "vendedor_select_own_conversations" ON public.conversations
  FOR SELECT USING (
    public.get_user_role() = 'vendedor' AND vendedor_id = auth.uid()
  );

CREATE POLICY "vendedor_update_own_conversations" ON public.conversations
  FOR UPDATE USING (
    public.get_user_role() = 'vendedor' AND vendedor_id = auth.uid()
  );

-- ── Políticas: messages ───────────────────────────────────────────────────────
CREATE POLICY "admin_all_messages" ON public.messages
  FOR ALL USING (public.get_user_role() = 'admin');

CREATE POLICY "supervisor_select_messages" ON public.messages
  FOR SELECT USING (
    public.get_user_role() = 'supervisor' AND
    conversation_id IN (
      SELECT id FROM public.conversations WHERE
      vendedor_id IN (SELECT id FROM public.users WHERE supervisor_id = auth.uid())
    )
  );

CREATE POLICY "vendedor_select_own_messages" ON public.messages
  FOR SELECT USING (
    public.get_user_role() = 'vendedor' AND
    conversation_id IN (
      SELECT id FROM public.conversations WHERE vendedor_id = auth.uid()
    )
  );

-- ── Políticas: ai_analyses ────────────────────────────────────────────────────
CREATE POLICY "admin_all_analyses" ON public.ai_analyses
  FOR ALL USING (public.get_user_role() = 'admin');

CREATE POLICY "supervisor_select_analyses" ON public.ai_analyses
  FOR SELECT USING (
    public.get_user_role() = 'supervisor' AND
    vendedor_id IN (SELECT id FROM public.users WHERE supervisor_id = auth.uid())
  );

CREATE POLICY "vendedor_select_own_analyses" ON public.ai_analyses
  FOR SELECT USING (
    public.get_user_role() = 'vendedor' AND vendedor_id = auth.uid()
  );

-- ── Políticas: daily_kpis ─────────────────────────────────────────────────────
CREATE POLICY "admin_all_kpis" ON public.daily_kpis
  FOR ALL USING (public.get_user_role() = 'admin');

CREATE POLICY "supervisor_select_kpis" ON public.daily_kpis
  FOR SELECT USING (
    public.get_user_role() = 'supervisor' AND
    vendedor_id IN (SELECT id FROM public.users WHERE supervisor_id = auth.uid())
  );

CREATE POLICY "vendedor_select_own_kpis" ON public.daily_kpis
  FOR SELECT USING (
    public.get_user_role() = 'vendedor' AND vendedor_id = auth.uid()
  );

-- ── Habilitar Realtime para mensajes y conversaciones ─────────────────────────
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations;
