
-- Recreate trigger (function already exists)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Manually create profile for existing user
INSERT INTO public.profiles (user_id, full_name, email, college_id, roll_no)
SELECT 
  id,
  COALESCE(raw_user_meta_data->>'full_name', ''),
  email,
  COALESCE((raw_user_meta_data->>'college_id')::uuid, 'd8958a90-d06a-467e-818d-64277f84f5c3'::uuid),
  COALESCE(raw_user_meta_data->>'roll_no', '')
FROM auth.users
WHERE id = 'b4ca79b1-a43c-4211-b662-7552d2d438eb'
ON CONFLICT DO NOTHING;

-- Make this user an admin
INSERT INTO public.user_roles (user_id, role)
VALUES ('b4ca79b1-a43c-4211-b662-7552d2d438eb', 'admin')
ON CONFLICT DO NOTHING;
