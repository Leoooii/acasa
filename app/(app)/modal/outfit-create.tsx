import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";

import { Screen } from "@/components/Screen";
import { Input } from "@/components/Input";
import { Button } from "@/components/Button";
import { RemoteImage } from "@/components/RemoteImage";
import { listClothingItems, type ClothingItem } from "@/features/closet/api";
import {
  COLOR_PRESETS,
  SEASONS,
  SEASON_LABELS,
  SLOT_LABELS,
  type Slot,
} from "@/features/closet/categories";
import { listColors } from "@/features/closet/api";
import {
  createOutfit,
  generateRandomOutfit,
} from "@/features/closet/outfits";
import { useActiveSpace } from "@/stores/activeSpace";
import { t } from "@/i18n";

const RANDOM_SLOTS: Slot[] = [
  "outerwear",
  "top",
  "bottom",
  "dress",
  "shoes",
  "socks",
  "accessory",
];

const MANUAL_SLOTS: Slot[] = [
  "outerwear",
  "top",
  "dress",
  "bottom",
  "shoes",
  "socks",
  "accessory",
  "underwear",
  "other",
];

const DEFAULT_SLOTS: Slot[] = ["top", "bottom", "shoes"];

export default function OutfitCreate() {
  const { mode = "random" } = useLocalSearchParams<{ mode?: string }>();
  const activeSpaceId = useActiveSpace((s) => s.activeSpaceId);
  const qc = useQueryClient();

  const { data: items } = useQuery({
    queryKey: ["closet", activeSpaceId, "all"],
    queryFn: () => listClothingItems(activeSpaceId!),
    enabled: !!activeSpaceId,
  });

  const { data: colors } = useQuery({
    queryKey: ["closet-colors", activeSpaceId],
    queryFn: () => listColors(activeSpaceId!),
    enabled: !!activeSpaceId,
  });

  const [selectedSlots, setSelectedSlots] = useState<Slot[]>(DEFAULT_SLOTS);
  const [colorFilter, setColorFilter] = useState<string | null>(null);
  const [seasonFilter, setSeasonFilter] =
    useState<(typeof SEASONS)[number]>("all");
  const [picked, setPicked] = useState<ClothingItem[]>([]);
  const [name, setName] = useState("");
  const [favorite, setFavorite] = useState(false);

  // Manual: picked per slot map
  const [pickerSlot, setPickerSlot] = useState<Slot | null>(null);

  function regenerate() {
    if (!items) return;
    const result = generateRandomOutfit(items, {
      slots: selectedSlots,
      color: colorFilter,
      season: seasonFilter,
    });
    setPicked(result);
  }

  useEffect(() => {
    if (mode === "random" && items && picked.length === 0) {
      regenerate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, mode]);

  const save = useMutation({
    mutationFn: () =>
      createOutfit({
        spaceId: activeSpaceId!,
        name: name.trim() || (mode === "random" ? "Outfit random" : "Outfit"),
        itemIds: picked.map((p) => p.id),
        isFavorite: favorite,
      }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["outfits", activeSpaceId] });
      router.back();
    },
    onError: (err) =>
      Alert.alert(
        "Eroare",
        err instanceof Error ? err.message : "Nu s-a putut",
      ),
  });

  function toggleSlot(s: Slot) {
    setSelectedSlots((prev) =>
      prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s],
    );
  }

  function setItemForSlot(s: Slot, item: ClothingItem) {
    setPicked((prev) => {
      const without = prev.filter((it) => it.slot !== s);
      return [...without, item];
    });
  }

  function removeItem(itemId: string) {
    setPicked((prev) => prev.filter((it) => it.id !== itemId));
  }

  return (
    <Screen>
      <View className="flex-row justify-between items-center pt-2 pb-3">
        <Text className="text-text text-xl font-bold">
          {mode === "random" ? "Random outfit" : "Creează outfit"}
        </Text>
        <Pressable onPress={() => router.back()}>
          <Text className="text-text-muted">{t("common.cancel")}</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 40, gap: 16 }}>
        {mode === "random" ? (
          <RandomControls
            selectedSlots={selectedSlots}
            toggleSlot={toggleSlot}
            colorFilter={colorFilter}
            setColorFilter={setColorFilter}
            seasonFilter={seasonFilter}
            setSeasonFilter={setSeasonFilter}
            availableColors={colors ?? []}
            onRegenerate={regenerate}
          />
        ) : (
          <ManualControls
            picked={picked}
            onOpenPicker={(s) => setPickerSlot(s)}
            onRemove={removeItem}
          />
        )}

        {picked.length > 0 ? (
          <View className="gap-2">
            <Text className="text-text-muted text-xs uppercase tracking-wide">
              Preview
            </Text>
            <View className="bg-bg-card border border-border rounded-2xl p-4 gap-3 items-center">
              {picked.map((it) => (
                <View
                  key={it.id}
                  className="w-48 aspect-square rounded-xl overflow-hidden bg-bg-elevated"
                >
                  <RemoteImage path={it.photo_path} className="w-full h-full" />
                </View>
              ))}
              {picked.map((it) => (
                <Text key={`l-${it.id}`} className="text-text-muted text-xs">
                  {it.name} {it.slot ? `· ${SLOT_LABELS[it.slot]}` : ""}
                </Text>
              ))}
            </View>
          </View>
        ) : (
          <View className="bg-bg-card border border-border rounded-2xl p-6 items-center">
            <Text className="text-text-muted text-center">
              {mode === "random"
                ? "Nu am găsit haine care să se potrivească. Încearcă alte filtre."
                : "Adaugă cel puțin un item."}
            </Text>
          </View>
        )}

        {picked.length > 0 ? (
          <View className="gap-3">
            <Input
              label="Nume outfit"
              placeholder={mode === "random" ? "Outfit random" : "Casual luni"}
              value={name}
              onChangeText={setName}
              maxLength={80}
            />
            <Pressable
              onPress={() => setFavorite((v) => !v)}
              className={`flex-row items-center gap-2 px-4 py-3 rounded-2xl border ${
                favorite
                  ? "bg-accent/15 border-accent"
                  : "bg-bg-card border-border"
              }`}
            >
              <Ionicons
                name={favorite ? "star" : "star-outline"}
                size={18}
                color={favorite ? "#fbbf24" : "#9a9aa8"}
              />
              <Text
                className={`text-sm ${favorite ? "text-text font-semibold" : "text-text-muted"}`}
              >
                Marchează ca preferat
              </Text>
            </Pressable>
            <Button
              label="Salvează outfit"
              onPress={() => save.mutate()}
              loading={save.isPending}
            />
          </View>
        ) : null}
      </ScrollView>

      <Modal
        visible={!!pickerSlot}
        animationType="slide"
        onRequestClose={() => setPickerSlot(null)}
      >
        {pickerSlot ? (
          <ItemPicker
            slot={pickerSlot}
            allItems={items ?? []}
            onPick={(it) => {
              setItemForSlot(pickerSlot, it);
              setPickerSlot(null);
            }}
            onClose={() => setPickerSlot(null)}
          />
        ) : (
          <View />
        )}
      </Modal>
    </Screen>
  );
}

