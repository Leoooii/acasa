-- =============================================================================
-- 0008: Aparate generice (washer, dryer, oven, etc.) per spatiu
--       Migram session-urile existente catre noul model.
-- =============================================================================

-- 1) Tabelul appliances
create table public.appliances (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.spaces(id) on delete cascade,
  name text not null check (length(name) between 1 and 60),
  kind text not null check (kind in (
    'washer', 'dryer', 'oven', 'microwave', 'dishwasher',
    'coffee', 'iron', 'other'
  )),
  default_duration_minutes int not null default 90 check (default_duration_minutes between 1 and 1440),
  created_at timestamptz not null default now()
);

create index appliances_space_id_idx on public.appliances(space_id);

alter table public.appliances enable row level security;

create policy appliances_select on public.appliances for select
  using (public.is_space_member(space_id));
create policy appliances_insert on public.appliances for insert
  with check (public.is_space_member(space_id));
create policy appliances_update on public.appliances for update
  using (public.is_space_member(space_id))
  with check (public.is_space_member(space_id));
create policy appliances_delete on public.appliances for delete
  using (public.is_space_member(space_id));

-- 2) Backfill: fiecare spatiu primeste un washer default
insert into public.appliances (space_id, name, kind, default_duration_minutes)
select id, 'Mașina de spălat', 'washer', 90 from public.spaces;

-- 3) appliance_sessions: adauga appliance_id si fa-l NOT NULL dupa backfill
alter table public.appliance_sessions
  add column if not exists appliance_id uuid references public.appliances(id) on delete cascade;

update public.appliance_sessions s
set appliance_id = a.id
from public.appliances a
where a.space_id = s.space_id and a.kind = 'washer' and s.appliance_id is null;

alter table public.appliance_sessions alter column appliance_id set not null;

-- 4) Indexare
drop index if exists appliance_active_idx;
create index appliance_active_idx on public.appliance_sessions(space_id, appliance_id) where finished = false;
create index appliance_sessions_started_idx on public.appliance_sessions(appliance_id, started_at desc);

-- 5) Drop old `appliance` text column (datele acum sunt in appliances.kind)
alter table public.appliance_sessions drop column if exists appliance;

-- 6) Realtime pentru noul tabel
alter publication supabase_realtime add table public.appliances;

-- 7) RPC create_space_with_owner: creeaza si default washer
create or replace function public.create_space_with_owner(p_name text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_space_id uuid;
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then raise exception 'not_authenticated'; end if;
  insert into public.spaces (name, created_by) values (p_name, v_user_id) returning id into v_space_id;
  insert into public.space_members (space_id, user_id, role) values (v_space_id, v_user_id, 'admin');
  insert into public.appliances (space_id, name, kind, default_duration_minutes)
    values (v_space_id, 'Mașina de spălat', 'washer', 90);
  return v_space_id;
end;
$$;

-- 8) Push notification function pentru aparate generice
drop function if exists public.notify_expired_washers();

create or replace function public.notify_expired_appliances()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  s record;
  tok record;
  body text;
begin
  for s in
    select sess.id, sess.space_id, sess.user_id, sess.appliance_id, sess.ends_at,
           coalesce(p.display_name, 'Cineva') as starter_name,
           ap.name as appliance_name,
           ap.kind as appliance_kind
    from public.appliance_sessions sess
    join public.appliances ap on ap.id = sess.appliance_id
    left join public.profiles p on p.id = sess.user_id
    where sess.finished = false
      and sess.notified_at is null
      and sess.ends_at < now()
  loop
    for tok in
      select dt.token, dt.user_id
      from public.device_tokens dt
      join public.space_members sm on sm.user_id = dt.user_id
      where sm.space_id = s.space_id
    loop
      body := case
        when tok.user_id = s.user_id then s.appliance_name || ': sesiunea ta s-a încheiat.'
        else s.starter_name || ' a terminat: ' || s.appliance_name
      end;
      perform net.http_post(
        url := 'https://exp.host/--/api/v2/push/send',
        body := jsonb_build_object(
          'to', tok.token,
          'title', s.appliance_name || ' e gata',
          'body', body,
          'sound', 'default',
          'channelId', 'appliances',
          'data', jsonb_build_object(
            'type', 'appliance_done',
            'session_id', s.id,
            'space_id', s.space_id,
            'appliance_id', s.appliance_id
          )
        ),
        headers := jsonb_build_object('Content-Type', 'application/json', 'Accept', 'application/json')
      );
    end loop;
    update public.appliance_sessions set notified_at = now() where id = s.id;
  end loop;
end;
$$;

revoke all on function public.notify_expired_appliances() from public;

-- 9) Reschedule cron
do $$ begin perform cron.unschedule('notify-expired-washers'); exception when others then null; end $$;
do $$ begin perform cron.unschedule('notify-expired-appliances'); exception when others then null; end $$;
select cron.schedule(
  'notify-expired-appliances',
  '* * * * *',
  $cmd$select public.notify_expired_appliances();$cmd$
);

notify pgrst, 'reload schema';
