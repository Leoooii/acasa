import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
import * as FileSystem from "expo-file-system/legacy";
import { Alert } from "react-native";

import { supabase } from "@/api/supabase";

const BUCKET = "closets";
const MAX_DIM = 1200;
const QUALITY = 0.78;

export type PickedPhoto = { uri: string; width: number; height: number };

export async function pickFromLibrary(): Promise<PickedPhoto | null> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) {
    Alert.alert("Permis", "Permite accesul la galerie ca să poți alege foto.");
    return null;
  }
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    quality: 1,
    allowsEditing: true,
    aspect: [1, 1],
  });
  if (result.canceled || !result.assets[0]) return null;
  return {
    uri: result.assets[0].uri,
    width: result.assets[0].width,
    height: result.assets[0].height,
  };
}

export async function pickFromCamera(): Promise<PickedPhoto | null> {
  const perm = await ImagePicker.requestCameraPermissionsAsync();
  if (!perm.granted) {
    Alert.alert("Permis", "Permite accesul la cameră ca să poți face poză.");
    return null;
  }
  const result = await ImagePicker.launchCameraAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    quality: 1,
    allowsEditing: true,
    aspect: [1, 1],
  });
  if (result.canceled || !result.assets[0]) return null;
  return {
    uri: result.assets[0].uri,
    width: result.assets[0].width,
    height: result.assets[0].height,
  };
}

async function resizeAndCompress(photo: PickedPhoto): Promise<string> {
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

function base64ToArrayBuffer(b64: string): ArrayBuffer {
  const binary = global.atob(b64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

export async function uploadClothingPhoto(
  itemId: string,
  photo: PickedPhoto,
): Promise<string> {
  const { data: session } = await supabase.auth.getSession();
  const userId = session.session?.user.id;
  if (!userId) throw new Error("not_authenticated");

  const compressedUri = await resizeAndCompress(photo);
  const base64 = await FileSystem.readAsStringAsync(compressedUri, {
    encoding: "base64",
  });
  const arrayBuffer = base64ToArrayBuffer(base64);

  const path = `${userId}/${itemId}.jpg`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, arrayBuffer, {
    contentType: "image/jpeg",
    upsert: true,
    cacheControl: "3600",
  });
  if (error) throw error;
  return path;
}

export async function deleteClothingPhoto(path: string) {
  const { error } = await supabase.storage.from(BUCKET).remove([path]);
  if (error) throw error;
}

export async function getSignedPhotoUrl(path: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, 60 * 60);
  if (error) throw error;
  return data.signedUrl;
}
