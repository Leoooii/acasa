import { supabase } from "@/api/supabase";

export type ShoppingItem = {
  id: string;
  space_id: string;
  name: string;
  quantity: string | null;
  category: string | null;
  is_done: boolean;
  added_by: string;
  done_by: string | null;
  done_at: string | null;
  created_at: string;
  added_by_profile: {
    display_name: string;
    avatar_url: string | null;
  } | null;
  done_by_profile: {
    display_name: string;
    avatar_url: string | null;
  } | null;
};

export const SHOPPING_CATEGORIES: ReadonlyArray<{
  label: string;
  emoji: string;
}> = [
  { label: "Lactate", emoji: "🥛" },
  { label: "Panificație", emoji: "🍞" },
  { label: "Fructe", emoji: "🍎" },
  { label: "Legume", emoji: "🥦" },
  { label: "Carne & pește", emoji: "🥩" },
  { label: "Conserve", emoji: "🥫" },
  { label: "Băuturi", emoji: "🧃" },
  { label: "Dulciuri", emoji: "🍪" },
  { label: "Mic dejun", emoji: "🥣" },
  { label: "Igienă", emoji: "🧼" },
  { label: "Curățenie", emoji: "🧴" },
  { label: "Pet", emoji: "🐾" },
  { label: "Bebe", emoji: "🍼" },
  { label: "Altele", emoji: "🛒" },
];

const FIELDS =
  "id, space_id, name, quantity, category, is_done, added_by, done_by, done_at, created_at, added_by_profile:added_by(display_name, avatar_url), done_by_profile:done_by(display_name, avatar_url)";

export async function listShoppingItems(spaceId: string) {
  const { data, error } = await supabase
    .from("shopping_items")
    .select(FIELDS)
    .eq("space_id", spaceId)
    .order("is_done", { ascending: true })
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as ShoppingItem[];
}

export async function getShoppingItem(id: string) {
  const { data, error } = await supabase
    .from("shopping_items")
    .select(FIELDS)
    .eq("id", id)
    .single();
  if (error) throw error;
  return data as unknown as ShoppingItem;
}

export type ShoppingDraft = {
  name: string;
  quantity: string | null;
  category: string | null;
};

export async function createShoppingItem(spaceId: string, draft: ShoppingDraft) {
  const { error } = await supabase.from("shopping_items").insert({
    space_id: spaceId,
    name: draft.name.trim(),
    quantity: draft.quantity?.trim() || null,
    category: draft.category?.trim() || null,
  });
  if (error) throw error;
}

export async function updateShoppingItem(
  id: string,
  patch: Partial<ShoppingDraft>,
) {
  const { error } = await supabase
    .from("shopping_items")
    .update({
      ...(patch.name !== undefined ? { name: patch.name.trim() } : {}),
      ...(patch.quantity !== undefined
        ? { quantity: patch.quantity?.trim() || null }
        : {}),
      ...(patch.category !== undefined
        ? { category: patch.category?.trim() || null }
        : {}),
    })
    .eq("id", id);
  if (error) throw error;
}

export async function toggleShoppingItem(id: string, isDone: boolean) {
  const { error } = await supabase
    .from("shopping_items")
    .update({ is_done: isDone })
    .eq("id", id);
  if (error) throw error;
}

export async function deleteShoppingItem(id: string) {
  const { error } = await supabase.from("shopping_items").delete().eq("id", id);
  if (error) throw error;
}

export async function deleteAllDone(spaceId: string) {
  const { error } = await supabase
    .from("shopping_items")
    .delete()
    .eq("space_id", spaceId)
    .eq("is_done", true);
  if (error) throw error;
}
