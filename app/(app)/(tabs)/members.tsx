import { useEffect } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from "react-native";
import { router } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { formatDistanceToNow } from "date-fns";
import { ro } from "date-fns/locale";

import { Screen } from "@/components/Screen";
import { Avatar } from "@/components/Avatar";
import {
  listSpaceMembers,
  type SpaceMember,
} from "@/features/spaces/api";
import { useActiveSpace } from "@/stores/activeSpace";
import { useSession } from "@/stores/session";
import { supabase } from "@/api/supabase";

export default function Members() {
  const activeSpaceId = useActiveSpace((s) => s.activeSpaceId);
  const myUserId = useSession((s) => s.session?.user.id);
  const qc = useQueryClient();

  const { data: members, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["members", activeSpaceId],
    queryFn: () => listSpaceMembers(activeSpaceId!),
    enabled: !!activeSpaceId,
  });

  useEffect(() => {
    if (!activeSpaceId) return;
    const rnd = Math.floor(Math.random() * 1e9);
    const channel = supabase
      .channel(`members:${activeSpaceId}:${rnd}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "profiles" },
        () => qc.invalidateQueries({ queryKey: ["members", activeSpaceId] }),
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "space_members",
          filter: `space_id=eq.${activeSpaceId}`,
        },
        () => qc.invalidateQueries({ queryKey: ["members", activeSpaceId] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeSpaceId, qc]);

  const me = members?.find((m) => m.user_id === myUserId);
  const others = (members ?? []).filter((m) => m.user_id !== myUserId);

  return (
    <Screen padded={false}>
      <ScrollView
        contentContainerStyle={{ padding: 20, gap: 12, paddingBottom: 40 }}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching && !isLoading}
            onRefresh={refetch}
            tintColor="#7c5cff"
          />
        }
      >
        <Text className="text-text text-2xl font-bold">Membri</Text>

        {isLoading ? (
          <View className="items-center pt-12">
            <ActivityIndicator color="#7c5cff" />
          </View>
        ) : null}

        {me ? (
          <View>
            <Text className="text-text-muted text-xs uppercase tracking-wide mb-2">
              Tu
            </Text>
            <MemberCard member={me} editable />
          </View>
        ) : null}

        {others.length > 0 ? (
          <View>
            <Text className="text-text-muted text-xs uppercase tracking-wide mb-2 mt-3">
              Restul
            </Text>
            <View className="gap-2">
              {others.map((mm) => (
                <MemberCard key={mm.user_id} member={mm} editable={false} />
              ))}
            </View>
          </View>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

function MemberCard({
  member,
  editable,
}: {
  member: SpaceMember;
  editable: boolean;
}) {
  const name = member.profiles?.display_name ?? "—";
  const icon = member.profiles?.status_icon ?? null;
  const avatarPath = member.profiles?.avatar_url ?? null;
  const text = member.profiles?.status_text ?? null;
  const updated = member.profiles?.status_updated_at;
  const updatedAgo = updated
    ? formatDistanceToNow(new Date(updated), { addSuffix: true, locale: ro })
    : null;

  const Wrapper = editable ? Pressable : View;
  return (
    <Wrapper
      onPress={
        editable
          ? () => router.push("/(app)/modal/status-edit" as never)
          : undefined
      }
      className={`bg-bg-card border rounded-2xl p-4 flex-row items-center gap-4 ${
        editable ? "border-accent/40 bg-accent/5" : "border-border"
      }`}
    >
      <Avatar
        avatarPath={avatarPath}
        displayName={name}
        statusIcon={icon}
        size={56}
      />
      <View className="flex-1 gap-0.5">
        <View className="flex-row items-center gap-1.5">
          <Text className="text-text font-semibold">
            {name}
            {member.role === "admin" ? (
              <Text className="text-text-muted text-xs"> · admin</Text>
            ) : null}
          </Text>
        </View>
        <Text className="text-text" numberOfLines={2}>
          {text ?? (icon ? "" : "Niciun status setat")}
        </Text>
        {updatedAgo ? (
          <Text className="text-text-muted text-xs">
            actualizat {updatedAgo}
          </Text>
        ) : null}
      </View>
      {editable ? (
        <Ionicons name="pencil-outline" size={18} color="#9a9aa8" />
      ) : null}
    </Wrapper>
  );
}
