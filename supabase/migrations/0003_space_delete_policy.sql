-- Permite admin-ului unui spatiu sa-l stearga (cascade pe tot ce contine).
create policy spaces_delete on public.spaces for delete using (
  exists (
    select 1 from public.space_members
    where space_id = spaces.id and user_id = auth.uid() and role = 'admin'
  )
);

notify pgrst, 'reload schema';
