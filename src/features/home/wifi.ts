import { supabase } from "@/api/supabase";

export type WifiSecurity = "WPA" | "WEP" | "nopass";

export type WifiData = {
  ssid: string;
  password: string;
  security: WifiSecurity;
  hidden: boolean;
};

export async function getWifi(spaceId: string): Promise<WifiData | null> {
  const { data, error } = await supabase
    .from("home_resources")
    .select("data")
    .eq("space_id", spaceId)
    .eq("kind", "wifi")
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const d = (data as { data: Partial<WifiData> }).data ?? {};
  return {
    ssid: d.ssid ?? "",
    password: d.password ?? "",
    security: (d.security as WifiSecurity) ?? "WPA",
    hidden: !!d.hidden,
  };
}

export async function upsertWifi(spaceId: string, data: WifiData) {
  const { error } = await supabase
    .from("home_resources")
    .upsert(
      { space_id: spaceId, kind: "wifi", data },
      { onConflict: "space_id,kind" },
    );
  if (error) throw error;
}

export async function deleteWifi(spaceId: string) {
  const { error } = await supabase
    .from("home_resources")
    .delete()
    .eq("space_id", spaceId)
    .eq("kind", "wifi");
  if (error) throw error;
}
