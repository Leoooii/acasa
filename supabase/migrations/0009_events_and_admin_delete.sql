-- =============================================================================
-- 0009: Inlocuieste tipul 'question' cu 'event' + admin-ul poate sterge orice post
-- =============================================================================

-- 1) Migram orice 'question' existent in 'announcement' (fara pierdere date)
update public.posts set type = 'announcement' where type = 'question';

-- 2) Inlocuim check-ul pe tipul de post
alter table public.posts drop constraint if exists posts_type_check;
alter table public.posts
  add constraint posts_type_check check (type in ('announcement', 'event', 'poll'));

-- 3) Actualizam policy de delete: autor sau admin al spatiului
drop policy if exists posts_delete on public.posts;
create policy posts_delete on public.posts for delete using (
  author_id = auth.uid()
  or exists (
    select 1 from public.space_members sm
    where sm.space_id = posts.space_id
      and sm.user_id = auth.uid()
      and sm.role = 'admin'
  )
);

notify pgrst, 'reload schema';
