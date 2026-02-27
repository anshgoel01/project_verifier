
-- Drop the index first, then move extension
DROP INDEX IF EXISTS public.idx_colleges_name_trgm;
DROP EXTENSION IF EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS pg_trgm SCHEMA extensions;
CREATE INDEX IF NOT EXISTS idx_colleges_name_trgm ON public.colleges USING GIN (lower(name) extensions.gin_trgm_ops);
