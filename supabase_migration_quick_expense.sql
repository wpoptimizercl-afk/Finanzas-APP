-- Migración: Carga Rápida de Gastos Temporales
-- Ejecutar en Supabase SQL Editor

ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS is_temporary BOOLEAN DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_transactions_temporary
  ON public.transactions (is_temporary) WHERE is_temporary = true;
