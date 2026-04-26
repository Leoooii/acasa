-- =============================================================================
-- acasa — schema initiala MVP
-- Aplica in Supabase SQL Editor:
--   https://supabase.com/dashboard/project/mkwjhvvskcuhtidwifjv/sql/new
-- =============================================================================

create extension if not exists pgcrypto;

-- =============================================================================
-- TABELE
-- =============================================================================

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (length(display_name) between 1 and 60),
  avatar_url text,
  locale text not null default 'ro',
  created_at timestamptz not null default now()
);

create table public.spaces (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(name) between 1 and 80),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now()
);

create table public.space_members (
  space_id uuid not null references public.spaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('admin', 'member')),
  joined_at timestamptz not null default now(),
  primary key (space_id, user_id)
);
create index space_members_user_id_idx on public.space_members(user_id);

create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.spaces(id) on delete cascade,
  code text not null unique check (length(code) = 6),
  created_by uuid not null references auth.users(id) on delete cascade default auth.uid(),
  expires_at timestamptz not null default (now() + interval '7 days'),
  used_by uuid references auth.users(id),
  used_at timestamptz,
  created_at timestamptz not null default now()
);
create index invitations_space_id_idx on public.invitations(space_id);

create table public.posts (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.spaces(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  type text not null check (type in ('announcement', 'question', 'poll')),
  title text not null check (length(title) between 1 and 140),
  body text,
  payload jsonb,
  created_at timestamptz not null default now(),
  edited_at timestamptz
);
create index posts_space_created_idx on public.posts(space_id, created_at desc);

create table public.reactions (
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  emoji text not null check (length(emoji) between 1 and 8),
  created_at timestamptz not null default now(),
  primary key (post_id, user_id, emoji)
);

create table public.poll_votes (
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  option_index int not null check (option_index >= 0),
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

create table public.clothing_items (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.spaces(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  name text not null check (length(name) between 1 and 80),
  photo_path text,
  category text,
  size text,
  color text,
  season text,
  pair_count int not null default 1 check (pair_count between 1 and 99),
  created_at timestamptz not null default now()
);
create index clothing_items_owner_space_idx on public.clothing_items(owner_id, space_id);

create table public.appliance_sessions (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.spaces(id) on delete cascade,
  appliance text not null default 'washer' check (appliance in ('washer')),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  started_at timestamptz not null default now(),
  ends_at timestamptz not null,
  finished boolean not null default false
);
create index appliance_active_idx on public.appliance_sessions(space_id) where finished = false;

create table public.home_resources (
  space_id uuid not null references public.spaces(id) on delete cascade,
  kind text not null check (kind in ('wifi')),
  data jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by uuid not null references auth.users(id) on delete restrict default auth.uid(),
  primary key (space_id, kind)
);

-- =============================================================================
-- HELPER
-- =============================================================================

create or replace function public.is_space_member(p_space_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.space_members
    where space_id = p_space_id and user_id = auth.uid()
  );
$$;

-- =============================================================================
-- RLS
-- =============================================================================

alter table public.profiles enable row level security;
alter table public.spaces enable row level security;
alter table public.space_members enable row level security;
alter table public.invitations enable row level security;
alter table public.posts enable row level security;
alter table public.reactions enable row level security;
alter table public.poll_votes enable row level security;
alter table public.clothing_items enable row level security;
alter table public.appliance_sessions enable row level security;
alter table public.home_resources enable row level security;

-- profiles: vad pe ai mei + co-membri
create policy profiles_select on public.profiles for select using (
  id = auth.uid()
  or exists (
    select 1
    from public.space_members me
    join public.space_members other on other.space_id = me.space_id
    where me.user_id = auth.uid() and other.user_id = profiles.id
  )
);
create policy profiles_insert on public.profiles for insert with check (id = auth.uid());
create policy profiles_update on public.profiles for update using (id = auth.uid());

-- spaces: select pt membri; create via RPC; update doar admin
create policy spaces_select on public.spaces for select
  using (public.is_space_member(id));
create policy spaces_update on public.spaces for update using (
  exists (
    select 1 from public.space_members
    where space_id = spaces.id and user_id = auth.uid() and role = 'admin'
  )
);

-- space_members: select co-membri; insert via RPC redeem_invitation
create policy space_members_select on public.space_members for select
  using (public.is_space_member(space_id));
create policy space_members_delete_self on public.space_members for delete
  using (user_id = auth.uid());

-- invitations: select/insert/delete pt membri
create policy invitations_select on public.invitations for select
  using (public.is_space_member(space_id));
create policy invitations_insert on public.invitations for insert with check (
  public.is_space_member(space_id) and created_by = auth.uid()
);
create policy invitations_delete on public.invitations for delete
  using (public.is_space_member(space_id));

-- posts
create policy posts_select on public.posts for select
  using (public.is_space_member(space_id));
create policy posts_insert on public.posts for insert with check (
  public.is_space_member(space_id) and author_id = auth.uid()
);
create policy posts_update on public.posts for update using (author_id = auth.uid());
create policy posts_delete on public.posts for delete using (author_id = auth.uid());

-- reactions
create policy reactions_select on public.reactions for select using (
  exists (select 1 from public.posts p where p.id = reactions.post_id and public.is_space_member(p.space_id))
);
create policy reactions_insert on public.reactions for insert with check (
  user_id = auth.uid()
  and exists (select 1 from public.posts p where p.id = post_id and public.is_space_member(p.space_id))
);
create policy reactions_delete on public.reactions for delete using (user_id = auth.uid());

-- poll_votes
create policy poll_votes_select on public.poll_votes for select using (
  exists (select 1 from public.posts p where p.id = poll_votes.post_id and public.is_space_member(p.space_id))
);
create policy poll_votes_insert on public.poll_votes for insert with check (
  user_id = auth.uid()
  and exists (
    select 1 from public.posts p
    where p.id = post_id and p.type = 'poll' and public.is_space_member(p.space_id)
  )
);
create policy poll_votes_update on public.poll_votes for update using (user_id = auth.uid());
create policy poll_votes_delete on public.poll_votes for delete using (user_id = auth.uid());

-- clothing_items: doar owner
create policy clothing_select on public.clothing_items for select using (owner_id = auth.uid());
create policy clothing_insert on public.clothing_items for insert with check (
  owner_id = auth.uid() and public.is_space_member(space_id)
);
create policy clothing_update on public.clothing_items for update using (owner_id = auth.uid());
create policy clothing_delete on public.clothing_items for delete using (owner_id = auth.uid());

-- appliance_sessions
create policy appliance_select on public.appliance_sessions for select
  using (public.is_space_member(space_id));
create policy appliance_insert on public.appliance_sessions for insert with check (
  user_id = auth.uid() and public.is_space_member(space_id)
);
create policy appliance_update on public.appliance_sessions for update using (user_id = auth.uid());

-- home_resources
create policy home_select on public.home_resources for select
  using (public.is_space_member(space_id));
create policy home_insert on public.home_resources for insert with check (
  public.is_space_member(space_id) and updated_by = auth.uid()
);
create policy home_update on public.home_resources for update
  using (public.is_space_member(space_id))
  with check (updated_by = auth.uid());

-- =============================================================================
-- RPC
-- =============================================================================

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
  return v_space_id;
end;
$$;
revoke all on function public.create_space_with_owner(text) from public;
grant execute on function public.create_space_with_owner(text) to authenticated;

create or replace function public.redeem_invitation(p_code text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invite public.invitations%rowtype;
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then raise exception 'not_authenticated'; end if;
  select * into v_invite from public.invitations where code = upper(p_code);
  if not found then raise exception 'invalid_code'; end if;
  if v_invite.used_at is not null then raise exception 'already_used'; end if;
  if v_invite.expires_at < now() then raise exception 'expired'; end if;
  insert into public.space_members (space_id, user_id, role)
    values (v_invite.space_id, v_user_id, 'member')
    on conflict do nothing;
  update public.invitations set used_by = v_user_id, used_at = now() where id = v_invite.id;
  return v_invite.space_id;
end;
$$;
revoke all on function public.redeem_invitation(text) from public;
grant execute on function public.redeem_invitation(text) to authenticated;

-- =============================================================================
-- TRIGGER: auto-create profile la signup
-- =============================================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, locale)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data->>'locale', 'ro')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- =============================================================================
-- STORAGE
-- =============================================================================

insert into storage.buckets (id, name, public)
  values ('avatars', 'avatars', true)
  on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
  values ('closets', 'closets', false)
  on conflict (id) do nothing;

create policy avatars_read on storage.objects for select using (bucket_id = 'avatars');
create policy avatars_write on storage.objects for insert with check (
  bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1]
);
create policy avatars_update on storage.objects for update using (
  bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1]
);

create policy closets_read on storage.objects for select using (
  bucket_id = 'closets' and auth.uid()::text = (storage.foldername(name))[1]
);
create policy closets_write on storage.objects for insert with check (
  bucket_id = 'closets' and auth.uid()::text = (storage.foldername(name))[1]
);
create policy closets_update on storage.objects for update using (
  bucket_id = 'closets' and auth.uid()::text = (storage.foldername(name))[1]
);

-- =============================================================================
-- REALTIME
-- =============================================================================

alter publication supabase_realtime add table public.posts;
alter publication supabase_realtime add table public.reactions;
alter publication supabase_realtime add table public.poll_votes;
alter publication supabase_realtime add table public.appliance_sessions;
alter publication supabase_realtime add table public.home_resources;
