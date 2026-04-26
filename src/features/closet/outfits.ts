import { supabase } from "@/api/supabase";

import type { ClothingItem } from "./api";
import type { Slot } from "./categories";

export type Outfit = {
  id: string;
  space_id: string;
  owner_id: string;
  name: string;
  is_favorite: boolean;
  created_at: string;
};

export type OutfitWithItems = Outfit & {
  items: ClothingItem[];
};

export async function listOutfits(spaceId: string) {
  const { data, error } = await supabase
    .from("outfits")
    .select("*")
    .eq("space_id", spaceId)
    .order("is_favorite", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Outfit[];
}

export async function listOutfitsWithItems(spaceId: string) {
  const outfits = await listOutfits(spaceId);
  if (outfits.length === 0) return [];
  const { data: rows, error } = await supabase
    .from("outfit_items")
    .select(
      "outfit_id, position, slot, item:item_id(id, space_id, owner_id, name, photo_path, category, slot, size, color, season, pair_count, created_at)",
    )
    .in(
      "outfit_id",
      outfits.map((o) => o.id),
    )
    .order("position", { ascending: true });
  if (error) throw error;
  type Row = {
    outfit_id: string;
    position: number;
    slot: string | null;
    item: ClothingItem;
  };
  const itemsByOutfit = new Map<string, ClothingItem[]>();
  for (const r of (rows ?? []) as unknown as Row[]) {
    const list = itemsByOutfit.get(r.outfit_id) ?? [];
    if (r.item) list.push(r.item);
    itemsByOutfit.set(r.outfit_id, list);
  }
  return outfits.map((o) => ({
    ...o,
    items: itemsByOutfit.get(o.id) ?? [],
  })) as OutfitWithItems[];
}

export async function getOutfit(id: string): Promise<OutfitWithItems> {
  const { data: outfit, error: e1 } = await supabase
    .from("outfits")
    .select("*")
    .eq("id", id)
    .single();
  if (e1) throw e1;

  const { data: rows, error: e2 } = await supabase
    .from("outfit_items")
    .select(
      "position, slot, item:item_id(id, space_id, owner_id, name, photo_path, category, slot, size, color, season, pair_count, created_at)",
    )
    .eq("outfit_id", id)
    .order("position", { ascending: true });
  if (e2) throw e2;

  type Row = { position: number; slot: string | null; item: ClothingItem };
  const items = ((rows ?? []) as unknown as Row[])
    .map((r) => r.item)
    .filter((it): it is ClothingItem => !!it);
  return { ...(outfit as Outfit), items };
}

export async function createOutfit(input: {
  spaceId: string;
  name: string;
  itemIds: string[];
  isFavorite?: boolean;
}) {
  const { data: outfit, error: e1 } = await supabase
    .from("outfits")
    .insert({
      space_id: input.spaceId,
      name: input.name.trim(),
      is_favorite: !!input.isFavorite,
    })
    .select("id")
    .single();
  if (e1) throw e1;
  const outfitId = (outfit as { id: string }).id;

  if (input.itemIds.length > 0) {
    const rows = input.itemIds.map((id, idx) => ({
      outfit_id: outfitId,
      item_id: id,
      position: idx,
    }));
    const { error: e2 } = await supabase.from("outfit_items").insert(rows);
    if (e2) throw e2;
  }
  return outfitId;
}

export async function setFavorite(outfitId: string, favorite: boolean) {
  const { error } = await supabase
    .from("outfits")
    .update({ is_favorite: favorite })
    .eq("id", outfitId);
  if (error) throw error;
}

export async function renameOutfit(outfitId: string, name: string) {
  const { error } = await supabase
    .from("outfits")
    .update({ name: name.trim() })
    .eq("id", outfitId);
  if (error) throw error;
}

export async function deleteOutfit(id: string) {
  const { error } = await supabase.from("outfits").delete().eq("id", id);
  if (error) throw error;
}

// =============================================================================
// Random generator
// =============================================================================

const SLOT_ORDER: Slot[] = [
  "outerwear",
  "top",
  "dress",
  "bottom",
  "shoes",
  "socks",
  "accessory",
];

export type RandomOptions = {
  slots: Slot[];
  color?: string | null;
  season?: string | null;
};

function pickRandom<T>(arr: T[]): T | null {
  if (arr.length === 0) return null;
  const idx = Math.floor(Math.random() * arr.length);
  return arr[idx] ?? null;
}

export function generateRandomOutfit(
  pool: ClothingItem[],
  opts: RandomOptions,
): ClothingItem[] {
  const filtered = pool.filter((i) => {
    if (opts.color) {
      const c = (i.color ?? "").trim().toLowerCase();
      if (c !== opts.color.toLowerCase()) return false;
    }
    if (opts.season && opts.season !== "all") {
      if (i.season && i.season !== "all" && i.season !== opts.season)
        return false;
    }
    return true;
  });

  const wanted = SLOT_ORDER.filter((s) => opts.slots.includes(s));
  const chosen: ClothingItem[] = [];

  // Daca dress e cerut, scoatem top + bottom (dress acopera)
  const useDress = wanted.includes("dress");
  const effective = wanted.filter((s) =>
    useDress ? !(s === "top" || s === "bottom") : s !== "dress",
  );

  for (const slot of effective) {
    const candidates = filtered.filter((i) => i.slot === slot);
    const pick = pickRandom(candidates);
    if (pick) chosen.push(pick);
  }
  return chosen;
}
