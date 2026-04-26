-- Hanorac & pulover: muta-le din 'top' in 'outerwear' ca sa permita
-- layering peste tricou (tricou = top, hanorac = outerwear).

update public.clothing_items
set slot = 'outerwear'
where slot = 'top'
  and (category ilike 'hanorac%' or category ilike 'pulover%');

notify pgrst, 'reload schema';
