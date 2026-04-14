-- ============================================================
-- Tabla: base_tn — Importación de base Tarjeta Naranja
-- Ejecutar en Supabase → SQL Editor
-- ============================================================

CREATE TABLE IF NOT EXISTS public.base_tn (
  id             UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  batch_id       UUID        NOT NULL,                        -- agrupa todos los registros de una misma importación
  periodo        TEXT        NOT NULL,                        -- ej: "Enero 2025", "2025-01"
  sucursal       TEXT        NOT NULL,                        -- ej: "Centro", "Norte"
  cod_cliente    TEXT,
  nombre_cliente TEXT,
  cuit_dni       TEXT,
  telefono_1     TEXT,
  telefono_2     TEXT,
  imported_by    UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_base_tn_batch_id     ON public.base_tn(batch_id);
CREATE INDEX IF NOT EXISTS idx_base_tn_periodo       ON public.base_tn(periodo);
CREATE INDEX IF NOT EXISTS idx_base_tn_sucursal      ON public.base_tn(sucursal);
CREATE INDEX IF NOT EXISTS idx_base_tn_cod_cliente   ON public.base_tn(cod_cliente);
CREATE INDEX IF NOT EXISTS idx_base_tn_telefono_1    ON public.base_tn(telefono_1);

-- RLS
ALTER TABLE public.base_tn ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins_supervisors_select_base_tn"
  ON public.base_tn FOR SELECT
  USING (get_user_role() IN ('admin', 'supervisor'));

CREATE POLICY "admins_insert_base_tn"
  ON public.base_tn FOR INSERT
  WITH CHECK (get_user_role() = 'admin');

CREATE POLICY "admins_delete_base_tn"
  ON public.base_tn FOR DELETE
  USING (get_user_role() = 'admin');
