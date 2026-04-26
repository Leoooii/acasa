import { useState } from "react";
import {
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { router } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";

import { Screen } from "@/components/Screen";
import { RemoteImage } from "@/components/RemoteImage";
import {
  listCategories,
  listClothingItems,
  listColors,
  type ClothingItem,
} from "@/features/closet/api";
import { SEASONS, SEASON_LABELS } from "@/features/closet/categories";
import { useActiveSpace } from "@/stores/activeSpace";
import { t } from "@/i18n";

export default function Closet() {
  const activeSpaceId = useActiveSpace((s) => s.activeSpaceId);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string | null>(null);
  const [color, setColor] = useState<string | null>(null);
  const [season, setSeason] = useState<(typeof SEASONS)[number] | null>(null);

  const { data: items, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["closet", activeSpaceId, search, category, color, season],
    queryFn: () =>
      listClothingItems(activeSpaceId!, {
        search,
        category,
        color,
        season: season === "all" ? null : season,
      }),
    enabled: !!activeSpaceId,
  });

  const { data: categories } = useQuery({
    queryKey: ["closet-categories", activeSpaceId],
    queryFn: () => listCategories(activeSpaceId!),
    enabled: !!activeSpaceId,
  });

  const { data: colors } = useQuery({
    queryKey: ["closet-colors", activeSpaceId],
    queryFn: () => listColors(activeSpaceId!),
    enabled: !!activeSpaceId,
  });

  return (
    <Screen padded={false}>
      <View className="px-5 pt-4 pb-2 flex-row items-center justify-between">
        <Text className="text-text text-2xl font-bold">{t("closet.title")}</Text>
        <View className="flex-row gap-2">
          <Pressable
            className="bg-bg-card border border-border rounded-full w-10 h-10 items-center justify-center"
            onPress={() => router.push("/(app)/outfits" as never)}
            hitSlop={8}
          >
            <Ionicons name="sparkles-outline" size={18} color="#7c5cff" />
          </Pressable>
          <Pressable
            className="bg-accent rounded-full w-10 h-10 items-center justify-center"
            onPress={() =>
              router.push("/(app)/modal/clothing-edit" as never)
            }
            hitSlop={8}
          >
            <Ionicons name="add" size={22} color="#fff" />
          </Pressable>
        </View>
      </View>

      <View className="px-5 pb-2">
        <View className="bg-bg-card border border-border rounded-2xl px-3 flex-row items-center gap-2">
          <Ionicons name="search" size={18} color="#6b6b78" />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder={t("closet.searchPlaceholder")}
            placeholderTextColor="#6b6b78"
            className="flex-1 text-text py-3"
          />
          {search ? (
            <Pressable onPress={() => setSearch("")} hitSlop={6}>
              <Ionicons name="close-circle" size={18} color="#6b6b78" />
            </Pressable>
          ) : null}
        </View>
      </View>

      {(categories?.length ?? 0) > 0 ? (
        <FilterStrip
          values={categories ?? []}
          active={category}
          onChange={setCategory}
        />
      ) : null}
      {(colors?.length ?? 0) > 0 ? (
        <FilterStrip values={colors ?? []} active={color} onChange={setColor} />
      ) : null}
      <FilterStrip
        values={SEASONS.filter((s) => s !== "all").map((s) => s)}
        active={season}
        onChange={(v) =>
          setSeason((v as (typeof SEASONS)[number] | null) ?? null)
        }
        renderLabel={(v) =>
          SEASON_LABELS[v as (typeof SEASONS)[number]] ?? v
        }
      />

      <FlatList
        data={items ?? []}
        key="grid-3"
        numColumns={3}
        keyExtractor={(it) => it.id}
        contentContainerStyle={{ padding: 10, gap: 8 }}
        columnWrapperStyle={{ gap: 8 }}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching && !isLoading}
            onRefresh={refetch}
            tintColor="#7c5cff"
          />
        }
        renderItem={({ item }) => <ItemCard item={item} />}
        ListEmptyComponent={
          !isLoading ? (
            <View className="items-center pt-20 px-5">
              <Text className="text-text-muted text-center">
                {t("closet.empty")}
              </Text>
            </View>
          ) : null
        }
      />
    </Screen>
  );
}

function FilterStrip({
  values,
  active,
  onChange,
  renderLabel,
}: {
  values: string[];
  active: string | null;
  onChange: (v: string | null) => void;
  renderLabel?: (v: string) => string;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ paddingHorizontal: 20, gap: 6 }}
      className="pb-2 max-h-10"
    >
      <Chip
        label={t("closet.all")}
        active={active === null}
        onPress={() => onChange(null)}
      />
      {values.map((v) => (
        <Chip
          key={v}
          label={renderLabel ? renderLabel(v) : v}
          active={active === v}
          onPress={() => onChange(active === v ? null : v)}
        />
      ))}
    </ScrollView>
  );
}

function Chip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      className={`px-3 py-1.5 rounded-full border ${
        active ? "bg-accent border-accent" : "bg-bg-card border-border"
      }`}
    >
      <Text
        className={`text-xs font-medium ${active ? "text-white" : "text-text-muted"}`}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function ItemCard({ item }: { item: ClothingItem }) {
  return (
    <Pressable
      onPress={() =>
        router.push(`/(app)/modal/clothing-edit?id=${item.id}` as never)
      }
      className="flex-1 bg-bg-card border border-border rounded-xl overflow-hidden"
    >
      <View className="aspect-square">
        <RemoteImage path={item.photo_path} className="w-full h-full" />
      </View>
      <View className="px-2 py-1.5 gap-0.5">
        <Text className="text-text text-xs font-semibold" numberOfLines={1}>
          {item.name}
        </Text>
        <Text className="text-text-muted text-[10px]" numberOfLines={1}>
          {[item.size, item.color].filter(Boolean).join(" · ") || "—"}
        </Text>
      </View>
    </Pressable>
  );
}
