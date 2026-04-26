import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import Constants from "expo-constants";
import { Platform } from "react-native";

import { supabase } from "@/api/supabase";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

let inFlight: Promise<string | null> | null = null;

export function ensurePushTokenRegistered(): Promise<string | null> {
  if (!inFlight) {
    inFlight = registerInternal().finally(() => {
      inFlight = null;
    });
  }
  return inFlight;
}

async function registerInternal(): Promise<string | null> {
  if (!Device.isDevice) return null;

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("appliances", {
      name: "Aparate",
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      sound: "default",
    });
  }

  const settings = await Notifications.getPermissionsAsync();
  let granted = !!settings.granted;
  if (!granted && settings.canAskAgain !== false) {
    const req = await Notifications.requestPermissionsAsync();
    granted = !!req.granted;
  }
  if (!granted) return null;

  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ??
    (Constants as { easConfig?: { projectId?: string } }).easConfig?.projectId;

  let tokenData;
  try {
    tokenData = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined,
    );
  } catch (err) {
    console.warn("[push] getExpoPushTokenAsync err:", err);
    return null;
  }
  const token = tokenData.data;

  const { data: session } = await supabase.auth.getSession();
  const userId = session.session?.user.id;
  if (!userId) return null;

  const { error } = await supabase
    .from("device_tokens")
    .upsert(
      { user_id: userId, token, updated_at: new Date().toISOString() },
      { onConflict: "user_id,token" },
    );
  if (error) {
    console.warn("[push] upsert token err:", error.message);
    return null;
  }
  return token;
}

export async function unregisterCurrentDeviceToken() {
  try {
    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ??
      (Constants as { easConfig?: { projectId?: string } }).easConfig?.projectId;
    const tokenData = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined,
    );
    const { data: session } = await supabase.auth.getSession();
    const userId = session.session?.user.id;
    if (!userId) return;
    await supabase
      .from("device_tokens")
      .delete()
      .eq("user_id", userId)
      .eq("token", tokenData.data);
  } catch {
    /* ignore */
  }
}
