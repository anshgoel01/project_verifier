
-- Allow admins to view all submissions
CREATE POLICY "Admins can view all submissions"
ON public.submissions
FOR SELECT
USING (public.is_admin(auth.uid()));

-- Allow admins to delete any submission
CREATE POLICY "Admins can delete any submission"
ON public.submissions
FOR DELETE
USING (public.is_admin(auth.uid()));
