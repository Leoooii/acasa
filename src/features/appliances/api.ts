import { supabase } from "@/api/supabase";

export type ApplianceKind =
  | "washer"
  | "dryer"
  | "oven"
  | "microwave"
  | "dishwasher"
  | "coffee"
  | "iron"
  | "other";

export type Appliance = {
  id: string;
  space_id: string;
  name: string;
  kind: ApplianceKind;
  default_duration_minutes: number;
  created_at: string;
};

export type ApplianceDraft = {
  name: string;
  kind: ApplianceKind;
  default_duration_minutes: number;
};

export async function listAppliances(spaceId: string) {
  const { data, error } = await supabase
    .from("appliances")
    .select("*")
    .eq("space_id", spaceId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as Appliance[];
}

export async function getAppliance(id: string) {
  const { data, error } = await supabase
    .from("appliances")
    .select("*")
    .eq("id", id)
    .single();
  if (error) throw error;
  return data as Appliance;
}

export async function createAppliance(spaceId: string, draft: ApplianceDraft) {
  const { data, error } = await supabase
    .from("appliances")
    .insert({ space_id: spaceId, ...draft })
    .select("id")
    .single();
  if (error) throw error;
  return (data as { id: string }).id;
}

export async function updateAppliance(
  id: string,
  patch: Partial<ApplianceDraft>,
) {
  const { error } = await supabase.from("appliances").update(patch).eq("id", id);
  if (error) throw error;
}

export async function deleteAppliance(id: string) {
  const { error } = await supabase.from("appliances").delete().eq("id", id);
  if (error) throw error;
}

// =============================================================================
// Sessions
// =============================================================================

export type ApplianceSession = {
  id: string;
  space_id: string;
  appliance_id: string;
  user_id: string;
  started_at: string;
  ends_at: string;
  finished: boolean;
  finished_at: string | null;
  finished_by: string | null;
  profiles: { display_name: string; avatar_url: string | null } | null;
  finisher: { display_name: string; avatar_url: string | null } | null;
  appliance: { id: string; name: string; kind: ApplianceKind } | null;
};

const SESSION_FIELDS =
  "id, space_id, appliance_id, user_id, started_at, ends_at, finished, finished_at, finished_by, profiles:user_id(display_name, avatar_url), finisher:finished_by(display_name, avatar_url), appliance:appliance_id(id, name, kind)";

export async function getActiveSessionForAppliance(applianceId: string) {
  const { data, error } = await supabase
    .from("appliance_sessions")
    .select(SESSION_FIELDS)
    .eq("appliance_id", applianceId)
    .eq("finished", false)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return (data as unknown as ApplianceSession | null) ?? null;
}

export async function listActiveSessionsForSpace(spaceId: string) {
  const { data, error } = await supabase
    .from("appliance_sessions")
    .select(SESSION_FIELDS)
    .eq("space_id", spaceId)
    .eq("finished", false)
    .order("started_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as ApplianceSession[];
}

export async function listRecentSessionsForSpace(
  spaceId: string,
  sinceHours = 24,
) {
  const since = new Date(Date.now() - sinceHours * 3600_000).toISOString();
  const { data, error } = await supabase
    .from("appliance_sessions")
    .select(SESSION_FIELDS)
    .eq("space_id", spaceId)
    .or(`finished.eq.false,finished_at.gte.${since}`)
    .order("started_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as ApplianceSession[];
}

export async function listSessionsForAppliance(
  applianceId: string,
  limit = 50,
) {
  const { data, error } = await supabase
    .from("appliance_sessions")
    .select(SESSION_FIELDS)
    .eq("appliance_id", applianceId)
    .order("started_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as unknown as ApplianceSession[];
}

export async function getSession(id: string) {
  const { data, error } = await supabase
    .from("appliance_sessions")
    .select(SESSION_FIELDS)
    .eq("id", id)
    .single();
  if (error) throw error;
  return data as unknown as ApplianceSession;
}

export async function startSession(
  applianceId: string,
  spaceId: string,
  durationMinutes: number,
) {
  const endsAt = new Date(Date.now() + durationMinutes * 60_000).toISOString();
  const { data, error } = await supabase
    .from("appliance_sessions")
    .insert({
      space_id: spaceId,
      appliance_id: applianceId,
      ends_at: endsAt,
    })
    .select("id")
    .single();
  if (error) throw error;
  return (data as { id: string }).id;
}

export async function finishSession(sessionId: string) {
  const { error } = await supabase
    .from("appliance_sessions")
    .update({ finished: true })
    .eq("id", sessionId);
  if (error) throw error;
}

// =============================================================================
// UI helpers
// =============================================================================

export const APPLIANCE_KINDS: ApplianceKind[] = [
  "washer",
  "dryer",
  "oven",
  "microwave",
  "dishwasher",
  "coffee",
  "iron",
  "other",
];

export const APPLIANCE_LABELS: Record<ApplianceKind, string> = {
  washer: "Mașină de spălat",
  dryer: "Uscător",
  oven: "Cuptor",
  microwave: "Microunde",
  dishwasher: "Mașină de spălat vase",
  coffee: "Espressor",
  iron: "Fier de călcat",
  other: "Altul",
};

export const APPLIANCE_ICONS: Record<ApplianceKind, string> = {
  washer: "water-outline",
  dryer: "thermometer-outline",
  oven: "flame-outline",
  microwave: "radio-outline",
  dishwasher: "restaurant-outline",
  coffee: "cafe-outline",
  iron: "shirt-outline",
  other: "cube-outline",
};
