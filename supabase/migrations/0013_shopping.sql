-- =============================================================================
-- 0013: Lista de cumparaturi partajata per spatiu
-- =============================================================================

create table public.shopping_items (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.spaces(id) on delete cascade,
  name text not null check (length(name) between 1 and 80),
  quantity text,
  category text,
  is_done boolean not null default false,
  added_by uuid not null references public.profiles(id) on delete set null default auth.uid(),
  done_by uuid references public.profiles(id) on delete set null,
  done_at timestamptz,
  created_at timestamptz not null default now()
);

create index shopping_items_space_idx on public.shopping_items(space_id, is_done, created_at desc);

alter table public.shopping_items enable row level security;

create policy shopping_select on public.shopping_items for select
  using (public.is_space_member(space_id));
create policy shopping_insert on public.shopping_items for insert
  with check (public.is_space_member(space_id));
create policy shopping_update on public.shopping_items for update
  using (public.is_space_member(space_id))
  with check (public.is_space_member(space_id));
create policy shopping_delete on public.shopping_items for delete
  using (public.is_space_member(space_id));

-- Trigger: cand bifezi ca done, salveaza cine si cand
create or replace function public.set_shopping_done_meta()
returns trigger
language plpgsql
as $$
begin
  if new.is_done is true and (old.is_done is null or old.is_done is false) then
    new.done_at := coalesce(new.done_at, now());
    new.done_by := coalesce(new.done_by, auth.uid());
  elsif new.is_done is false and old.is_done is true then
    new.done_at := null;
    new.done_by := null;
  end if;
  return new;
end;
$$;

drop trigger if exists shopping_done_meta on public.shopping_items;
create trigger shopping_done_meta
  before update on public.shopping_items
  for each row execute function public.set_shopping_done_meta();

-- Realtime
alter publication supabase_realtime add table public.shopping_items;

notify pgrst, 'reload schema';
