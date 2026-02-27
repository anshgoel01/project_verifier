
-- Performance indexes on submissions
CREATE INDEX IF NOT EXISTS idx_submissions_user_id ON public.submissions (user_id);
CREATE INDEX IF NOT EXISTS idx_submissions_user_status ON public.submissions (user_id, status);
CREATE INDEX IF NOT EXISTS idx_submissions_college_id ON public.submissions (college_id);
CREATE INDEX IF NOT EXISTS idx_submissions_status ON public.submissions (status);
CREATE INDEX IF NOT EXISTS idx_submissions_created_at ON public.submissions (created_at DESC);

-- pg_trgm extension + GIN index on colleges.name for search
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS idx_colleges_name_trgm ON public.colleges USING GIN (lower(name) gin_trgm_ops);

-- Remove user self-delete policy on submissions
DROP POLICY IF EXISTS "Users can delete their own submissions" ON public.submissions;

-- Add UPDATE policy for admins on submissions (needed for verify-submission edge function)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'submissions' AND policyname = 'Admins can update any submission'
  ) THEN
    CREATE POLICY "Admins can update any submission"
    ON public.submissions
    FOR UPDATE
    USING (public.is_admin(auth.uid()));
  END IF;
END $$;
