CREATE TABLE public.staffing_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  week_start date,
  dow int NOT NULL CHECK (dow BETWEEN 0 AND 6),
  job_role_id uuid NOT NULL REFERENCES public.job_roles(id) ON DELETE CASCADE,
  start_hour int NOT NULL CHECK (start_hour BETWEEN 0 AND 23),
  end_hour int NOT NULL CHECK (end_hour BETWEEN 1 AND 24),
  min_staff int NOT NULL CHECK (min_staff BETWEEN 0 AND 100),
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (end_hour > start_hour)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.staffing_rules TO authenticated;
GRANT ALL ON public.staffing_rules TO service_role;
ALTER TABLE public.staffing_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Managers manage staffing rules" ON public.staffing_rules FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'manager')) WITH CHECK (public.has_role(auth.uid(), 'manager'));