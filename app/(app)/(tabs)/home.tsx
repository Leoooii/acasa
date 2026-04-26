import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { router } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";

import { Screen } from "@/components/Screen";
import { Button } from "@/components/Button";
import { getWifi, type WifiData } from "@/features/home/wifi";
import {
  APPLIANCE_ICONS,
  APPLIANCE_LABELS,
  finishSession,
  listActiveSessionsForSpace,
  listAppliances,
  startSession,
  type Appliance,
  type ApplianceSession,
} from "@/features/appliances/api";
import { useActiveSpace } from "@/stores/activeSpace";
import { useSession } from "@/stores/session";
import { supabase } from "@/api/supabase";
import { formatRemaining, useCountdown } from "@/hooks/useCountdown";

export default function Home() {
  const activeSpaceId = useActiveSpace((s) => s.activeSpaceId);
  const qc = useQueryClient();

  const { data: wifi } = useQuery({
    queryKey: ["wifi", activeSpaceId],
    queryFn: () => getWifi(activeSpaceId!),
    enabled: !!activeSpaceId,
  });

  const { data: appliances } = useQuery({
    queryKey: ["appliances", activeSpaceId],
    queryFn: () => listAppliances(activeSpaceId!),
    enabled: !!activeSpaceId,
  });

  const { data: activeSessions } = useQuery({
    queryKey: ["active-sessions", activeSpaceId],
    queryFn: () => listActiveSessionsForSpace(activeSpaceId!),
    enabled: !!activeSpaceId,
  });

  useEffect(() => {
    if (!activeSpaceId) return;
    const rnd = Math.floor(Math.random() * 1e9);
    const channel = supabase
      .channel(`home:${activeSpaceId}:${rnd}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "appliance_sessions",
          filter: `space_id=eq.${activeSpaceId}`,
        },
        () =>
          qc.invalidateQueries({
            queryKey: ["active-sessions", activeSpaceId],
          }),
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "appliances",
          filter: `space_id=eq.${activeSpaceId}`,
        },
        () =>
          qc.invalidateQueries({ queryKey: ["appliances", activeSpaceId] }),
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "home_resources",
          filter: `space_id=eq.${activeSpaceId}`,
        },
        () => qc.invalidateQueries({ queryKey: ["wifi", activeSpaceId] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeSpaceId, qc]);

  return (
    <Screen padded={false}>
      <ScrollView
        contentContainerStyle={{ padding: 20, gap: 16, paddingBottom: 40 }}
      >
        <Text className="text-text text-2xl font-bold">Casa</Text>

        <WifiCard wifi={wifi ?? null} />

        <View className="flex-row items-center justify-between mt-2">
          <Text className="text-text-muted text-xs uppercase tracking-wide">
            Aparate
          </Text>
          <Pressable
            onPress={() => router.push("/(app)/modal/appliance-edit")}
            hitSlop={8}
            className="flex-row items-center gap-1"
          >
            <Ionicons name="add" size={16} color="#7c5cff" />
            <Text className="text-accent text-sm">Adaugă</Text>
          </Pressable>
        </View>

        {(appliances ?? []).map((app) => {
          const active =
            activeSessions?.find((s) => s.appliance_id === app.id) ?? null;
          return (
            <ApplianceCard
              key={app.id}
              appliance={app}
              session={active}
            />
          );
        })}

        {appliances && appliances.length === 0 ? (
          <View className="bg-bg-card border border-border rounded-2xl p-5 items-center gap-2">
            <Text className="text-text-muted text-center">
              Niciun aparat configurat. Adaugă unul cu butonul de sus.
            </Text>
          </View>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

function WifiCard({ wifi }: { wifi: WifiData | null }) {
  const [showPass, setShowPass] = useState(false);

  async function copyPass() {
    if (!wifi) return;
    await Clipboard.setStringAsync(wifi.password);
    Alert.alert("Copiat", "Parola e în clipboard.");
  }

  return (
    <View className="bg-bg-card border border-border rounded-2xl p-5 gap-3">
      <View className="flex-row items-center justify-between">
        <Text className="text-text-muted text-xs uppercase tracking-wide">
          WiFi
        </Text>
        <Pressable
          onPress={() => router.push("/(app)/modal/wifi-edit")}
          hitSlop={8}
        >
          <Text className="text-accent text-sm">
            {wifi?.ssid ? "Editează" : "Adaugă"}
          </Text>
        </Pressable>
      </View>

      {wifi?.ssid ? (
        <>
          <Text className="text-text text-lg font-semibold">{wifi.ssid}</Text>
          {wifi.security !== "nopass" ? (
            <View className="flex-row items-center gap-2">
              <Text className="text-text font-mono flex-1" selectable>
                {showPass
                  ? wifi.password
                  : "•".repeat(Math.max(8, wifi.password.length))}
              </Text>
              <Pressable onPress={() => setShowPass((v) => !v)} hitSlop={8}>
                <Ionicons
                  name={showPass ? "eye-off-outline" : "eye-outline"}
                  size={18}
                  color="#9a9aa8"
                />
              </Pressable>
              <Pressable onPress={copyPass} hitSlop={8}>
                <Ionicons name="copy-outline" size={18} color="#9a9aa8" />
              </Pressable>
            </View>
          ) : (
            <Text className="text-text-muted">Rețea fără parolă</Text>
          )}
          <Pressable
            onPress={() => router.push("/(app)/modal/wifi-qr")}
            className="bg-bg-elevated rounded-xl py-3 items-center flex-row justify-center gap-2 mt-1"
          >
            <Ionicons name="qr-code-outline" size={18} color="#f4f4f6" />
            <Text className="text-text font-medium">Arată QR</Text>
          </Pressable>
        </>
      ) : (
        <Text className="text-text-muted">
          Niciun WiFi salvat. Apasă "Adaugă" ca să-l setezi pentru toți din spațiu.
        </Text>
      )}
    </View>
  );
}

function ApplianceCard({
  appliance,
  session,
}: {
  appliance: Appliance;
  session: ApplianceSession | null;
}) {
  const activeSpaceId = useActiveSpace((s) => s.activeSpaceId);
  const myUserId = useSession((s) => s.session?.user.id);
  const qc = useQueryClient();
  const [durationStr, setDurationStr] = useState(
    String(appliance.default_duration_minutes),
  );
  const duration = Math.max(
    1,
    Math.min(1440, parseInt(durationStr, 10) || 0),
  );
  const valid = duration > 0;
  const remaining = useCountdown(session?.ends_at ?? null);
  const expired = !!session && remaining !== null && remaining <= 0;

  const start = useMutation({
    mutationFn: () => startSession(appliance.id, activeSpaceId!, duration),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["active-sessions", activeSpaceId] }),
    onError: (e) =>
      Alert.alert("Eroare", e instanceof Error ? e.message : "Nu s-a putut"),
  });

  const finish = useMutation({
    mutationFn: () => finishSession(session!.id),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["active-sessions", activeSpaceId] }),
    onError: (e) =>
      Alert.alert("Eroare", e instanceof Error ? e.message : "Nu s-a putut"),
  });

  const icon = APPLIANCE_ICONS[appliance.kind];
  const me = session?.user_id === myUserId;
  const starter = session?.profiles?.display_name ?? "Cineva";

  return (
    <View
      className={`rounded-2xl border p-5 gap-3 ${
        session
          ? expired
            ? "bg-green-900/30 border-green-500/60"
            : "bg-bg-card border-accent/40"
          : "bg-bg-card border-border"
      }`}
    >
      <View className="flex-row items-center justify-between">
        <Pressable
          onPress={() =>
            router.push(`/(app)/appliance/${appliance.id}` as never)
          }
          className="flex-row items-center gap-2 flex-1"
          hitSlop={8}
        >
          <Ionicons name={icon as never} size={20} color="#7c5cff" />
          <Text
            className="text-text text-base font-semibold flex-1"
            numberOfLines={1}
          >
            {appliance.name}
          </Text>
          {session && !expired ? (
            <ActivityIndicator size="small" color="#7c5cff" />
          ) : null}
        </Pressable>
        <Pressable
          onPress={() =>
            router.push(`/(app)/appliance/${appliance.id}` as never)
          }
          hitSlop={8}
        >
          <Ionicons
            name="information-circle-outline"
            size={20}
            color="#9a9aa8"
          />
        </Pressable>
      </View>

      <Text className="text-text-muted text-xs">
        {APPLIANCE_LABELS[appliance.kind]}
      </Text>

      {session ? (
        expired ? (
          <View className="gap-2">
            <Text className="text-green-200 font-semibold">
              🧺 Ready to collect!
            </Text>
            <Text className="text-text-muted text-sm">
              {me
                ? "Sesiunea ta s-a încheiat."
                : `Pornit de ${starter}.`}
            </Text>
            <Pressable
              onPress={() => finish.mutate()}
              className="bg-green-700 rounded-xl py-3 items-center"
            >
              <Text className="text-white font-semibold">Le strâng eu</Text>
            </Pressable>
          </View>
        ) : (
          <View className="gap-2">
            <Text className="text-text">
              {me ? "Tu ai pornit" : `${starter} a pornit`}
            </Text>
            <View className="flex-row items-baseline gap-2">
              <Text className="text-3xl font-mono font-bold text-text">
                {remaining !== null ? formatRemaining(remaining) : "—"}
              </Text>
              <Text className="text-text-muted text-sm">rămase</Text>
            </View>
            <Pressable
              onPress={() => finish.mutate()}
              className="bg-bg-elevated rounded-xl py-2.5 items-center border border-border"
            >
              <Text className="text-text-muted text-sm">
                Marchează gata acum
              </Text>
            </Pressable>
          </View>
        )
      ) : (
        <View className="gap-2">
          <View className="flex-row items-center gap-2 bg-bg-elevated border border-border rounded-2xl px-4">
            <Text className="text-text-muted text-sm">Durată:</Text>
            <TextInput
              value={durationStr}
              onChangeText={(v) => setDurationStr(v.replace(/[^0-9]/g, ""))}
              keyboardType="number-pad"
              maxLength={4}
              className="text-text text-base flex-1 py-3 text-right"
              placeholder={String(appliance.default_duration_minutes)}
              placeholderTextColor="#6b6b78"
            />
            <Text className="text-text-muted text-sm">min</Text>
          </View>
          <Button
            label={valid ? `Pornește (${duration} min)` : "Setează durata"}
            onPress={() => start.mutate()}
            loading={start.isPending}
            disabled={!valid || start.isPending}
          />
        </View>
      )}
    </View>
  );
}
