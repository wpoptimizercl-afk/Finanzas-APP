-- SQL Script to initialize Supabase Database for 'Mis Finanzas'

-- 1. Create Tables
CREATE TABLE IF NOT EXISTS public.months (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id),
    periodo TEXT NOT NULL,
    periodo_desde TEXT,
    periodo_hasta TEXT,
    total_cargos NUMERIC DEFAULT 0,
    categorias JSONB DEFAULT '{}'::jsonb,
    cuotas_vigentes JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id),
    month_id UUID REFERENCES public.months(id) ON DELETE CASCADE,
    fecha TEXT,
    descripcion TEXT,
    monto NUMERIC,
    categoria TEXT,
    tipo TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.fixed_expenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id),
    periodo TEXT NOT NULL,
    description TEXT,
    amount NUMERIC,
    categoria TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.income (
    user_id UUID NOT NULL DEFAULT auth.uid(),
    periodo TEXT NOT NULL,
    amount NUMERIC DEFAULT 0,
    PRIMARY KEY (user_id, periodo)
);

CREATE TABLE IF NOT EXISTS public.extra_income (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id),
    periodo TEXT NOT NULL,
    description TEXT,
    amount NUMERIC,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.budgets (
    user_id UUID PRIMARY KEY DEFAULT auth.uid(),
    income NUMERIC DEFAULT 0,
    "savingsGoal" NUMERIC DEFAULT 0,
    categories JSONB DEFAULT '{}'::jsonb,
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.category_rules (
    user_id UUID NOT NULL DEFAULT auth.uid(),
    description_key TEXT NOT NULL,
    categoria TEXT NOT NULL,
    PRIMARY KEY (user_id, description_key)
);

CREATE TABLE IF NOT EXISTS public.custom_categories (
    user_id UUID NOT NULL DEFAULT auth.uid(),
    cat_id TEXT NOT NULL,
    label TEXT,
    color TEXT,
    bg TEXT,
    PRIMARY KEY (user_id, cat_id)
);

-- 2. Enable RLS
ALTER TABLE public.months ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fixed_expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.income ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.extra_income ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.category_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.custom_categories ENABLE ROW LEVEL SECURITY;

-- 3. Create RLS Policies
CREATE POLICY "Own months" ON public.months FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Own transactions" ON public.transactions FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Own fixed_expenses" ON public.fixed_expenses FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Own income" ON public.income FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Own extra_income" ON public.extra_income FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Own budgets" ON public.budgets FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Own category_rules" ON public.category_rules FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Own custom_categories" ON public.custom_categories FOR ALL USING (auth.uid() = user_id);
