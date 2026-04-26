-- Schimba FK-ul lui space_members.user_id ca sa pointeze direct la public.profiles(id),
-- ca PostgREST sa poata face embed: space_members.select("..., profiles!inner(...)").

alter table public.space_members
  drop constraint if exists space_members_user_id_fkey;

alter table public.space_members
  add constraint space_members_user_id_fkey
    foreign key (user_id) references public.profiles(id) on delete cascade;

notify pgrst, 'reload schema';
