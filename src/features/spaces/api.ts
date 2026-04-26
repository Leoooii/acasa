import { supabase } from "@/api/supabase";

export type SpaceRow = {
  space_id: string;
  role: "admin" | "member";
  spaces: { id: string; name: string; created_at: string };
};

export async function listMySpaces() {
  const { data: session } = await supabase.auth.getSession();
  const userId = session.session?.user.id;
  if (!userId) return [];
  const { data, error } = await supabase
    .from("space_members")
    .select("space_id, role, spaces(id, name, created_at)")
    .eq("user_id", userId)
    .order("joined_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as unknown as SpaceRow[];
}

export async function createSpace(name: string) {
  const { data, error } = await supabase.rpc("create_space_with_owner", {
    p_name: name.trim(),
  });
  if (error) throw error;
  return data as string;
}

export async function joinSpace(code: string) {
  const { data, error } = await supabase.rpc("redeem_invitation", {
    p_code: code.trim().toUpperCase(),
  });
  if (error) throw error;
  return data as string;
}

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function generateCode() {
  let out = "";
  for (let i = 0; i < 6; i++) {
    out += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  return out;
}

export type SpaceMember = {
  user_id: string;
  role: "admin" | "member";
  joined_at: string;
  profiles: {
    display_name: string;
    avatar_url: string | null;
    status_icon: string | null;
    status_text: string | null;
    status_updated_at: string | null;
  } | null;
};

export async function listSpaceMembers(spaceId: string) {
  const { data, error } = await supabase
    .from("space_members")
    .select(
      "user_id, role, joined_at, profiles:user_id(display_name, avatar_url, status_icon, status_text, status_updated_at)",
    )
    .eq("space_id", spaceId)
    .order("joined_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as unknown as SpaceMember[];
}

export async function deleteSpace(spaceId: string) {
  const { error } = await supabase.from("spaces").delete().eq("id", spaceId);
  if (error) throw error;
}

export async function leaveSpace(spaceId: string) {
  const { data: session } = await supabase.auth.getSession();
  const userId = session.session?.user.id;
  if (!userId) throw new Error("not_authenticated");
  const { error } = await supabase
    .from("space_members")
    .delete()
    .eq("space_id", spaceId)
    .eq("user_id", userId);
  if (error) throw error;
}

export type ActiveInvitation = {
  id: string;
  code: string;
  expires_at: string;
};

export async function listActiveInvitations(spaceId: string) {
  const { data, error } = await supabase
    .from("invitations")
    .select("id, code, expires_at")
    .eq("space_id", spaceId)
    .is("used_at", null)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as ActiveInvitation[];
}

export async function deleteInvitation(invitationId: string) {
  const { error } = await supabase
    .from("invitations")
    .delete()
    .eq("id", invitationId);
  if (error) throw error;
}

export async function createInvitation(spaceId: string) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateCode();
    const { data, error } = await supabase
      .from("invitations")
      .insert({ space_id: spaceId, code })
      .select("id, code, expires_at")
      .single();
    if (!error && data) return data as { id: string; code: string; expires_at: string };
    if (error && !error.message.includes("invitations_code_key")) throw error;
  }
  throw new Error("could_not_generate_unique_code");
}
