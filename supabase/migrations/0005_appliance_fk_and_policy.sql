-- 1) FK appliance_sessions.user_id -> profiles.id pentru embed cu numele celui care a pornit.
alter table public.appliance_sessions
  drop constraint if exists appliance_sessions_user_id_fkey;

alter table public.appliance_sessions
  add constraint appliance_sessions_user_id_fkey
    foreign key (user_id) references public.profiles(id) on delete cascade;

-- 2) Permite oricarui membru al spatiului sa marcheze sesiunea ca finalizata
--    (default era doar cel care a pornit-o, dar in familie e util si invers).
drop policy if exists appliance_update on public.appliance_sessions;
create policy appliance_update on public.appliance_sessions for update
  using (public.is_space_member(space_id))
  with check (public.is_space_member(space_id));

notify pgrst, 'reload schema';
