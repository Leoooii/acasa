import { supabase } from "@/api/supabase";
import * as ImageManipulator from "expo-image-manipulator";
import * as FileSystem from "expo-file-system/legacy";

import type { PickedPhoto } from "@/features/closet/photo";

const AVATAR_BUCKET = "avatars";
const MAX_DIM = 600;
const QUALITY = 0.82;

function base64ToArrayBuffer(b64: string): ArrayBuffer {
  const binary = global.atob(b64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

async function resizeAvatar(photo: PickedPhoto): Promise<string> {
  const longest = Math.max(photo.width, photo.height);
  const actions: ImageManipulator.Action[] =
    longest > MAX_DIM
      ? [
          {
            resize:
              photo.width >= photo.height
                ? { width: MAX_DIM }
                : { height: MAX_DIM },
          },
        ]
      : [];
  const manipulated = await ImageManipulator.manipulateAsync(photo.uri, actions, {
    compress: QUALITY,
    format: ImageManipulator.SaveFormat.JPEG,
  });
  return manipulated.uri;
}

export async function uploadMyAvatar(photo: PickedPhoto): Promise<string> {
  const { data: session } = await supabase.auth.getSession();
  const userId = session.session?.user.id;
  if (!userId) throw new Error("not_authenticated");

  // sterge avatarele vechi (cleanup, daca exista)
  const { data: files } = await supabase.storage
    .from(AVATAR_BUCKET)
    .list(userId);
  if (files && files.length > 0) {
    await supabase.storage
      .from(AVATAR_BUCKET)
      .remove(files.map((f) => `${userId}/${f.name}`));
  }

  const compressedUri = await resizeAvatar(photo);
  const base64 = await FileSystem.readAsStringAsync(compressedUri, {
    encoding: "base64",
  });
  const arrayBuffer = base64ToArrayBuffer(base64);

  const path = `${userId}/${Date.now()}.jpg`;
  const { error } = await supabase.storage
    .from(AVATAR_BUCKET)
    .upload(path, arrayBuffer, {
      contentType: "image/jpeg",
      cacheControl: "3600",
    });
  if (error) throw error;
  return path;
}

export async function deleteMyAvatar() {
  const { data: session } = await supabase.auth.getSession();
  const userId = session.session?.user.id;
  if (!userId) throw new Error("not_authenticated");
  const { data: files } = await supabase.storage
    .from(AVATAR_BUCKET)
    .list(userId);
  if (files && files.length > 0) {
    await supabase.storage
      .from(AVATAR_BUCKET)
      .remove(files.map((f) => `${userId}/${f.name}`));
  }
  await supabase.from("profiles").update({ avatar_url: null }).eq("id", userId);
}

export function avatarPublicUrl(path: string): string {
  const { data } = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

export async function updateMyName(name: string) {
  const { data: session } = await supabase.auth.getSession();
  const userId = session.session?.user.id;
  if (!userId) throw new Error("not_authenticated");
  const { error } = await supabase
    .from("profiles")
    .update({ display_name: name.trim() })
    .eq("id", userId);
  if (error) throw error;
}

export async function setAvatarUrl(path: string | null) {
  const { data: session } = await supabase.auth.getSession();
  const userId = session.session?.user.id;
  if (!userId) throw new Error("not_authenticated");
  const { error } = await supabase
    .from("profiles")
    .update({ avatar_url: path })
    .eq("id", userId);
  if (error) throw error;
}

export const STATUS_PRESETS: ReadonlyArray<{ emoji: string; label: string }> = [
  { emoji: "😊", label: "Liber" },
  { emoji: "🛌", label: "Acasă" },
  { emoji: "💼", label: "La muncă" },
  { emoji: "🎓", label: "La cursuri" },
  { emoji: "🏋️", label: "La sală" },
  { emoji: "🚗", label: "Pe drum" },
  { emoji: "🛒", label: "Cumpărături" },
  { emoji: "🍳", label: "Gătește" },
  { emoji: "☕", label: "Cafea" },
  { emoji: "🍕", label: "La masă" },
  { emoji: "🎮", label: "Gaming" },
  { emoji: "📚", label: "Citește" },
  { emoji: "🎬", label: "Filme" },
  { emoji: "🎵", label: "Muzică" },
  { emoji: "🌳", label: "Afară" },
  { emoji: "🎉", label: "Petrecere" },
  { emoji: "✈️", label: "Călătorie" },
  { emoji: "🏥", label: "La doctor" },
  { emoji: "🤒", label: "Răcit" },
  { emoji: "😴", label: "Doarme" },
  { emoji: "🤫", label: "Concentrat" },
  { emoji: "🛁", label: "Baie" },
  { emoji: "🚿", label: "Duș" },
  { emoji: "❓", label: "Cine știe" },
];

export async function updateMyStatus(
  icon: string | null,
  text: string | null,
) {
  const { data: session } = await supabase.auth.getSession();
  const userId = session.session?.user.id;
  if (!userId) throw new Error("not_authenticated");
  const { error } = await supabase
    .from("profiles")
    .update({
      status_icon: icon,
      status_text: text?.trim() || null,
      status_updated_at: icon || text?.trim() ? new Date().toISOString() : null,
    })
    .eq("id", userId);
  if (error) throw error;
}

export type MyProfile = {
  id: string;
  display_name: string;
  avatar_url: string | null;
  status_icon: string | null;
  status_text: string | null;
  status_updated_at: string | null;
};

export async function getMyProfile(): Promise<MyProfile | null> {
  const { data: session } = await supabase.auth.getSession();
  const userId = session.session?.user.id;
  if (!userId) return null;
  const { data, error } = await supabase
    .from("profiles")
    .select("id, display_name, avatar_url, status_icon, status_text, status_updated_at")
    .eq("id", userId)
    .single();
  if (error) throw error;
  return data as MyProfile;
}
