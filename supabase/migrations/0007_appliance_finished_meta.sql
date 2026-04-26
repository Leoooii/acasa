-- Adauga cine si cand a marcat sesiunea ca finalizata, ca sa afisam in feed
-- "Colected by X" dupa ce washer-ul e oprit.

alter table public.appliance_sessions
  add column if not exists finished_by uuid references public.profiles(id) on delete set null,
  add column if not exists finished_at timestamptz;

create or replace function public.set_finished_metadata()
returns trigger
language plpgsql
as $$
begin
  if new.finished is true and (old.finished is null or old.finished is false) then
    new.finished_at := coalesce(new.finished_at, now());
    new.finished_by := coalesce(new.finished_by, auth.uid());
  end if;
  return new;
end;
$$;

drop trigger if exists appliance_sessions_finished_meta on public.appliance_sessions;
create trigger appliance_sessions_finished_meta
  before update on public.appliance_sessions
  for each row execute function public.set_finished_metadata();

notify pgrst, 'reload schema';
