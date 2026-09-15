CREATE POLICY "No direct visitor access to promises"
ON public.promises
FOR ALL
TO anon, authenticated
USING (false)
WITH CHECK (false);

CREATE POLICY "No direct visitor access to questions"
ON public.questions
FOR ALL
TO anon, authenticated
USING (false)
WITH CHECK (false);

CREATE POLICY "No direct visitor access to activity logs"
ON public.activity_logs
FOR ALL
TO anon, authenticated
USING (false)
WITH CHECK (false);