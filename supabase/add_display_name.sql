-- Agregar columna display_name a la tabla conversations
-- Ejecutar en Supabase SQL Editor

ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS display_name TEXT;

-- Índice opcional para búsquedas por nombre
CREATE INDEX IF NOT EXISTS idx_conversations_display_name ON conversations (display_name);
