import { supabase } from "@/api/supabase";

import type { Slot } from "./categories";

export type Season = "all" | "spring" | "summer" | "autumn" | "winter";

export type ClothingItem = {
  id: string;
  space_id: string;
  owner_id: string;
  name: string;
  photo_path: string | null;
  category: string | null;
  slot: Slot | null;
  size: string | null;
  color: string | null;
  season: string | null;
  pair_count: number;
  created_at: string;
};

type SortBy = "recent" | "name" | "category";

export async function listClothingItems(
  spaceId: string,
  opts?: {
    search?: string;
    category?: string | null;
    color?: string | null;
    season?: string | null;
    slot?: Slot | null;
    sort?: SortBy;
  },
) {
  let q = supabase
    .from("clothing_items")
    .select("*")
    .eq("space_id", spaceId);

  if (opts?.category) q = q.eq("category", opts.category);
  if (opts?.color) q = q.ilike("color", opts.color);
  if (opts?.season) q = q.eq("season", opts.season);
  if (opts?.slot) q = q.eq("slot", opts.slot);
  if (opts?.search) {
    const s = opts.search.trim();
    if (s) q = q.or(`name.ilike.%${s}%,color.ilike.%${s}%,category.ilike.%${s}%`);
  }

  switch (opts?.sort ?? "recent") {
    case "name":
      q = q.order("name", { ascending: true });
      break;
    case "category":
      q = q.order("category", { ascending: true, nullsFirst: false }).order("name", { ascending: true });
      break;
    case "recent":
    default:
      q = q.order("created_at", { ascending: false });
  }

  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as ClothingItem[];
}

export async function listColors(spaceId: string) {
  const { data, error } = await supabase
    .from("clothing_items")
    .select("color")
    .eq("space_id", spaceId)
    .not("color", "is", null);
  if (error) throw error;
  const set = new Set<string>();
  for (const row of data ?? []) {
    const c = (row as { color: string | null }).color;
    if (c) set.add(c.trim().toLowerCase());
  }
  return Array.from(set).sort();
}

export async function listCategories(spaceId: string) {
  const { data, error } = await supabase
    .from("clothing_items")
    .select("category")
    .eq("space_id", spaceId)
    .not("category", "is", null);
  if (error) throw error;
  const set = new Set<string>();
  for (const row of data ?? []) {
    const c = (row as { category: string | null }).category;
    if (c) set.add(c);
  }
  return Array.from(set).sort();
}

export type ClothingDraft = {
  name: string;
  category: string | null;
  slot: Slot | null;
  size: string | null;
  color: string | null;
  season: string | null;
  pair_count: number;
  photo_path: string | null;
};

export async function createClothingItem(
  spaceId: string,
  draft: ClothingDraft,
) {
  const { data, error } = await supabase
    .from("clothing_items")
    .insert({ space_id: spaceId, ...draft })
    .select("id")
    .single();
  if (error) throw error;
  return (data as { id: string }).id;
}

export async function updateClothingItem(
  id: string,
  patch: Partial<ClothingDraft>,
) {
  const { error } = await supabase
    .from("clothing_items")
    .update(patch)
    .eq("id", id);
  if (error) throw error;
}

export async function deleteClothingItem(id: string) {
  const { error } = await supabase.from("clothing_items").delete().eq("id", id);
  if (error) throw error;
}

export async function getClothingItem(id: string) {
  const { data, error } = await supabase
    .from("clothing_items")
    .select("*")
    .eq("id", id)
    .single();
  if (error) throw error;
  return data as ClothingItem;
}
