-- =============================================================
-- Migración: Arquitectura Multi-Cuenta
-- Finanzas APP — 2026-03-23
-- Ejecutar en Supabase SQL Editor (una sola vez)
-- =============================================================

-- ─────────────────────────────────────────────────────────────
-- 1. CREAR TABLA accounts
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.accounts (
    id          UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID    NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name        TEXT    NOT NULL,
    bank        TEXT    NOT NULL DEFAULT 'santander',
    type        TEXT    NOT NULL DEFAULT 'tc',   -- 'tc' | 'cc' | 'savings' | 'cash'
    color       TEXT    DEFAULT '#E11D48',
    icon        TEXT    DEFAULT 'card',           -- 'card' | 'bank' | 'cash'
    active      BOOLEAN DEFAULT true,
    created_at  TIMESTAMPTZ DEFAULT now(),
    UNIQUE(user_id, name)
);

ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own accounts" ON public.accounts FOR ALL USING (auth.uid() = user_id);

-- ─────────────────────────────────────────────────────────────
-- 2. AGREGAR account_id A months
-- ─────────────────────────────────────────────────────────────
ALTER TABLE public.months
    ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES public.accounts(id) ON DELETE CASCADE;

-- ─────────────────────────────────────────────────────────────
-- 3. MIGRAR DATOS EXISTENTES
--    Crear cuentas por defecto para cada usuario que ya tiene datos
-- ─────────────────────────────────────────────────────────────

-- 3a. Cuenta "Santander TC" para usuarios con meses TC (o sin source_type)
INSERT INTO public.accounts (user_id, name, bank, type, color, icon)
SELECT DISTINCT user_id, 'Santander TC', 'santander', 'tc', '#E11D48', 'card'
FROM public.months
WHERE source_type = 'tc' OR source_type IS NULL
ON CONFLICT (user_id, name) DO NOTHING;

-- 3b. Cuenta "Santander CC" para usuarios con meses CC
INSERT INTO public.accounts (user_id, name, bank, type, color, icon)
SELECT DISTINCT user_id, 'Santander CC', 'santander', 'cc', '#0891B2', 'bank'
FROM public.months
WHERE source_type = 'cc'
ON CONFLICT (user_id, name) DO NOTHING;

-- 3c. Vincular months TC a su cuenta "Santander TC"
UPDATE public.months m
SET account_id = a.id
FROM public.accounts a
WHERE m.user_id = a.user_id
  AND a.name = 'Santander TC'
  AND (m.source_type = 'tc' OR m.source_type IS NULL)
  AND m.account_id IS NULL;

-- 3d. Vincular months CC a su cuenta "Santander CC"
UPDATE public.months m
SET account_id = a.id
FROM public.accounts a
WHERE m.user_id = a.user_id
  AND a.name = 'Santander CC'
  AND m.source_type = 'cc'
  AND m.account_id IS NULL;

-- ─────────────────────────────────────────────────────────────
-- 4. CAMBIAR LA RESTRICCIÓN UNIQUE DE months
--    De: (user_id, periodo)  →  A: (account_id, periodo)
-- ─────────────────────────────────────────────────────────────
ALTER TABLE public.months
    DROP CONSTRAINT IF EXISTS months_user_id_periodo_key;

-- Antes de crear la nueva constraint, verificar que no haya duplicados
-- (account_id, periodo) que bloqueen la operación.
-- Si ya existen datos limpios, esto procederá sin error.
ALTER TABLE public.months
    ADD CONSTRAINT months_account_id_periodo_key UNIQUE (account_id, periodo);

-- ─────────────────────────────────────────────────────────────
-- 5. AGREGAR transaction_type A transactions
-- ─────────────────────────────────────────────────────────────
ALTER TABLE public.transactions
    ADD COLUMN IF NOT EXISTS transaction_type TEXT DEFAULT 'expense';

-- Backfill: mapear tipo → transaction_type
UPDATE public.transactions
SET transaction_type = CASE
    WHEN tipo = 'abono'       THEN 'income'
    WHEN tipo = 'traspaso_tc' THEN 'transfer'
    WHEN categoria = 'traspaso_tc' THEN 'transfer'
    ELSE 'expense'
END
WHERE transaction_type = 'expense' OR transaction_type IS NULL;

-- ─────────────────────────────────────────────────────────────
-- 6. VERIFICACIÓN — debe retornar cero errores
-- ─────────────────────────────────────────────────────────────
-- Months sin account_id (deberían ser 0 si la migración fue exitosa):
SELECT COUNT(*) AS months_sin_account FROM public.months WHERE account_id IS NULL;

-- Cuentas creadas:
SELECT user_id, name, type FROM public.accounts ORDER BY user_id, name;
