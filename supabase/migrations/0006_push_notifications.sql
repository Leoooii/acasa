-- =============================================================================
-- 0006: Push notifications cand expira washer-ul
--
-- Strategy: zero Edge Functions deploy. Folosim pg_net (HTTP din Postgres)
-- + pg_cron (scheduler) ca sa apelam direct Expo Push API la fiecare minut.
-- =============================================================================

-- 1) Device tokens (per user)
create table public.device_tokens (
  user_id uuid not null references public.profiles(id) on delete cascade,
  token text not null,
  platform text not null default 'expo' check (platform in ('expo')),
  updated_at timestamptz not null default now(),
  primary key (user_id, token)
);

alter table public.device_tokens enable row level security;

create policy device_tokens_select on public.device_tokens for select
  using (user_id = auth.uid());
create policy device_tokens_insert on public.device_tokens for insert
  with check (user_id = auth.uid());
create policy device_tokens_update on public.device_tokens for update
  using (user_id = auth.uid());
create policy device_tokens_delete on public.device_tokens for delete
  using (user_id = auth.uid());

-- 2) Idempotency pentru notificari (sa nu trimitem push de mai multe ori)
alter table public.appliance_sessions
  add column if not exists notified_at timestamptz;

-- 3) Extensii pentru cron + HTTP
create extension if not exists pg_net;
create extension if not exists pg_cron;

-- 4) Functia care trimite push pentru sesiuni expirate
create or replace function public.notify_expired_washers()
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
    select a.id, a.space_id, a.user_id, a.ends_at,
           coalesce(p.display_name, 'Cineva') as starter_name
    from public.appliance_sessions a
    left join public.profiles p on p.id = a.user_id
    where a.appliance = 'washer'
      and a.finished = false
      and a.notified_at is null
      and a.ends_at < now()
  loop
    for tok in
      select dt.token, dt.user_id
      from public.device_tokens dt
      join public.space_members sm on sm.user_id = dt.user_id
      where sm.space_id = s.space_id
    loop
      body := case
        when tok.user_id = s.user_id then 'Hainele tale sunt gata.'
        else s.starter_name || ' a terminat spălatul.'
      end;
      perform net.http_post(
        url := 'https://exp.host/--/api/v2/push/send',
        body := jsonb_build_object(
          'to', tok.token,
          'title', 'Mașina de spălat e gata',
          'body', body,
          'sound', 'default',
          'channelId', 'washer',
          'data', jsonb_build_object('type', 'washer_done', 'session_id', s.id, 'space_id', s.space_id)
        ),
        headers := jsonb_build_object('Content-Type', 'application/json', 'Accept', 'application/json')
      );
    end loop;
    update public.appliance_sessions set notified_at = now() where id = s.id;
  end loop;
end;
$$;

revoke all on function public.notify_expired_washers() from public;

-- 5) Cron: la fiecare minut
-- Daca exista deja o programare cu acest nume, o eliminam intai (idempotent)
do $$
begin
  perform cron.unschedule('notify-expired-washers');
exception when others then null;
end $$;

select cron.schedule(
  'notify-expired-washers',
  '* * * * *',
  $cmd$select public.notify_expired_washers();$cmd$
);

notify pgrst, 'reload schema';
