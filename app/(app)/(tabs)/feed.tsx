import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  Text,
  View,
} from "react-native";
import { router } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { format, formatDistanceToNow } from "date-fns";
import { ro } from "date-fns/locale";

import { Screen } from "@/components/Screen";
import {
  listPosts,
  toggleReaction,
  voteOnPoll,
  type FeedPost,
} from "@/features/feed/api";
import {
  APPLIANCE_ICONS,
  APPLIANCE_LABELS,
  finishSession,
  listActiveSessionsForSpace,
  listRecentSessionsForSpace,
  type ApplianceSession,
} from "@/features/appliances/api";
import { listMySpaces, listSpaceMembers } from "@/features/spaces/api";
import { useActiveSpace } from "@/stores/activeSpace";
import { useSession } from "@/stores/session";
import { usePreferences } from "@/stores/preferences";
import { supabase } from "@/api/supabase";
import { formatRemaining, useCountdown } from "@/hooks/useCountdown";
import { t } from "@/i18n";

const REACTION_PALETTE = ["👍", "❤️", "😂", "🎉", "😮", "🤔", "🙏", "🔥"];

type FeedItem =
  | { kind: "post"; id: string; ts: string; data: FeedPost }
  | { kind: "appliance"; id: string; ts: string; data: ApplianceSession };

