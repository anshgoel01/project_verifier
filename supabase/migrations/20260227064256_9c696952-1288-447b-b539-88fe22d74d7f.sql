
-- Trigger function to update profile stats when submissions change
CREATE OR REPLACE FUNCTION public.update_profile_stats()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  target_user_id uuid;
BEGIN
  -- Determine the user_id based on operation
  IF TG_OP = 'DELETE' THEN
    target_user_id := OLD.user_id;
  ELSE
    target_user_id := NEW.user_id;
  END IF;

  -- Update the profile with counts from submissions
  UPDATE public.profiles
  SET
    total_submissions = (SELECT COUNT(*) FROM public.submissions WHERE user_id = target_user_id),
    correct_submissions = (SELECT COUNT(*) FROM public.submissions WHERE user_id = target_user_id AND status = 'correct'),
    score = (SELECT COUNT(*) FROM public.submissions WHERE user_id = target_user_id AND status = 'correct'),
    updated_at = now()
  WHERE user_id = target_user_id;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$;

-- Create trigger on submissions table
DROP TRIGGER IF EXISTS update_profile_stats_trigger ON public.submissions;
CREATE TRIGGER update_profile_stats_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.submissions
FOR EACH ROW
EXECUTE FUNCTION public.update_profile_stats();

-- Performance indexes on submissions
CREATE INDEX IF NOT EXISTS idx_submissions_user_id ON public.submissions(user_id);
CREATE INDEX IF NOT EXISTS idx_submissions_user_status ON public.submissions(user_id, status);
CREATE INDEX IF NOT EXISTS idx_submissions_college_id ON public.submissions(college_id);
CREATE INDEX IF NOT EXISTS idx_submissions_status ON public.submissions(status);
CREATE INDEX IF NOT EXISTS idx_submissions_created_at ON public.submissions(created_at DESC);

-- Backfill existing profile stats from current submissions
UPDATE public.profiles p
SET
  total_submissions = COALESCE(s.total, 0),
  correct_submissions = COALESCE(s.correct, 0),
  score = COALESCE(s.correct, 0),
  updated_at = now()
FROM (
  SELECT 
    user_id,
    COUNT(*) as total,
    COUNT(*) FILTER (WHERE status = 'correct') as correct
  FROM public.submissions
  GROUP BY user_id
) s
WHERE p.user_id = s.user_id;
