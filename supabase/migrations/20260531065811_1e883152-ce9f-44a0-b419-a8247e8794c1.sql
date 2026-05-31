
CREATE TABLE public.crawl_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  discovered integer NOT NULL DEFAULT 0,
  attempted integer NOT NULL DEFAULT 0,
  succeeded integer NOT NULL DEFAULT 0,
  failed integer NOT NULL DEFAULT 0,
  errors jsonb NOT NULL DEFAULT '[]'::jsonb,
  triggered_by uuid
);

CREATE INDEX crawl_runs_started_at_idx ON public.crawl_runs (started_at DESC);

GRANT SELECT ON public.crawl_runs TO authenticated;
GRANT ALL ON public.crawl_runs TO service_role;

ALTER TABLE public.crawl_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read crawl runs"
  ON public.crawl_runs FOR SELECT
  TO authenticated
  USING (true);