export default function Feed() {
  const activeSpaceId = useActiveSpace((s) => s.activeSpaceId);
  const showAppliances = usePreferences((s) => s.showAppliancesInFeed);
  const qc = useQueryClient();

  const { data: posts, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["posts", activeSpaceId],
    queryFn: () => listPosts(activeSpaceId!),
    enabled: !!activeSpaceId,
  });

  const { data: appSessions } = useQuery({
    queryKey: ["recent-sessions", activeSpaceId],
    queryFn: () => listRecentSessionsForSpace(activeSpaceId!),
    enabled: !!activeSpaceId && showAppliances,
  });

  const { data: activeSessions } = useQuery({
    queryKey: ["active-sessions", activeSpaceId],
    queryFn: () => listActiveSessionsForSpace(activeSpaceId!),
    enabled: !!activeSpaceId,
  });

  const items = useMemo<FeedItem[]>(() => {
    const merged: FeedItem[] = [];
    for (const p of posts ?? [])
      merged.push({ kind: "post", id: p.id, ts: p.created_at, data: p });
    if (showAppliances) {
      for (const s of appSessions ?? [])
        merged.push({
          kind: "appliance",
          id: s.id,
          ts: s.started_at,
          data: s,
        });
    }
    merged.sort((a, b) => (a.ts > b.ts ? -1 : a.ts < b.ts ? 1 : 0));
    return merged;
  }, [posts, appSessions, showAppliances]);

  const { data: spaces } = useQuery({
    queryKey: ["my-spaces"],
    queryFn: listMySpaces,
  });
  const spaceName =
    spaces?.find((s) => s.space_id === activeSpaceId)?.spaces.name ??
    t("app.name");

  useEffect(() => {
    if (!activeSpaceId) return;
    const rnd = Math.floor(Math.random() * 1e9);
    const channel = supabase
      .channel(`feed:${activeSpaceId}:${rnd}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "posts",
          filter: `space_id=eq.${activeSpaceId}`,
        },
        () => qc.invalidateQueries({ queryKey: ["posts", activeSpaceId] }),
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "appliance_sessions",
          filter: `space_id=eq.${activeSpaceId}`,
        },
        () => {
          qc.invalidateQueries({
            queryKey: ["recent-sessions", activeSpaceId],
          });
          qc.invalidateQueries({
            queryKey: ["active-sessions", activeSpaceId],
          });
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "reactions" },
        () => qc.invalidateQueries({ queryKey: ["posts", activeSpaceId] }),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "poll_votes" },
        () => qc.invalidateQueries({ queryKey: ["posts", activeSpaceId] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeSpaceId, qc]);

  return (
    <Screen padded={false}>
      <View className="px-5 pt-4 pb-2 flex-row items-center justify-between">
        <Pressable
          onPress={() => router.push("/(app)/modal/space-settings")}
          className="flex-row items-center gap-1.5 flex-1"
          hitSlop={8}
        >
          <Text className="text-text text-2xl font-bold" numberOfLines={1}>
            {spaceName}
          </Text>
          <Ionicons name="chevron-down" size={18} color="#9a9aa8" />
        </Pressable>
        <Pressable
          className="bg-accent rounded-full w-10 h-10 items-center justify-center"
          onPress={() => router.push("/(app)/modal/new-post")}
          hitSlop={8}
        >
          <Ionicons name="add" size={22} color="#fff" />
        </Pressable>
      </View>

      <FlatList
        data={items}
        keyExtractor={(it) => `${it.kind}:${it.id}`}
        contentContainerStyle={{ padding: 20, gap: 12 }}
        renderItem={({ item }) =>
          item.kind === "post" ? (
            <PostCard post={item.data} />
          ) : (
            <ApplianceFeedCard session={item.data} />
          )
        }
        refreshControl={
          <RefreshControl
            refreshing={isRefetching && !isLoading}
            onRefresh={refetch}
            tintColor="#7c5cff"
          />
        }
        ListEmptyComponent={
          !isLoading ? (
            <View className="items-center pt-20">
              <Text className="text-text-muted">{t("feed.empty")}</Text>
            </View>
          ) : null
        }
      />

      {!showAppliances && (activeSessions?.length ?? 0) > 0 ? (
        <Sidedock sessions={activeSessions ?? []} />
      ) : null}
    </Screen>
  );
}

const TYPE_ICON: Record<FeedPost["type"], keyof typeof Ionicons.glyphMap> = {
  announcement: "megaphone-outline",
  event: "calendar-outline",
  poll: "stats-chart-outline",
};

function PostCard({ post }: { post: FeedPost }) {
  const myUserId = useSession((s) => s.session?.user.id);
  const mine = post.author_id === myUserId;
  const author = post.profiles?.display_name ?? "—";
  const when = formatDistanceToNow(new Date(post.created_at), {
    addSuffix: true,
    locale: ro,
  });

  return (
    <View
      className={`rounded-2xl p-4 gap-3 border ${
        mine
          ? "bg-accent/10 border-accent/40"
          : "bg-bg-card border-border"
      }`}
    >
      <View className="flex-row justify-between items-center">
        <Text className="text-text-muted text-xs flex-1" numberOfLines={1}>
          {mine ? "Tu" : author} · {when}
        </Text>
        <View className="flex-row items-center gap-3">
          <Pressable
            onPress={() => router.push(`/(app)/post/${post.id}` as never)}
            hitSlop={8}
          >
            <Ionicons
              name="information-circle-outline"
              size={18}
              color="#9a9aa8"
            />
          </Pressable>
          <View className="flex-row items-center gap-1">
            <Ionicons name={TYPE_ICON[post.type]} size={14} color="#7c5cff" />
            <Text className="text-accent text-xs font-medium">
              {t(`feed.postType.${post.type}`)}
            </Text>
          </View>
        </View>
      </View>
      <Text className="text-text text-base font-semibold">{post.title}</Text>
      {post.body ? (
        <Text className="text-text-muted text-sm" numberOfLines={4}>
          {post.body}
        </Text>
      ) : null}
      {post.type === "poll" ? <Poll post={post} /> : null}
      {post.type === "event" ? <EventBlock post={post} /> : null}
      <ReactionBar post={post} />
    </View>
  );
}

function ApplianceFeedCard({ session }: { session: ApplianceSession }) {
  const myUserId = useSession((s) => s.session?.user.id);
  const qc = useQueryClient();
  const activeSpaceId = useActiveSpace((s) => s.activeSpaceId);
  const remaining = useCountdown(session.finished ? null : session.ends_at);

  const starter = session.profiles?.display_name ?? "Cineva";
  const finisher = session.finisher?.display_name ?? "—";
  const startedMine = session.user_id === myUserId;
  const finishedMine = session.finished_by === myUserId;
  const applianceName = session.appliance?.name ?? "Aparat";
  const applianceKind = session.appliance?.kind ?? "other";

  const expired = !session.finished && remaining !== null && remaining <= 0;

  const finish = useMutation({
    mutationFn: () => finishSession(session.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["recent-sessions", activeSpaceId] });
      qc.invalidateQueries({ queryKey: ["active-sessions", activeSpaceId] });
    },
    onError: (err) =>
      Alert.alert(
        applianceName,
        err instanceof Error ? err.message : "Eroare",
      ),
  });

  let containerCls = "bg-bg-card border-border";
  let badgeBgCls = "bg-bg-elevated";
  let badgeTextCls = "text-accent";
  let badgeText = "ÎN UZ";

  if (session.finished) {
    containerCls = "bg-green-900/20 border-green-700/40";
    badgeBgCls = "bg-green-900/40";
    badgeTextCls = "text-green-300";
    badgeText = "GATA";
  } else if (expired) {
    containerCls = "bg-green-900/30 border-green-500/60";
    badgeBgCls = "bg-green-700";
    badgeTextCls = "text-white";
    badgeText = "GATA";
  } else if (startedMine) {
    containerCls = "bg-accent/10 border-accent/40";
  }

  const startedWhen = formatDistanceToNow(new Date(session.started_at), {
    addSuffix: true,
    locale: ro,
  });

  return (
    <View className={`rounded-2xl p-4 gap-3 border ${containerCls}`}>
      <View className="flex-row justify-between items-center">
        <Text className="text-text-muted text-xs flex-1" numberOfLines={1}>
          {startedMine ? "Tu" : starter} · {startedWhen}
        </Text>
        <View className="flex-row items-center gap-3">
          <Pressable
            onPress={() =>
              router.push(
                `/(app)/appliance/${session.appliance_id}` as never,
              )
            }
            hitSlop={8}
          >
            <Ionicons
              name="information-circle-outline"
              size={18}
              color="#9a9aa8"
            />
          </Pressable>
          {!session.finished && !expired ? (
            <ActivityIndicator size="small" color="#7c5cff" />
          ) : null}
          <View className="flex-row items-center gap-1.5">
            <Ionicons
              name={APPLIANCE_ICONS[applianceKind] as never}
              size={14}
              color="#7c5cff"
            />
            <View className={`rounded-full px-2 py-0.5 ${badgeBgCls}`}>
              <Text className={`text-xs font-semibold ${badgeTextCls}`}>
                {badgeText}
              </Text>
            </View>
          </View>
        </View>
      </View>

      {session.finished ? (
        <View className="gap-1">
          <Text className="text-green-300 font-semibold">
            ✓ {applianceName}: gata și strâns
          </Text>
          <Text className="text-text-muted text-sm">
            {finishedMine ? "De tine" : `De ${finisher}`}
          </Text>
        </View>
      ) : expired ? (
        <View className="gap-2">
          <Text className="text-green-200 font-semibold text-base">
            🧺 {applianceName}: ready to collect!
          </Text>
          <Text className="text-text-muted text-sm">
            {startedMine
              ? "Sesiunea ta s-a încheiat."
              : `${starter} a pornit aparatul.`}
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
            {startedMine ? "Tu ai pornit" : `${starter} a pornit`}{" "}
            {applianceName}
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
            <Text className="text-text-muted text-sm">Marchează gata acum</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

function Sidedock({ sessions }: { sessions: ApplianceSession[] }) {
  return (
    <View
      style={{
        position: "absolute",
        bottom: 16,
        left: 0,
        right: 0,
        alignItems: "center",
        zIndex: 10,
      }}
      pointerEvents="box-none"
    >
      <View
        className="flex-row gap-2 bg-bg-card/95 border border-border rounded-full px-3 py-2"
        style={{
          shadowColor: "#000",
          shadowOpacity: 0.4,
          shadowRadius: 8,
          shadowOffset: { width: 0, height: 4 },
          elevation: 8,
        }}
      >
        {sessions.map((s) => (
          <SidedockItem key={s.id} session={s} />
        ))}
      </View>
    </View>
  );
}

function SidedockItem({ session }: { session: ApplianceSession }) {
  const remaining = useCountdown(session.ends_at);
  const expired = remaining !== null && remaining <= 0;
  const kind = session.appliance?.kind ?? "other";
  const label = session.appliance?.name ?? APPLIANCE_LABELS[kind];

  return (
    <Pressable
      onPress={() =>
        router.push(`/(app)/appliance/${session.appliance_id}` as never)
      }
      className={`flex-row items-center gap-1.5 px-3 py-2 rounded-full ${
        expired ? "bg-green-700" : "bg-accent"
      }`}
      accessibilityLabel={label}
    >
      <Ionicons name={APPLIANCE_ICONS[kind] as never} size={16} color="#fff" />
      <Text className="text-white text-xs font-mono font-semibold">
        {remaining !== null ? formatRemaining(remaining) : "—"}
      </Text>
      {!expired ? <ActivityIndicator size="small" color="#fff" /> : null}
    </Pressable>
  );
}

function EventBlock({ post }: { post: FeedPost }) {
  const myUserId = useSession((s) => s.session?.user.id);
  const activeSpaceId = useActiveSpace((s) => s.activeSpaceId);

  const { data: members } = useQuery({
    queryKey: ["members", activeSpaceId],
    queryFn: () => listSpaceMembers(activeSpaceId!),
    enabled: !!activeSpaceId,
  });

  const payload = (post.payload ?? {}) as Partial<{
    start_at: string;
    end_at: string;
    participants: string[];
  }>;
  if (!payload.start_at || !payload.end_at) return null;

  const start = new Date(payload.start_at);
  const end = new Date(payload.end_at);
  const sameDay = start.toDateString() === end.toDateString();
  const dateStr = format(start, "EEEE, d MMM", { locale: ro });
  const intervalStr = sameDay
    ? `${format(start, "HH:mm")} – ${format(end, "HH:mm")}`
    : `${format(start, "d MMM HH:mm")} – ${format(end, "d MMM HH:mm")}`;

  const partIds = payload.participants ?? [];
  const partNames = partIds.map((id) => {
    if (id === myUserId) return "Tu";
    const m = members?.find((mm) => mm.user_id === id);
    return m?.profiles?.display_name ?? "—";
  });

  return (
    <View className="bg-bg-elevated rounded-xl p-3 gap-1">
      <View className="flex-row items-center gap-1.5">
        <Ionicons name="time-outline" size={14} color="#9a9aa8" />
        <Text className="text-text-muted text-xs flex-1" numberOfLines={1}>
          {dateStr}
        </Text>
        <Text className="text-text font-mono text-sm">{intervalStr}</Text>
      </View>
      {partNames.length > 0 ? (
        <View className="flex-row items-center gap-1.5">
          <Ionicons name="people-outline" size={14} color="#9a9aa8" />
          <Text className="text-text-muted text-xs flex-1" numberOfLines={1}>
            {partNames.join(", ")}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

function Poll({ post }: { post: FeedPost }) {
  const myUserId = useSession((s) => s.session?.user.id);
  const qc = useQueryClient();
  const activeSpaceId = useActiveSpace((s) => s.activeSpaceId);

  const options = useMemo<string[]>(() => {
    const raw = post.payload as { options?: unknown } | null;
    if (!raw || !Array.isArray(raw.options)) return [];
    return raw.options.filter((o): o is string => typeof o === "string");
  }, [post.payload]);

  const myVote = post.poll_votes.find((v) => v.user_id === myUserId);
  const total = post.poll_votes.length;

  const counts = useMemo(() => {
    const c: number[] = new Array(options.length).fill(0);
    for (const v of post.poll_votes) {
      if (v.option_index >= 0 && v.option_index < c.length) {
        c[v.option_index] = (c[v.option_index] ?? 0) + 1;
      }
    }
    return c;
  }, [options.length, post.poll_votes]);

  const m = useMutation({
    mutationFn: (idx: number) => voteOnPoll(post.id, idx),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["posts", activeSpaceId] }),
    onError: (err) =>
      Alert.alert(
        "Vot",
        err instanceof Error ? err.message : "Eroare la votare",
      ),
  });

  return (
    <View className="gap-2">
      {options.map((opt, idx) => {
        const count = counts[idx] ?? 0;
        const pct = total > 0 ? Math.round((count / total) * 100) : 0;
        const mine = myVote?.option_index === idx;
        return (
          <Pressable
            key={idx}
            onPress={() => m.mutate(idx)}
            className={`relative overflow-hidden rounded-xl border ${mine ? "border-accent" : "border-border"} bg-bg-elevated`}
          >
            <View
              style={{ width: `${pct}%` }}
              className={`absolute left-0 top-0 bottom-0 ${mine ? "bg-accent/30" : "bg-bg-card"}`}
            />
            <View className="px-3 py-2.5 flex-row items-center justify-between">
              <Text
                className={`text-sm flex-1 ${mine ? "text-text font-semibold" : "text-text"}`}
              >
                {opt}
              </Text>
              <Text className="text-text-muted text-xs ml-2">
                {count} · {pct}%
              </Text>
            </View>
          </Pressable>
        );
      })}
      <Text className="text-text-muted text-xs">
        {total === 0
          ? t("feed.votes.zero")
          : total === 1
            ? t("feed.votes.one")
            : t("feed.votes.more", { count: total })}
      </Text>
    </View>
  );
}

function ReactionBar({ post }: { post: FeedPost }) {
  const myUserId = useSession((s) => s.session?.user.id);
  const qc = useQueryClient();
  const activeSpaceId = useActiveSpace((s) => s.activeSpaceId);
  const [pickerOpen, setPickerOpen] = useState(false);

  const grouped = useMemo(() => {
    const map = new Map<string, { count: number; mine: boolean }>();
    for (const r of post.reactions) {
      const cur = map.get(r.emoji) ?? { count: 0, mine: false };
      cur.count++;
      if (r.user_id === myUserId) cur.mine = true;
      map.set(r.emoji, cur);
    }
    return Array.from(map.entries()).sort((a, b) => b[1].count - a[1].count);
  }, [post.reactions, myUserId]);

  const m = useMutation({
    mutationFn: ({ emoji, mine }: { emoji: string; mine: boolean }) =>
      toggleReaction(post.id, emoji, mine),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["posts", activeSpaceId] }),
    onError: (err) =>
      Alert.alert(
        "Reacție",
        err instanceof Error ? err.message : "Eroare la reacție",
      ),
  });

  return (
    <View className="flex-row items-center flex-wrap gap-1.5 pt-1">
      {grouped.map(([emoji, info]) => (
        <Pressable
          key={emoji}
          onPress={() => m.mutate({ emoji, mine: info.mine })}
          className={`flex-row items-center gap-1 px-2.5 py-1 rounded-full border ${info.mine ? "bg-accent/20 border-accent" : "bg-bg-elevated border-border"}`}
        >
          <Text className="text-base">{emoji}</Text>
          <Text
            className={`text-xs ${info.mine ? "text-accent font-semibold" : "text-text-muted"}`}
          >
            {info.count}
          </Text>
        </Pressable>
      ))}
      <Pressable
        onPress={() => setPickerOpen(true)}
        className="flex-row items-center gap-1 px-2.5 py-1 rounded-full bg-bg-elevated border border-border"
      >
        <Ionicons name="happy-outline" size={14} color="#9a9aa8" />
        <Ionicons name="add" size={14} color="#9a9aa8" />
      </Pressable>

      <Modal
        visible={pickerOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setPickerOpen(false)}
      >
        <Pressable
          className="flex-1 bg-black/60 items-center justify-center px-8"
          onPress={() => setPickerOpen(false)}
        >
          <View className="bg-bg-card border border-border rounded-2xl p-4 w-full max-w-md">
            <Text className="text-text-muted text-xs uppercase tracking-wide mb-3">
              {t("feed.reactionPicker")}
            </Text>
            <View className="flex-row flex-wrap gap-2">
              {REACTION_PALETTE.map((emoji) => {
                const existing = grouped.find(([e]) => e === emoji);
                const mine = !!existing?.[1].mine;
                return (
                  <Pressable
                    key={emoji}
                    onPress={() => {
                      setPickerOpen(false);
                      m.mutate({ emoji, mine });
                    }}
                    className={`w-12 h-12 rounded-xl items-center justify-center border ${mine ? "bg-accent/20 border-accent" : "bg-bg-elevated border-border"}`}
                  >
                    <Text className="text-2xl">{emoji}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}
