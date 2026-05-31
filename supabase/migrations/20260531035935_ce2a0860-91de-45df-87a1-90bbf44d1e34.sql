DROP POLICY IF EXISTS "Users manage own matches" ON public.matches;

CREATE POLICY "Users can view own matches"
ON public.matches
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

REVOKE INSERT, UPDATE, DELETE ON public.matches FROM authenticated;
GRANT SELECT ON public.matches TO authenticated;
GRANT ALL ON public.matches TO service_role;