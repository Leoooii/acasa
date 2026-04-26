-- =============================================================================
-- 0010: Status per membru (icon + text scurt) + realtime pe profile
-- =============================================================================

alter table public.profiles
  add column if not exists status_icon text,
  add column if not exists status_text text,
  add column if not exists status_updated_at timestamptz;

-- Activam realtime pe profiles ca sa vedem live cand cineva isi schimba statusul
alter publication supabase_realtime add table public.profiles;

notify pgrst, 'reload schema';
