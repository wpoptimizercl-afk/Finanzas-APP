-- Migración: soporte para línea de crédito / sobregiro
-- Ejecutar en Supabase SQL Editor

-- 1. Agregar campos de línea de crédito a la tabla months
--    Estos campos son NULL para meses de TC/CC (no rompe esquema existente).
--    Se populan solo cuando source_type = 'credit_line'.

ALTER TABLE public.months
  ADD COLUMN IF NOT EXISTS approved_limit  NUMERIC,
  ADD COLUMN IF NOT EXISTS used_amount     NUMERIC,
  ADD COLUMN IF NOT EXISTS available_amount NUMERIC,
  ADD COLUMN IF NOT EXISTS expiry_date     TEXT;

-- 2. Verificar que los campos se agregaron correctamente
-- SELECT column_name, data_type FROM information_schema.columns
-- WHERE table_name = 'months'
--   AND column_name IN ('approved_limit', 'used_amount', 'available_amount', 'expiry_date');

-- Nota: accounts.type ahora acepta 'credit_line' además de 'tc' | 'cc'.
-- No hay CHECK constraint en accounts.type, es solo convención en código.
