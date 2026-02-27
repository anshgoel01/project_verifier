
-- Create enum for app roles
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

-- Create colleges table
CREATE TABLE public.colleges (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create profiles table
CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  college_id UUID NOT NULL REFERENCES public.colleges(id),
  roll_no TEXT,
  score INTEGER NOT NULL DEFAULT 0,
  total_submissions INTEGER NOT NULL DEFAULT 0,
  correct_submissions INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create submissions table
CREATE TABLE public.submissions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  college_id UUID NOT NULL REFERENCES public.colleges(id),
  coursera_link TEXT NOT NULL,
  linkedin_link TEXT NOT NULL,
  coursera_name TEXT,
  linkedin_username TEXT,
  coursera_course TEXT,
  student_match BOOLEAN,
  course_match BOOLEAN,
  status TEXT NOT NULL DEFAULT 'processing',
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create user_roles table
CREATE TABLE public.user_roles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  role public.app_role NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);

-- Create admin_requests table
CREATE TABLE public.admin_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  reviewed_at TIMESTAMP WITH TIME ZONE
);

-- Enable RLS on all tables
ALTER TABLE public.colleges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_requests ENABLE ROW LEVEL SECURITY;

-- Colleges: readable by everyone
CREATE POLICY "Colleges are viewable by everyone" ON public.colleges FOR SELECT USING (true);

-- Profiles: viewable by everyone (for leaderboard), users can insert/update their own
CREATE POLICY "Profiles are viewable by everyone" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can insert their own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);

-- Submissions: users can manage their own, admins via edge functions
CREATE POLICY "Users can view their own submissions" ON public.submissions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own submissions" ON public.submissions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete their own submissions" ON public.submissions FOR DELETE USING (auth.uid() = user_id);

-- User roles: viewable by authenticated users
CREATE POLICY "User roles are viewable by authenticated users" ON public.user_roles FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Admins can insert user roles" ON public.user_roles FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Admins can delete user roles" ON public.user_roles FOR DELETE USING (auth.uid() IS NOT NULL);

-- Admin requests: viewable by authenticated users, users can insert their own
CREATE POLICY "Admin requests viewable by authenticated users" ON public.admin_requests FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Users can insert admin requests" ON public.admin_requests FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admin requests can be updated by authenticated users" ON public.admin_requests FOR UPDATE USING (auth.uid() IS NOT NULL);

-- Create has_role function
CREATE OR REPLACE FUNCTION public.has_role(_role public.app_role, _user_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  );
$$ LANGUAGE sql SECURITY DEFINER SET search_path = public;

-- Create is_admin function
CREATE OR REPLACE FUNCTION public.is_admin(_user_id UUID)
RETURNS BOOLEAN AS $$
  SELECT public.has_role('admin'::public.app_role, _user_id);
$$ LANGUAGE sql SECURITY DEFINER SET search_path = public;

-- Enable realtime for submissions and profiles
ALTER PUBLICATION supabase_realtime ADD TABLE public.submissions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;

-- Insert default college
INSERT INTO public.colleges (id, name) VALUES ('d8958a90-d06a-467e-818d-64277f84f5c3', 'Thapar Institute of Engineering & Technology');

-- Create trigger for updated_at on profiles
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
