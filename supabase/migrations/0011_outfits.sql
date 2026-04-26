-- =============================================================================
-- 0011: Slot per haina + outfits salvate
-- =============================================================================

-- 1) Slot per item: top / bottom / shoes etc.
alter table public.clothing_items
  add column if not exists slot text check (slot in (
    'top', 'bottom', 'dress', 'outerwear', 'shoes', 'socks',
    'underwear', 'accessory', 'other'
  ));

-- existing rows: lasam null pana cand userul le editeaza explicit
-- (noile randuri pot fi inserate cu slot specific)

-- 2) Outfits (combinatii salvate)
create table public.outfits (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.spaces(id) on delete cascade,
  owner_id uuid not null references public.profiles(id) on delete cascade default auth.uid(),
  name text not null check (length(name) between 1 and 80),
  is_favorite boolean not null default false,
  created_at timestamptz not null default now()
);

create index outfits_owner_idx on public.outfits(owner_id, space_id);

create table public.outfit_items (
  outfit_id uuid not null references public.outfits(id) on delete cascade,
  item_id uuid not null references public.clothing_items(id) on delete cascade,
  slot text,
  position int not null default 0,
  primary key (outfit_id, item_id)
);

create index outfit_items_outfit_idx on public.outfit_items(outfit_id, position);

-- 3) RLS: doar owner-ul vede outfit-urile (ca si itemele)
alter table public.outfits enable row level security;
alter table public.outfit_items enable row level security;

create policy outfits_select on public.outfits for select using (owner_id = auth.uid());
create policy outfits_insert on public.outfits for insert with check (
  owner_id = auth.uid() and public.is_space_member(space_id)
);
create policy outfits_update on public.outfits for update using (owner_id = auth.uid());
create policy outfits_delete on public.outfits for delete using (owner_id = auth.uid());

create policy outfit_items_select on public.outfit_items for select using (
  exists (select 1 from public.outfits o where o.id = outfit_id and o.owner_id = auth.uid())
);
create policy outfit_items_insert on public.outfit_items for insert with check (
  exists (select 1 from public.outfits o where o.id = outfit_id and o.owner_id = auth.uid())
  and exists (select 1 from public.clothing_items c where c.id = item_id and c.owner_id = auth.uid())
);
create policy outfit_items_delete on public.outfit_items for delete using (
  exists (select 1 from public.outfits o where o.id = outfit_id and o.owner_id = auth.uid())
);

notify pgrst, 'reload schema';
