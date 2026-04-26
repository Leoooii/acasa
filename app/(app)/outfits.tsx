import { useEffect } from "react";
import {
  FlatList,
  Pressable,
  RefreshControl,
  Text,
  View,
} from "react-native";
import { router } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { formatDistanceToNow } from "date-fns";
import { ro } from "date-fns/locale";

import { Screen } from "@/components/Screen";
import { RemoteImage } from "@/components/RemoteImage";
import {
  listOutfitsWithItems,
  type OutfitWithItems,
} from "@/features/closet/outfits";
import { useActiveSpace } from "@/stores/activeSpace";
import { supabase } from "@/api/supabase";

export default function OutfitsScreen() {
  const activeSpaceId = useActiveSpace((s) => s.activeSpaceId);
  const qc = useQueryClient();

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["outfits", activeSpaceId],
    queryFn: () => listOutfitsWithItems(activeSpaceId!),
    enabled: !!activeSpaceId,
  });

  useEffect(() => {
    if (!activeSpaceId) return;
    const rnd = Math.floor(Math.random() * 1e9);
    const channel = supabase
      .channel(`outfits:${activeSpaceId}:${rnd}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "outfits" },
        () => qc.invalidateQueries({ queryKey: ["outfits", activeSpaceId] }),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "outfit_items" },
        () => qc.invalidateQueries({ queryKey: ["outfits", activeSpaceId] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeSpaceId, qc]);

  return (
    <Screen padded={false}>
      <View className="px-5 pt-2 pb-3 flex-row items-center justify-between">
        <Pressable
          onPress={() => router.back()}
          hitSlop={8}
          className="flex-row items-center gap-1"
        >
          <Ionicons name="chevron-back" size={22} color="#f4f4f6" />
          <Text className="text-text">Înapoi</Text>
        </Pressable>
        <Text className="text-text font-semibold">Outfits</Text>
        <View style={{ width: 60 }} />
      </View>

      <View className="px-5 pb-3 flex-row gap-2">
        <Pressable
          onPress={() =>
            router.push("/(app)/modal/outfit-create?mode=random" as never)
          }
          className="flex-1 bg-accent rounded-2xl py-3 items-center flex-row justify-center gap-2"
        >
          <Ionicons name="dice-outline" size={18} color="#fff" />
          <Text className="text-white font-semibold">Random</Text>
        </Pressable>
        <Pressable
          onPress={() =>
            router.push("/(app)/modal/outfit-create?mode=manual" as never)
          }
          className="flex-1 bg-bg-card border border-border rounded-2xl py-3 items-center flex-row justify-center gap-2"
        >
          <Ionicons name="add-circle-outline" size={18} color="#7c5cff" />
          <Text className="text-text font-semibold">Manual</Text>
        </Pressable>
      </View>

      <FlatList
        data={data ?? []}
        keyExtractor={(o) => o.id}
        contentContainerStyle={{ padding: 20, gap: 12, paddingBottom: 40 }}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching && !isLoading}
            onRefresh={refetch}
            tintColor="#7c5cff"
          />
        }
        renderItem={({ item }) => <OutfitRow outfit={item} />}
        ListEmptyComponent={
          !isLoading ? (
            <View className="items-center pt-12">
              <Text className="text-text-muted text-center">
                Niciun outfit salvat încă.{"\n"}Apasă Random sau Manual.
              </Text>
            </View>
          ) : null
        }
      />
    </Screen>
  );
}

function OutfitRow({ outfit }: { outfit: OutfitWithItems }) {
  const ago = formatDistanceToNow(new Date(outfit.created_at), {
    addSuffix: true,
    locale: ro,
  });
  return (
    <Pressable
      onPress={() => router.push(`/(app)/outfit/${outfit.id}` as never)}
      className="bg-bg-card border border-border rounded-2xl p-3 gap-3"
    >
      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center gap-1.5 flex-1">
          {outfit.is_favorite ? (
            <Ionicons name="star" size={14} color="#fbbf24" />
          ) : null}
          <Text
            className="text-text font-semibold flex-1"
            numberOfLines={1}
          >
            {outfit.name}
          </Text>
        </View>
        <Text className="text-text-muted text-xs">{ago}</Text>
      </View>
      <View className="flex-row gap-1.5">
        {outfit.items.slice(0, 4).map((it) => (
          <View
            key={it.id}
            className="flex-1 aspect-square rounded-lg overflow-hidden"
          >
            <RemoteImage path={it.photo_path} className="w-full h-full" />
          </View>
        ))}
        {outfit.items.length > 4 ? (
          <View className="absolute right-2 bottom-2 bg-black/70 rounded-full px-2 py-0.5">
            <Text className="text-white text-xs">+{outfit.items.length - 4}</Text>
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}