function RandomControls({
  selectedSlots,
  toggleSlot,
  colorFilter,
  setColorFilter,
  seasonFilter,
  setSeasonFilter,
  availableColors,
  onRegenerate,
}: {
  selectedSlots: Slot[];
  toggleSlot: (s: Slot) => void;
  colorFilter: string | null;
  setColorFilter: (c: string | null) => void;
  seasonFilter: (typeof SEASONS)[number];
  setSeasonFilter: (s: (typeof SEASONS)[number]) => void;
  availableColors: string[];
  onRegenerate: () => void;
}) {
  const colors = useMemo(() => {
    const merged = new Set<string>([
      ...COLOR_PRESETS,
      ...availableColors.map((c) => c.toLowerCase()),
    ]);
    return Array.from(merged).sort();
  }, [availableColors]);

  return (
    <View className="gap-3">
      <View className="gap-2">
        <Text className="text-text-muted text-xs uppercase tracking-wide">
          Slot-uri
        </Text>
        <View className="flex-row flex-wrap gap-2">
          {RANDOM_SLOTS.map((s) => {
            const active = selectedSlots.includes(s);
            return (
              <Pressable
                key={s}
                onPress={() => toggleSlot(s)}
                className={`px-3 py-1.5 rounded-full border ${
                  active
                    ? "bg-accent border-accent"
                    : "bg-bg-card border-border"
                }`}
              >
                <Text
                  className={`text-xs font-medium ${active ? "text-white" : "text-text-muted"}`}
                >
                  {SLOT_LABELS[s]}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View className="gap-2">
        <Text className="text-text-muted text-xs uppercase tracking-wide">
          Culoare
        </Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 6 }}
        >
          <Pressable
            onPress={() => setColorFilter(null)}
            className={`px-3 py-1.5 rounded-full border ${
              colorFilter === null
                ? "bg-accent border-accent"
                : "bg-bg-card border-border"
            }`}
          >
            <Text
              className={`text-xs font-medium ${colorFilter === null ? "text-white" : "text-text-muted"}`}
            >
              Toate
            </Text>
          </Pressable>
          {colors.map((c) => (
            <Pressable
              key={c}
              onPress={() => setColorFilter(colorFilter === c ? null : c)}
              className={`px-3 py-1.5 rounded-full border ${
                colorFilter === c
                  ? "bg-accent border-accent"
                  : "bg-bg-card border-border"
              }`}
            >
              <Text
                className={`text-xs font-medium ${colorFilter === c ? "text-white" : "text-text-muted"}`}
              >
                {c}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      <View className="gap-2">
        <Text className="text-text-muted text-xs uppercase tracking-wide">
          Sezon
        </Text>
        <View className="flex-row flex-wrap gap-2">
          {SEASONS.map((s) => (
            <Pressable
              key={s}
              onPress={() => setSeasonFilter(s)}
              className={`px-3 py-1.5 rounded-full border ${
                seasonFilter === s
                  ? "bg-accent border-accent"
                  : "bg-bg-card border-border"
              }`}
            >
              <Text
                className={`text-xs font-medium ${seasonFilter === s ? "text-white" : "text-text-muted"}`}
              >
                {SEASON_LABELS[s]}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      <Pressable
        onPress={onRegenerate}
        className="bg-bg-card border border-border rounded-2xl py-3 items-center flex-row justify-center gap-2"
      >
        <Ionicons name="dice-outline" size={18} color="#7c5cff" />
        <Text className="text-accent font-semibold">Regenerează</Text>
      </Pressable>
    </View>
  );
}

function ManualControls({
  picked,
  onOpenPicker,
  onRemove,
}: {
  picked: ClothingItem[];
  onOpenPicker: (s: Slot) => void;
  onRemove: (id: string) => void;
}) {
  return (
    <View className="gap-2">
      <Text className="text-text-muted text-xs uppercase tracking-wide">
        Compoziție
      </Text>
      {MANUAL_SLOTS.map((s) => {
        const item = picked.find((it) => it.slot === s);
        return (
          <Pressable
            key={s}
            onPress={() => (item ? onRemove(item.id) : onOpenPicker(s))}
            className={`flex-row items-center gap-3 bg-bg-card border rounded-2xl p-3 ${
              item ? "border-accent/40" : "border-border"
            }`}
          >
            {item ? (
              <View className="w-12 h-12 rounded-lg overflow-hidden">
                <RemoteImage
                  path={item.photo_path}
                  className="w-full h-full"
                />
              </View>
            ) : (
              <View className="w-12 h-12 rounded-lg bg-bg-elevated items-center justify-center">
                <Ionicons name="add" size={20} color="#9a9aa8" />
              </View>
            )}
            <View className="flex-1">
              <Text className="text-text-muted text-xs uppercase tracking-wide">
                {SLOT_LABELS[s]}
              </Text>
              <Text className="text-text" numberOfLines={1}>
                {item?.name ?? "Adaugă item"}
              </Text>
            </View>
            {item ? (
              <Ionicons name="close-circle" size={20} color="#9a9aa8" />
            ) : (
              <Ionicons name="chevron-forward" size={18} color="#6b6b78" />
            )}
          </Pressable>
        );
      })}
    </View>
  );
}

function ItemPicker({
  slot,
  allItems,
  onPick,
  onClose,
}: {
  slot: Slot;
  allItems: ClothingItem[];
  onPick: (it: ClothingItem) => void;
  onClose: () => void;
}) {
  const filtered = allItems.filter((i) => i.slot === slot);
  return (
    <Screen padded={false}>
      <View className="px-5 pt-2 pb-3 flex-row items-center justify-between">
        <Pressable onPress={onClose} hitSlop={8}>
          <Text className="text-text">Anulează</Text>
        </Pressable>
        <Text className="text-text font-semibold">
          Alege {SLOT_LABELS[slot].toLowerCase()}
        </Text>
        <View style={{ width: 60 }} />
      </View>
      <FlatList
        data={filtered}
        numColumns={3}
        keyExtractor={(it) => it.id}
        contentContainerStyle={{ padding: 10, gap: 8 }}
        columnWrapperStyle={{ gap: 8 }}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => onPick(item)}
            className="flex-1 bg-bg-card border border-border rounded-xl overflow-hidden"
          >
            <View className="aspect-square">
              <RemoteImage path={item.photo_path} className="w-full h-full" />
            </View>
            <View className="px-2 py-1.5">
              <Text className="text-text text-xs font-semibold" numberOfLines={1}>
                {item.name}
              </Text>
            </View>
          </Pressable>
        )}
        ListEmptyComponent={
          <View className="items-center pt-12 px-5">
            <Text className="text-text-muted text-center">
              Niciun item în categoria asta. Adaugă unul în "Hainele mele".
            </Text>
          </View>
        }
      />
    </Screen>
  );
}
