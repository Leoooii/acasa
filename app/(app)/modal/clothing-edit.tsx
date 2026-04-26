import { useEffect, useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  Text,
  View,
  ActivityIndicator,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";

import { Screen } from "@/components/Screen";
import { Input } from "@/components/Input";
import { Button } from "@/components/Button";
import { RemoteImage } from "@/components/RemoteImage";
import {
  createClothingItem,
  deleteClothingItem,
  getClothingItem,
  updateClothingItem,
  type ClothingDraft,
} from "@/features/closet/api";
import {
  CATEGORY_PRESETS,
  COLOR_PRESETS,
  SEASONS,
  SLOTS,
  SLOT_LABELS,
  findPreset,
  type Slot,
} from "@/features/closet/categories";
import {
  deleteClothingPhoto,
  pickFromCamera,
  pickFromLibrary,
  uploadClothingPhoto,
  type PickedPhoto,
} from "@/features/closet/photo";
import { useActiveSpace } from "@/stores/activeSpace";
import { Image } from "expo-image";
import { t } from "@/i18n";

export default function ClothingEdit() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const editing = !!id;
  const activeSpaceId = useActiveSpace((s) => s.activeSpaceId);
  const qc = useQueryClient();

  const { data: existing, isLoading } = useQuery({
    queryKey: ["closet-item", id],
    queryFn: () => getClothingItem(id!),
    enabled: !!id,
  });

  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [slot, setSlot] = useState<Slot | null>(null);
  const [showCustomCategory, setShowCustomCategory] = useState(false);
  const [size, setSize] = useState("");
  const [color, setColor] = useState("");
  const [season, setSeason] = useState<(typeof SEASONS)[number] | null>(null);
  const [pairCount, setPairCount] = useState("1");
  const [photoPath, setPhotoPath] = useState<string | null>(null);
  const [pendingPhoto, setPendingPhoto] = useState<PickedPhoto | null>(null);

  useEffect(() => {
    if (!existing) return;
    setName(existing.name);
    setCategory(existing.category ?? "");
    setSlot(existing.slot ?? null);
    if (existing.category && !findPreset(existing.category)) {
      setShowCustomCategory(true);
    }
    setSize(existing.size ?? "");
    setColor(existing.color ?? "");
    setSeason(
      (SEASONS as readonly string[]).includes(existing.season ?? "")
        ? ((existing.season ?? null) as (typeof SEASONS)[number] | null)
        : null,
    );
    setPairCount(String(existing.pair_count));
    setPhotoPath(existing.photo_path);
  }, [existing]);

  function pickPreset(label: string, presetSlot: Slot) {
    setCategory(label);
    setSlot(presetSlot);
    setShowCustomCategory(false);
    if (!name.trim()) setName(label);
  }

  const save = useMutation({
    mutationFn: async () => {
      if (!activeSpaceId) throw new Error("no_active_space");
      const draft: ClothingDraft = {
        name: name.trim(),
        category: category.trim() || null,
        slot,
        size: size.trim() || null,
        color: color.trim() || null,
        season,
        pair_count: Math.max(1, Math.min(99, parseInt(pairCount, 10) || 1)),
        photo_path: photoPath,
      };

      let itemId = id;
      if (editing && itemId) {
        await updateClothingItem(itemId, draft);
      } else {
        itemId = await createClothingItem(activeSpaceId, draft);
      }

      if (pendingPhoto && itemId) {
        const newPath = await uploadClothingPhoto(itemId, pendingPhoto);
        await updateClothingItem(itemId, { photo_path: newPath });
      }
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["closet"] });
      await qc.invalidateQueries({ queryKey: ["closet-categories"] });
      if (id) await qc.invalidateQueries({ queryKey: ["closet-item", id] });
      router.back();
    },
    onError: (err) =>
      Alert.alert(
        "Eroare",
        err instanceof Error ? err.message : "Nu s-a putut salva",
      ),
  });

  const remove = useMutation({
    mutationFn: async () => {
      if (!id) return;
      if (existing?.photo_path) {
        try {
          await deleteClothingPhoto(existing.photo_path);
        } catch {
          /* ignorăm eroarea de storage */
        }
      }
      await deleteClothingItem(id);
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["closet"] });
      await qc.invalidateQueries({ queryKey: ["closet-categories"] });
      router.back();
    },
    onError: (err) =>
      Alert.alert(
        "Eroare",
        err instanceof Error ? err.message : "Nu s-a putut șterge",
      ),
  });

  function pickPhoto(source: "camera" | "library") {
    (source === "camera" ? pickFromCamera() : pickFromLibrary()).then((p) => {
      if (p) setPendingPhoto(p);
    });
  }

  function clearPhoto() {
    setPendingPhoto(null);
    setPhotoPath(null);
  }

  if (editing && isLoading) {
    return (
      <Screen>
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#7c5cff" />
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <View className="flex-row justify-between items-center pt-2 pb-3">
        <Text className="text-text text-xl font-bold">
          {editing ? t("closet.editTitle") : t("closet.addTitle")}
        </Text>
        <Pressable onPress={() => router.back()}>
          <Text className="text-text-muted">{t("common.cancel")}</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 40, gap: 16 }}>
        <View className="items-center gap-3">
          <View className="w-40 h-40 rounded-2xl overflow-hidden bg-bg-card border border-border items-center justify-center">
            {pendingPhoto ? (
              <Image
                source={{ uri: pendingPhoto.uri }}
                style={{ width: "100%", height: "100%" }}
                contentFit="cover"
              />
            ) : photoPath ? (
              <RemoteImage path={photoPath} className="w-full h-full" />
            ) : (
              <Ionicons name="shirt-outline" size={48} color="#6b6b78" />
            )}
          </View>
          <View className="flex-row gap-2">
            <Pressable
              onPress={() => pickPhoto("camera")}
              className="bg-bg-card border border-border rounded-xl px-3 py-2 flex-row items-center gap-1.5"
            >
              <Ionicons name="camera-outline" size={16} color="#f4f4f6" />
              <Text className="text-text text-sm">
                {t("closet.photoFromCamera")}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => pickPhoto("library")}
              className="bg-bg-card border border-border rounded-xl px-3 py-2 flex-row items-center gap-1.5"
            >
              <Ionicons name="images-outline" size={16} color="#f4f4f6" />
              <Text className="text-text text-sm">
                {t("closet.photoFromLibrary")}
              </Text>
            </Pressable>
            {pendingPhoto || photoPath ? (
              <Pressable
                onPress={clearPhoto}
                className="bg-bg-card border border-border rounded-xl px-3 py-2 flex-row items-center"
              >
                <Ionicons name="trash-outline" size={16} color="#9a9aa8" />
              </Pressable>
            ) : null}
          </View>
        </View>

        <Input
          label={t("closet.name")}
          value={name}
          onChangeText={setName}
          autoCapitalize="sentences"
        />

        <View className="gap-2">
          <Text className="text-text-muted text-sm font-medium">
            {t("closet.category")}
          </Text>
          <View className="flex-row flex-wrap gap-2">
            {CATEGORY_PRESETS.map((p) => {
              const active = !showCustomCategory && category === p.label;
              return (
                <Pressable
                  key={p.label}
                  onPress={() => pickPreset(p.label, p.slot)}
                  className={`flex-row items-center gap-1.5 px-3 py-2 rounded-xl border ${
                    active
                      ? "bg-accent border-accent"
                      : "bg-bg-card border-border"
                  }`}
                >
                  <Text>{p.emoji}</Text>
                  <Text
                    className={`text-xs font-medium ${active ? "text-white" : "text-text-muted"}`}
                  >
                    {p.label}
                  </Text>
                </Pressable>
              );
            })}
            <Pressable
              onPress={() => {
                setShowCustomCategory(true);
                setCategory("");
              }}
              className={`flex-row items-center gap-1.5 px-3 py-2 rounded-xl border ${
                showCustomCategory
                  ? "bg-accent border-accent"
                  : "bg-bg-card border-border"
              }`}
            >
              <Ionicons
                name="create-outline"
                size={14}
                color={showCustomCategory ? "#fff" : "#9a9aa8"}
              />
              <Text
                className={`text-xs font-medium ${showCustomCategory ? "text-white" : "text-text-muted"}`}
              >
                Personalizat
              </Text>
            </Pressable>
          </View>
          {showCustomCategory ? (
            <View className="gap-2 pt-1">
              <Input
                placeholder={t("closet.categoryPlaceholder")}
                value={category}
                onChangeText={setCategory}
              />
              <View className="flex-row flex-wrap gap-2">
                {SLOTS.map((s) => (
                  <Pressable
                    key={s}
                    onPress={() => setSlot(s)}
                    className={`px-3 py-1.5 rounded-full border ${
                      slot === s
                        ? "bg-accent/20 border-accent"
                        : "bg-bg-card border-border"
                    }`}
                  >
                    <Text
                      className={`text-xs ${slot === s ? "text-accent font-semibold" : "text-text-muted"}`}
                    >
                      {SLOT_LABELS[s]}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          ) : null}
        </View>

        <View className="flex-row gap-3">
          <View className="flex-1">
            <Input
              label={t("closet.size")}
              placeholder={t("closet.sizePlaceholder")}
              value={size}
              onChangeText={setSize}
            />
          </View>
          <View className="flex-1">
            <Input
              label={t("closet.color")}
              placeholder={t("closet.colorPlaceholder")}
              value={color}
              onChangeText={setColor}
            />
          </View>
        </View>
        <View className="flex-row flex-wrap gap-1.5">
          {COLOR_PRESETS.map((c) => {
            const active = color.trim().toLowerCase() === c;
            return (
              <Pressable
                key={c}
                onPress={() => setColor(c)}
                className={`px-2.5 py-1 rounded-full border ${
                  active
                    ? "bg-accent/20 border-accent"
                    : "bg-bg-card border-border"
                }`}
              >
                <Text
                  className={`text-xs ${active ? "text-accent font-semibold" : "text-text-muted"}`}
                >
                  {c}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View className="gap-2">
          <Text className="text-text-muted text-sm font-medium">
            {t("closet.season")}
          </Text>
          <View className="flex-row gap-2 flex-wrap">
            {SEASONS.map((s) => (
              <Pressable
                key={s}
                onPress={() => setSeason(season === s ? null : s)}
                className={`px-3 py-2 rounded-full border ${
                  season === s
                    ? "bg-accent border-accent"
                    : "bg-bg-card border-border"
                }`}
              >
                <Text
                  className={`text-xs font-medium ${
                    season === s ? "text-white" : "text-text-muted"
                  }`}
                >
                  {t(`closet.seasons.${s}`)}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        <Input
          label={t("closet.pairCount")}
          value={pairCount}
          onChangeText={setPairCount}
          keyboardType="number-pad"
          maxLength={2}
        />

        <Button
          label={t("closet.save")}
          onPress={() => save.mutate()}
          loading={save.isPending}
          disabled={!name.trim() || save.isPending}
        />

        {editing ? (
          <Pressable
            onPress={() =>
              Alert.alert(t("closet.delete"), "Ireversibil.", [
                { text: t("common.cancel"), style: "cancel" },
                {
                  text: t("closet.delete"),
                  style: "destructive",
                  onPress: () => remove.mutate(),
                },
              ])
            }
            className="items-center py-3"
          >
            <Text className="text-red-400">{t("closet.delete")}</Text>
          </Pressable>
        ) : null}
      </ScrollView>
    </Screen>
  );
}
