-- ============================================================
-- Tabla: employee_phones — Teléfonos internos de empleados
-- Ejecutar en Supabase → SQL Editor
-- ============================================================

CREATE TABLE IF NOT EXISTS public.employee_phones (
  id         UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  phone      TEXT        NOT NULL,              -- número en formato WhatsApp, ej: 5491112345678
  name       TEXT,                              -- nombre del empleado (opcional)
  notes      TEXT,                              -- notas adicionales (opcional)
  created_by UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_employee_phones_phone ON public.employee_phones(phone);

-- RLS: todos los usuarios autenticados pueden ver, crear, editar y eliminar
ALTER TABLE public.employee_phones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_select_employee_phones"
  ON public.employee_phones FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "auth_insert_employee_phones"
  ON public.employee_phones FOR INSERT
  TO authenticated WITH CHECK (true);

CREATE POLICY "auth_update_employee_phones"
  ON public.employee_phones FOR UPDATE
  TO authenticated USING (true);

CREATE POLICY "auth_delete_employee_phones"
  ON public.employee_phones FOR DELETE
  TO authenticated USING (true);
