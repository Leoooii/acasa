import { useEffect } from "react";
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
import { format } from "date-fns";
import { ro } from "date-fns/locale";

import { Screen } from "@/components/Screen";
import { RemoteImage } from "@/components/RemoteImage";
import {
  deleteOutfit,
  getOutfit,
  setFavorite,
} from "@/features/closet/outfits";
import { SLOT_LABELS } from "@/features/closet/categories";
import { useActiveSpace } from "@/stores/activeSpace";
import { supabase } from "@/api/supabase";

export default function OutfitDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const activeSpaceId = useActiveSpace((s) => s.activeSpaceId);
  const qc = useQueryClient();

  const { data: outfit, isLoading } = useQuery({
    queryKey: ["outfit", id],
    queryFn: () => getOutfit(id!),
    enabled: !!id,
  });

  useEffect(() => {
    if (!id) return;
    const rnd = Math.floor(Math.random() * 1e9);
    const channel = supabase
      .channel(`outfit:${id}:${rnd}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "outfits", filter: `id=eq.${id}` },
        () => qc.invalidateQueries({ queryKey: ["outfit", id] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [id, qc]);

  const fav = useMutation({
    mutationFn: () => setFavorite(id!, !outfit?.is_favorite),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["outfit", id] });
      qc.invalidateQueries({ queryKey: ["outfits", activeSpaceId] });
    },
  });

  const remove = useMutation({
    mutationFn: () => deleteOutfit(id!),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["outfits", activeSpaceId] });
      router.back();
    },
    onError: (err) =>
      Alert.alert(
        "Eroare",
        err instanceof Error ? err.message : "Nu s-a putut",
      ),
  });

  if (isLoading || !outfit) {
    return (
      <Screen>
        <Header right={null} />
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#7c5cff" />
        </View>
      </Screen>
    );
  }

  const created = format(new Date(outfit.created_at), "d MMM yyyy, HH:mm", {
    locale: ro,
  });

  return (
    <Screen padded={false}>
      <Header
        right={
          <View className="flex-row items-center gap-2">
            <Pressable onPress={() => fav.mutate()} hitSlop={8}>
              <Ionicons
                name={outfit.is_favorite ? "star" : "star-outline"}
                size={22}
                color={outfit.is_favorite ? "#fbbf24" : "#9a9aa8"}
              />
            </Pressable>
            <Pressable
              onPress={() =>
                Alert.alert("Șterge outfit", "Ireversibil.", [
                  { text: "Anulează", style: "cancel" },
                  {
                    text: "Șterge",
                    style: "destructive",
                    onPress: () => remove.mutate(),
                  },
                ])
              }
              hitSlop={8}
            >
              <Ionicons name="trash-outline" size={20} color="#9a9aa8" />
            </Pressable>
          </View>
        }
      />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40, gap: 12 }}>
        <View className="gap-1 pt-1">
          <Text className="text-text text-2xl font-bold">{outfit.name}</Text>
          <Text className="text-text-muted text-xs">Salvat {created}</Text>
        </View>

        <View className="bg-bg-card border border-border rounded-2xl py-5 px-3 items-center gap-4">
          {outfit.items.length === 0 ? (
            <Text className="text-text-muted">Outfit gol.</Text>
          ) : null}
          {outfit.items.map((it) => (
            <View key={it.id} className="items-center gap-1.5 w-full">
              <View className="w-56 aspect-square rounded-2xl overflow-hidden bg-bg-elevated">
                <RemoteImage path={it.photo_path} className="w-full h-full" />
              </View>
              <Text className="text-text font-medium">{it.name}</Text>
              <Text className="text-text-muted text-xs">
                {[
                  it.slot ? SLOT_LABELS[it.slot] : null,
                  it.size,
                  it.color,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </Screen>
  );
}

function Header({ right }: { right: React.ReactNode }) {
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
      <Text className="text-text font-semibold">Outfit</Text>
      <View style={{ width: 80, alignItems: "flex-end" }}>{right}</View>
    </View>
  );
}
