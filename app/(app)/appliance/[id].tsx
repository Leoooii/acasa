import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { format, formatDistanceToNow } from "date-fns";
import { ro } from "date-fns/locale";

import { Screen } from "@/components/Screen";
import { Button } from "@/components/Button";
import {
  APPLIANCE_ICONS,
  APPLIANCE_LABELS,
  finishSession,
  getActiveSessionForAppliance,
  getAppliance,
  listSessionsForAppliance,
  startSession,
  type Appliance,
  type ApplianceSession,
} from "@/features/appliances/api";
import { useActiveSpace } from "@/stores/activeSpace";
import { useSession } from "@/stores/session";
import { supabase } from "@/api/supabase";
import { formatRemaining, useCountdown } from "@/hooks/useCountdown";

export default function ApplianceDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const myUserId = useSession((s) => s.session?.user.id);
  const activeSpaceId = useActiveSpace((s) => s.activeSpaceId);
  const qc = useQueryClient();

  const { data: appliance, error: applianceErr } = useQuery({
    queryKey: ["appliance", id],
    queryFn: () => getAppliance(id!),
    enabled: !!id,
  });

  const { data: active } = useQuery({
    queryKey: ["active-session", id],
    queryFn: () => getActiveSessionForAppliance(id!),
    enabled: !!id,
  });

  const { data: history } = useQuery({
    queryKey: ["history", id],
    queryFn: () => listSessionsForAppliance(id!, 50),
    enabled: !!id,
  });

  useEffect(() => {
    if (!id || !activeSpaceId) return;
    const rnd = Math.floor(Math.random() * 1e9);
    const channel = supabase
      .channel(`appliance-detail:${id}:${rnd}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "appliance_sessions",
          filter: `appliance_id=eq.${id}`,
        },
        () => {
          qc.invalidateQueries({ queryKey: ["active-session", id] });
          qc.invalidateQueries({ queryKey: ["history", id] });
          qc.invalidateQueries({
            queryKey: ["active-sessions", activeSpaceId],
          });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [id, activeSpaceId, qc]);

  if (applianceErr || (!!id && appliance === null)) {
    return (
      <Screen>
        <Header title="Detalii" />
        <View className="flex-1 items-center justify-center">
          <Text className="text-text-muted">Aparat inexistent.</Text>
        </View>
      </Screen>
    );
  }

  if (!appliance) {
    return (
      <Screen>
        <Header title="Detalii" />
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#7c5cff" />
        </View>
      </Screen>
    );
  }

  return (
    <Screen padded={false}>
      <Header
        title={appliance.name}
        right={
          <Pressable
            onPress={() =>
              router.push(`/(app)/modal/appliance-edit?id=${appliance.id}` as never)
            }
            hitSlop={8}
          >
            <Ionicons name="settings-outline" size={20} color="#f4f4f6" />
          </Pressable>
        }
      />
      <FlatList
        data={history ?? []}
        keyExtractor={(s) => s.id}
        contentContainerStyle={{ padding: 20, gap: 8, paddingBottom: 40 }}
        renderItem={({ item }) => (
          <HistoryRow session={item} myUserId={myUserId ?? null} />
        )}
        ListHeaderComponent={
          <View className="gap-4 pb-4">
            <ActiveCard
              appliance={appliance}
              session={active ?? null}
              myUserId={myUserId ?? null}
            />
            <Text className="text-text-muted text-xs uppercase tracking-wide pt-2">
              Istoric
            </Text>
          </View>
        }
        ListEmptyComponent={
          <Text className="text-text-muted text-sm">
            Nicio sesiune înregistrată încă.
          </Text>
        }
      />
    </Screen>
  );
}

function Header({
  title,
  right,
}: {
  title: string;
  right?: React.ReactNode;
}) {
  return (
    <View className="px-5 pt-2 pb-3 flex-row items-center justify-between">
      <Pressable
        onPress={() => router.back()}
        hitSlop={8}
        className="flex-row items-center gap-1"
      >
        <Ionicons name="chevron-back" size={22} color="#f4f4f6" />
        <Text className="text-text">Înapoi</Text>
      </Pressable>
      <Text className="text-text font-semibold flex-1 text-center" numberOfLines={1}>
        {title}
      </Text>
      <View style={{ width: 80, alignItems: "flex-end" }}>{right}</View>
    </View>
  );
}

function ActiveCard({
  appliance,
  session,
  myUserId,
}: {
  appliance: Appliance;
  session: ApplianceSession | null;
  myUserId: string | null;
}) {
  const activeSpaceId = useActiveSpace((s) => s.activeSpaceId);
  const qc = useQueryClient();
  const [durationStr, setDurationStr] = useState(
    String(appliance.default_duration_minutes),
  );
  const duration = Math.max(
    1,
    Math.min(1440, parseInt(durationStr, 10) || 0),
  );
  const remaining = useCountdown(session ? session.ends_at : null);
  const expired = !!session && remaining !== null && remaining <= 0;

  const start = useMutation({
    mutationFn: () => startSession(appliance.id, activeSpaceId!, duration),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["active-session", appliance.id] });
      qc.invalidateQueries({ queryKey: ["history", appliance.id] });
      qc.invalidateQueries({
        queryKey: ["active-sessions", activeSpaceId],
      });
    },
    onError: (e) =>
      Alert.alert("Eroare", e instanceof Error ? e.message : "Nu s-a putut"),
  });

  const finish = useMutation({
    mutationFn: () => finishSession(session!.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["active-session", appliance.id] });
      qc.invalidateQueries({ queryKey: ["history", appliance.id] });
      qc.invalidateQueries({
        queryKey: ["active-sessions", activeSpaceId],
      });
    },
    onError: (e) =>
      Alert.alert("Eroare", e instanceof Error ? e.message : "Nu s-a putut"),
  });

  let containerCls = "bg-bg-card border-border";
  if (session) {
    containerCls = expired
      ? "bg-green-900/30 border-green-500/60"
      : "bg-accent/10 border-accent/40";
  }

  const me = session?.user_id === myUserId;
  const starter = session?.profiles?.display_name ?? "Cineva";

  return (
    <View className={`rounded-2xl border p-5 gap-3 ${containerCls}`}>
      <View className="flex-row items-center gap-2">
        <Ionicons
          name={APPLIANCE_ICONS[appliance.kind] as never}
          size={22}
          color="#7c5cff"
        />
        <Text className="text-text-muted text-xs uppercase tracking-wide flex-1">
          {APPLIANCE_LABELS[appliance.kind]}
        </Text>
        {session && !expired ? (
          <ActivityIndicator size="small" color="#7c5cff" />
        ) : null}
      </View>

      {session ? (
        expired ? (
          <View className="gap-2">
            <Text className="text-3xl font-bold text-green-200">
              🧺 Ready to collect!
            </Text>
            <Text className="text-text-muted text-sm">
              {me ? "Sesiunea ta s-a încheiat." : `Pornit de ${starter}.`}
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
            <Text className="text-text font-semibold">
              {me ? "Tu ai pornit" : `${starter} a pornit`}
            </Text>
            <View className="flex-row items-baseline gap-2">
              <Text className="text-5xl font-mono font-bold text-text">
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
        <View className="gap-3">
          <Text className="text-text-muted">
            Liber. Setează durata și pornește.
          </Text>
          <View className="flex-row items-center gap-2 bg-bg-elevated border border-border rounded-2xl px-4">
            <Text className="text-text-muted text-sm">Durată:</Text>
            <TextInput
              value={durationStr}
              onChangeText={(v) => setDurationStr(v.replace(/[^0-9]/g, ""))}
              keyboardType="number-pad"
              maxLength={4}
              className="text-text text-base flex-1 py-3 text-right"
            />
            <Text className="text-text-muted text-sm">min</Text>
          </View>
          <Button
            label={`Pornește (${duration} min)`}
            onPress={() => start.mutate()}
            loading={start.isPending}
            disabled={!duration || start.isPending}
          />
        </View>
      )}
    </View>
  );
}

function HistoryRow({
  session,
  myUserId,
}: {
  session: ApplianceSession;
  myUserId: string | null;
}) {
  const startedMine = session.user_id === myUserId;
  const finishedMine = session.finished_by === myUserId;
  const starter = session.profiles?.display_name ?? "—";
  const finisher = session.finisher?.display_name ?? "—";
  const startedDate = format(new Date(session.started_at), "d MMM yyyy", {
    locale: ro,
  });
  const startedTime = format(new Date(session.started_at), "HH:mm", {
    locale: ro,
  });
  const finishedTime = session.finished_at
    ? format(new Date(session.finished_at), "HH:mm", { locale: ro })
    : null;
  const ago = formatDistanceToNow(new Date(session.started_at), {
    addSuffix: true,
    locale: ro,
  });
  const durationMin = Math.round(
    (new Date(session.ends_at).getTime() -
      new Date(session.started_at).getTime()) /
      60_000,
  );
  const ongoing = !session.finished;

  return (
    <View className="bg-bg-card border border-border rounded-2xl p-4 gap-2">
      <View className="flex-row items-center justify-between">
        <Text className="text-text-muted text-xs uppercase tracking-wide">
          {startedDate}
        </Text>
        <Text className="text-text-muted text-xs">{ago}</Text>
      </View>

      <View className="flex-row items-center gap-2">
        <View className="w-2 h-2 rounded-full bg-accent" />
        <Text className="text-text text-sm flex-1">
          Pornit de{" "}
          <Text className="font-semibold">
            {startedMine ? "tine" : starter}
          </Text>
        </Text>
        <Text className="text-text-muted text-sm font-mono">{startedTime}</Text>
      </View>

      <View className="flex-row items-center gap-2">
        <View
          className={`w-2 h-2 rounded-full ${ongoing ? "bg-bg-elevated border border-border" : "bg-green-500"}`}
        />
        <Text className="text-text text-sm flex-1">
          {ongoing ? (
            <Text className="text-accent">În derulare…</Text>
          ) : (
            <>
              Oprit de{" "}
              <Text className="font-semibold">
                {finishedMine ? "tine" : finisher}
              </Text>
            </>
          )}
        </Text>
        {finishedTime ? (
          <Text className="text-text-muted text-sm font-mono">
            {finishedTime}
          </Text>
        ) : null}
      </View>

      <Text className="text-text-muted text-xs pl-4">
        Durată setată: {durationMin} min
      </Text>
    </View>
  );
}
