
-- Create projects table to track unique Coursera courses with weights
CREATE TABLE public.projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  coursera_level text NOT NULL DEFAULT 'beginner' CHECK (coursera_level IN ('beginner', 'intermediate', 'advanced')),
  weight numeric(2,1) NOT NULL DEFAULT 0.5 CHECK (weight >= 0.1 AND weight <= 1.0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Create level defaults table
CREATE TABLE public.project_level_defaults (
  level text PRIMARY KEY CHECK (level IN ('beginner', 'intermediate', 'advanced')),
  default_weight numeric(2,1) NOT NULL DEFAULT 0.5 CHECK (default_weight >= 0.1 AND default_weight <= 1.0)
);

-- Seed level defaults
INSERT INTO public.project_level_defaults (level, default_weight) VALUES
  ('beginner', 0.3),
  ('intermediate', 0.6),
  ('advanced', 1.0);

-- Enable RLS
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_level_defaults ENABLE ROW LEVEL SECURITY;

-- Projects: everyone can read, admins can update
CREATE POLICY "Projects viewable by everyone" ON public.projects FOR SELECT USING (true);
CREATE POLICY "Admins can insert projects" ON public.projects FOR INSERT WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "Admins can update projects" ON public.projects FOR UPDATE USING (public.is_admin(auth.uid()));
CREATE POLICY "Admins can delete projects" ON public.projects FOR DELETE USING (public.is_admin(auth.uid()));

-- Level defaults: everyone can read, admins can update
CREATE POLICY "Level defaults viewable by everyone" ON public.project_level_defaults FOR SELECT USING (true);
CREATE POLICY "Admins can update level defaults" ON public.project_level_defaults FOR UPDATE USING (public.is_admin(auth.uid()));

-- Trigger for updated_at
CREATE TRIGGER update_projects_updated_at
  BEFORE UPDATE ON public.projects
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Populate projects from existing submissions
INSERT INTO public.projects (name, coursera_level, weight)
SELECT DISTINCT coursera_course, 'beginner', 0.3
FROM public.submissions
WHERE coursera_course IS NOT NULL AND coursera_course != ''
ON CONFLICT (name) DO NOTHING;

-- Enable realtime for projects
ALTER PUBLICATION supabase_realtime ADD TABLE public.projects;
ALTER PUBLICATION supabase_realtime ADD TABLE public.project_level_defaults;
