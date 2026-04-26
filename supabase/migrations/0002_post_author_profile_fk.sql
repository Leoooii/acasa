-- Schimba FK-ul lui posts.author_id ca sa pointeze direct la public.profiles(id),
-- ca PostgREST sa poata face embed: posts.select("..., profiles:author_id(...)")

alter table public.posts
  drop constraint if exists posts_author_id_fkey;

alter table public.posts
  add constraint posts_author_id_fkey
    foreign key (author_id) references public.profiles(id) on delete cascade;

-- Reload PostgREST schema cache imediat
notify pgrst, 'reload schema';
