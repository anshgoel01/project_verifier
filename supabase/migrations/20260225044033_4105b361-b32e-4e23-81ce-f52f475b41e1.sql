
-- Fix all RLS policies: change from RESTRICTIVE to PERMISSIVE

-- profiles
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON public.profiles;
CREATE POLICY "Profiles are viewable by everyone" ON public.profiles FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
CREATE POLICY "Users can insert their own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);

-- submissions
DROP POLICY IF EXISTS "Users can view their own submissions" ON public.submissions;
CREATE POLICY "Users can view their own submissions" ON public.submissions FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own submissions" ON public.submissions;
CREATE POLICY "Users can insert their own submissions" ON public.submissions FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own submissions" ON public.submissions;
CREATE POLICY "Users can delete their own submissions" ON public.submissions FOR DELETE USING (auth.uid() = user_id);

-- user_roles
DROP POLICY IF EXISTS "User roles are viewable by authenticated users" ON public.user_roles;
CREATE POLICY "User roles are viewable by authenticated users" ON public.user_roles FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Admins can insert user roles" ON public.user_roles;
CREATE POLICY "Admins can insert user roles" ON public.user_roles FOR INSERT TO authenticated WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins can delete user roles" ON public.user_roles;
CREATE POLICY "Admins can delete user roles" ON public.user_roles FOR DELETE TO authenticated USING (public.is_admin(auth.uid()));

-- admin_requests
DROP POLICY IF EXISTS "Admin requests viewable by authenticated users" ON public.admin_requests;
CREATE POLICY "Admin requests viewable by authenticated users" ON public.admin_requests FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Users can insert admin requests" ON public.admin_requests;
CREATE POLICY "Users can insert admin requests" ON public.admin_requests FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admin requests can be updated by authenticated users" ON public.admin_requests;
CREATE POLICY "Admin requests can be updated by admins" ON public.admin_requests FOR UPDATE TO authenticated USING (public.is_admin(auth.uid()));

-- colleges
DROP POLICY IF EXISTS "Colleges are viewable by everyone" ON public.colleges;
CREATE POLICY "Colleges are viewable by everyone" ON public.colleges FOR SELECT USING (true);
