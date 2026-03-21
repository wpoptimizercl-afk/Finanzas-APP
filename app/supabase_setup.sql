-- Scheme setup for "Mis Finanzas"

-- 1. Create tables
CREATE TABLE IF NOT EXISTS public.months (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users NOT NULL,
  periodo text NOT NULL,
  periodo_desde text,
  periodo_hasta text,
  total_cargos numeric DEFAULT 0,
  categorias jsonb DEFAULT '{}'::jsonb,
  cuotas_vigentes jsonb DEFAULT '[]'::jsonb,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(user_id, periodo)
);

CREATE TABLE IF NOT EXISTS public.transactions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  month_id uuid REFERENCES public.months ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES auth.users NOT NULL,
  fecha text NOT NULL,
  descripcion text NOT NULL,
  monto numeric NOT NULL,
  tipo text DEFAULT 'cargo',
  categoria text DEFAULT 'otros',
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.fixed_expenses (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users NOT NULL,
  periodo text NOT NULL,
  name text NOT NULL,
  amount numeric NOT NULL,
  source text DEFAULT 'fijo',
  recurring boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.income (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users NOT NULL,
  periodo text NOT NULL,
  amount numeric NOT NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(user_id, periodo)
);

CREATE TABLE IF NOT EXISTS public.extra_income (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users NOT NULL,
  periodo text NOT NULL,
  name text NOT NULL,
  amount numeric NOT NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.budgets (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users NOT NULL UNIQUE,
  income numeric DEFAULT 0,
  "savingsGoal" numeric DEFAULT 0,
  categories jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.category_rules (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users NOT NULL,
  description_key text NOT NULL,
  categoria text NOT NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(user_id, description_key)
);

CREATE TABLE IF NOT EXISTS public.custom_categories (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users NOT NULL,
  cat_id text NOT NULL,
  label text NOT NULL,
  color text NOT NULL,
  bg text NOT NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(user_id, cat_id)
);

-- 2. Enable Row Level Security (RLS)
ALTER TABLE public.months ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fixed_expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.income ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.extra_income ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.category_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.custom_categories ENABLE ROW LEVEL SECURITY;

-- 3. Create RLS Policies
-- Users can only access and modify their own data

-- months
CREATE POLICY "Users can fully manage their own months"
ON public.months FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- transactions
CREATE POLICY "Users can fully manage their own transactions"
ON public.transactions FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- fixed_expenses
CREATE POLICY "Users can fully manage their own fixed_expenses"
ON public.fixed_expenses FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- income
CREATE POLICY "Users can fully manage their own income"
ON public.income FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- extra_income
CREATE POLICY "Users can fully manage their own extra_income"
ON public.extra_income FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- budgets
CREATE POLICY "Users can fully manage their own budgets"
ON public.budgets FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- category_rules
CREATE POLICY "Users can fully manage their own rules"
ON public.category_rules FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- custom_categories
CREATE POLICY "Users can fully manage their own custom_categories"
ON public.custom_categories FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
