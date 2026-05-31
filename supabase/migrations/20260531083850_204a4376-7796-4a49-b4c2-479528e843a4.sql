ALTER TABLE public.crawl_runs
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'completed',
  ADD COLUMN IF NOT EXISTS progress_message text,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE public.crawl_runs
  DROP CONSTRAINT IF EXISTS crawl_runs_status_check;
ALTER TABLE public.crawl_runs
  ADD CONSTRAINT crawl_runs_status_check
  CHECK (status IN ('queued','running','completed','cancelled','failed'));

DROP TRIGGER IF EXISTS update_crawl_runs_updated_at ON public.crawl_runs;
CREATE TRIGGER update_crawl_runs_updated_at
  BEFORE UPDATE ON public.crawl_runs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();