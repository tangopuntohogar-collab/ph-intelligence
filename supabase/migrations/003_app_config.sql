-- ============================================================
-- MIGRACIÓN 003: Tabla de configuración de la aplicación
-- ============================================================

CREATE TABLE IF NOT EXISTS public.app_config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Insertar valor por defecto del proveedor IA
INSERT INTO public.app_config (key, value)
VALUES ('ai_provider', 'anthropic')
ON CONFLICT (key) DO NOTHING;

-- Solo admins pueden leer/escribir configuración
ALTER TABLE public.app_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_all_config" ON public.app_config
  FOR ALL USING (public.get_user_role() = 'admin');

-- Service role siempre puede leer (para el backend)
CREATE POLICY "service_read_config" ON public.app_config
  FOR SELECT USING (true);
