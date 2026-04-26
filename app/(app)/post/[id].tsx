import { useEffect, useMemo } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { format, formatDistanceToNow } from "date-fns";
import { ro } from "date-fns/locale";

import { Screen } from "@/components/Screen";
import {
  deletePost,
  getPost,
  toggleReaction,
  voteOnPoll,
  type FeedPost,
} from "@/features/feed/api";
import { listMySpaces, listSpaceMembers } from "@/features/spaces/api";
import { useActiveSpace } from "@/stores/activeSpace";
import { useSession } from "@/stores/session";
import { supabase } from "@/api/supabase";
import { t } from "@/i18n";

const TYPE_ICON: Record<FeedPost["type"], keyof typeof Ionicons.glyphMap> = {
  announcement: "megaphone-outline",
  event: "calendar-outline",
  poll: "stats-chart-outline",
};

export default function PostDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const activeSpaceId = useActiveSpace((s) => s.activeSpaceId);
  const myUserId = useSession((s) => s.session?.user.id);
  const qc = useQueryClient();

  const { data: post, isLoading, error } = useQuery({
    queryKey: ["post", id],
    queryFn: () => getPost(id!),
    enabled: !!id,
  });

  const { data: members } = useQuery({
    queryKey: ["members", activeSpaceId],
    queryFn: () => listSpaceMembers(activeSpaceId!),
    enabled: !!activeSpaceId,
  });

  const { data: spaces } = useQuery({
    queryKey: ["my-spaces"],
    queryFn: listMySpaces,
  });
  const isAdminHere =
    spaces?.find((s) => s.space_id === activeSpaceId)?.role === "admin";

  const remove = useMutation({
    mutationFn: () => deletePost(id!),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["posts", activeSpaceId] });
      router.back();
    },
    onError: (err) =>
      Alert.alert(
        "Eroare",
        err instanceof Error ? err.message : "Nu s-a putut",
      ),
  });

  useEffect(() => {
    if (!id) return;
    const rnd = Math.floor(Math.random() * 1e9);
    const channel = supabase
      .channel(`post-detail:${id}:${rnd}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "reactions" },
        () => qc.invalidateQueries({ queryKey: ["post", id] }),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "poll_votes" },
        () => qc.invalidateQueries({ queryKey: ["post", id] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [id, qc]);

  const nameOf = useMemo(
    () => (userId: string) => {
      if (userId === myUserId) return "Tu";
      const m = members?.find((mm) => mm.user_id === userId);
      return m?.profiles?.display_name ?? "—";
    },
    [members, myUserId],
  );

  if (isLoading) {
    return (
      <Screen>
        <Header />
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#7c5cff" />
        </View>
      </Screen>
    );
  }

  if (error || !post) {
    return (
      <Screen>
        <Header />
        <View className="flex-1 items-center justify-center">
          <Text className="text-text-muted">Postarea nu există.</Text>
        </View>
      </Screen>
    );
  }

  const author = post.profiles?.display_name ?? "—";
  const mine = post.author_id === myUserId;
  const when = format(new Date(post.created_at), "d MMM yyyy, HH:mm", {
    locale: ro,
  });
  const ago = formatDistanceToNow(new Date(post.created_at), {
    addSuffix: true,
    locale: ro,
  });

  return (
    <Screen padded={false}>
      <Header />
      <ScrollView contentContainerStyle={{ padding: 20, gap: 20, paddingBottom: 40 }}>
        <View className="gap-2">
          <View className="flex-row items-center gap-1.5">
            <Ionicons name={TYPE_ICON[post.type]} size={16} color="#7c5cff" />
            <Text className="text-accent text-xs font-medium uppercase tracking-wide">
              {t(`feed.postType.${post.type}`)}
            </Text>
          </View>
          <Text className="text-text text-2xl font-bold">{post.title}</Text>
          <Text className="text-text-muted text-xs">
            {mine ? "Tu" : author} · {when} · {ago}
          </Text>
        </View>

        {post.body ? (
          <Text className="text-text text-base leading-6">{post.body}</Text>
        ) : null}

        {post.type === "poll" ? (
          <PollDetail post={post} nameOf={nameOf} />
        ) : null}

        {post.type === "event" ? (
          <EventDetail post={post} nameOf={nameOf} />
        ) : null}

        <ReactionsList post={post} nameOf={nameOf} />

        {mine || isAdminHere ? (
          <View className="pt-6 border-t border-border mt-2">
            <Pressable
              onPress={() =>
                Alert.alert(
                  "Șterge post",
                  mine
                    ? "Postul tău se va șterge permanent."
                    : "Postul lui " + author + " se va șterge permanent.",
                  [
                    { text: "Anulează", style: "cancel" },
                    {
                      text: "Șterge",
                      style: "destructive",
                      onPress: () => remove.mutate(),
                    },
                  ],
                )
              }
              className="items-center py-3"
            >
              <Text className="text-red-400 font-medium">
                {remove.isPending
                  ? "Se șterge…"
                  : mine
                    ? "Șterge post"
                    : "Șterge post (admin)"}
              </Text>
            </Pressable>
          </View>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

function EventDetail({
  post,
  nameOf,
}: {
  post: FeedPost;
  nameOf: (userId: string) => string;
}) {
  const payload = (post.payload ?? {}) as Partial<{
    start_at: string;
    end_at: string;
    participants: string[];
  }>;
  if (!payload.start_at || !payload.end_at) return null;

  const start = new Date(payload.start_at);
  const end = new Date(payload.end_at);
  const sameDay = start.toDateString() === end.toDateString();
  const partIds = payload.participants ?? [];

  return (
    <View className="gap-3">
      <Text className="text-text-muted text-xs uppercase tracking-wide">
        Detalii eveniment
      </Text>

      <View className="bg-bg-card border border-border rounded-2xl p-4 gap-3">
        <View className="flex-row items-center gap-2">
          <Ionicons name="calendar-outline" size={18} color="#7c5cff" />
          <Text className="text-text font-medium flex-1">
            {sameDay
              ? format(start, "EEEE, d MMMM yyyy", { locale: ro })
              : `${format(start, "d MMM yyyy", { locale: ro })} → ${format(end, "d MMM yyyy", { locale: ro })}`}
          </Text>
        </View>
        <View className="flex-row items-center gap-2">
          <Ionicons name="time-outline" size={18} color="#7c5cff" />
          <Text className="text-text font-mono">
            {sameDay
              ? `${format(start, "HH:mm")} – ${format(end, "HH:mm")}`
              : `${format(start, "d MMM HH:mm")} – ${format(end, "d MMM HH:mm")}`}
          </Text>
        </View>
      </View>

      {partIds.length > 0 ? (
        <View className="gap-2">
          <Text className="text-text-muted text-xs uppercase tracking-wide">
            Participanți
          </Text>
          {partIds.map((pid) => (
            <View
              key={pid}
              className="bg-bg-card border border-border rounded-2xl p-3 flex-row items-center gap-3"
            >
              <View className="w-9 h-9 rounded-full bg-bg-elevated items-center justify-center">
                <Text className="text-text-muted font-medium">
                  {nameOf(pid).charAt(0).toUpperCase()}
                </Text>
              </View>
              <Text className="text-text flex-1">{nameOf(pid)}</Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

function Header() {
  return (
    <View className="px-5 pt-2 pb-3 flex-row items-center justify-between">
      <Pressable onPress={() => router.back()} hitSlop={8} className="flex-row items-center gap-1">
        <Ionicons name="chevron-back" size={22} color="#f4f4f6" />
        <Text className="text-text">Înapoi</Text>
      </Pressable>
      <Text className="text-text-muted text-xs">Detalii</Text>
    </View>
  );
}

function PollDetail({
  post,
  nameOf,
}: {
  post: FeedPost;
  nameOf: (userId: string) => string;
}) {
  const myUserId = useSession((s) => s.session?.user.id);
  const qc = useQueryClient();

  const options = useMemo<string[]>(() => {
    const raw = post.payload as { options?: unknown } | null;
    if (!raw || !Array.isArray(raw.options)) return [];
    return raw.options.filter((o): o is string => typeof o === "string");
  }, [post.payload]);

  const myVote = post.poll_votes.find((v) => v.user_id === myUserId);
  const total = post.poll_votes.length;

  const votersByIndex = useMemo(() => {
    const map = new Map<number, string[]>();
    for (const v of post.poll_votes) {
      const arr = map.get(v.option_index) ?? [];
      arr.push(v.user_id);
      map.set(v.option_index, arr);
    }
    return map;
  }, [post.poll_votes]);

  const m = useMutation({
    mutationFn: (idx: number) => voteOnPoll(post.id, idx),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["post", post.id] }),
    onError: (err) =>
      Alert.alert("Vot", err instanceof Error ? err.message : "Eroare"),
  });

  return (
    <View className="gap-3">
      <Text className="text-text-muted text-xs uppercase tracking-wide">
        Opțiuni
      </Text>
      {options.map((opt, idx) => {
        const voters = votersByIndex.get(idx) ?? [];
        const count = voters.length;
        const pct = total > 0 ? Math.round((count / total) * 100) : 0;
        const mine = myVote?.option_index === idx;
        return (
          <View
            key={idx}
            className={`rounded-2xl border ${mine ? "border-accent" : "border-border"} bg-bg-card overflow-hidden`}
          >
            <Pressable
              onPress={() => m.mutate(idx)}
              className="relative overflow-hidden"
            >
              <View
                style={{ width: `${pct}%` }}
                className={`absolute left-0 top-0 bottom-0 ${mine ? "bg-accent/30" : "bg-bg-elevated"}`}
              />
              <View className="px-4 py-3 flex-row items-center justify-between">
                <Text
                  className={`text-base flex-1 ${mine ? "text-text font-semibold" : "text-text"}`}
                >
                  {opt}
                </Text>
                <Text className="text-text-muted text-sm ml-2">
                  {count} · {pct}%
                </Text>
              </View>
            </Pressable>
            {voters.length > 0 ? (
              <View className="px-4 pb-3 pt-1 flex-row flex-wrap gap-1">
                {voters.map((vid) => (
                  <Text key={vid} className="text-text-muted text-xs">
                    {nameOf(vid)}
                    {voters.indexOf(vid) < voters.length - 1 ? "," : ""}
                  </Text>
                ))}
              </View>
            ) : null}
          </View>
        );
      })}
      <Text className="text-text-muted text-xs">
        Total:{" "}
        {total === 0
          ? t("feed.votes.zero")
          : total === 1
            ? t("feed.votes.one")
            : t("feed.votes.more", { count: total })}
      </Text>
    </View>
  );
}

function ReactionsList({
  post,
  nameOf,
}: {
  post: FeedPost;
  nameOf: (userId: string) => string;
}) {
  const grouped = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const r of post.reactions) {
      const arr = map.get(r.emoji) ?? [];
      arr.push(r.user_id);
      map.set(r.emoji, arr);
    }
    return Array.from(map.entries()).sort((a, b) => b[1].length - a[1].length);
  }, [post.reactions]);

  if (grouped.length === 0) {
    return (
      <View className="gap-2">
        <Text className="text-text-muted text-xs uppercase tracking-wide">
          Reacții
        </Text>
        <Text className="text-text-muted text-sm">Niciuna încă.</Text>
      </View>
    );
  }

  return (
    <View className="gap-2">
      <Text className="text-text-muted text-xs uppercase tracking-wide">
        Reacții
      </Text>
      {grouped.map(([emoji, users]) => (
        <View
          key={emoji}
          className="bg-bg-card border border-border rounded-2xl px-4 py-3 flex-row items-center gap-3"
        >
          <Text className="text-2xl">{emoji}</Text>
          <Text className="text-text-muted text-sm flex-1">
            {users.map((u) => nameOf(u)).join(", ")}
          </Text>
          <Text className="text-text-muted text-xs">{users.length}</Text>
        </View>
      ))}
    </View>
  );
}
