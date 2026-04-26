import { useEffect, useState } from "react";
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

import { Screen } from "@/components/Screen";
import { Input } from "@/components/Input";
import { Button } from "@/components/Button";
import {
  SHOPPING_CATEGORIES,
  deleteShoppingItem,
  getShoppingItem,
  updateShoppingItem,
} from "@/features/shopping/api";
import { useActiveSpace } from "@/stores/activeSpace";
import { t } from "@/i18n";

export default function ShoppingEdit() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const activeSpaceId = useActiveSpace((s) => s.activeSpaceId);
  const qc = useQueryClient();

  const { data: existing, isLoading } = useQuery({
    queryKey: ["shopping-item", id],
    queryFn: () => getShoppingItem(id!),
    enabled: !!id,
  });

  const [name, setName] = useState("");
  const [quantity, setQuantity] = useState("");
  const [category, setCategory] = useState<string | null>(null);

  useEffect(() => {
    if (!existing) return;
    setName(existing.name);
    setQuantity(existing.quantity ?? "");
    setCategory(existing.category ?? null);
  }, [existing]);

  const save = useMutation({
    mutationFn: () =>
      updateShoppingItem(id!, {
        name,
        quantity: quantity || null,
        category,
      }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["shopping", activeSpaceId] });
      await qc.invalidateQueries({ queryKey: ["shopping-item", id] });
      router.back();
    },
    onError: (err) =>
      Alert.alert(
        "Eroare",
        err instanceof Error ? err.message : "Nu s-a putut",
      ),
  });

  const remove = useMutation({
    mutationFn: () => deleteShoppingItem(id!),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["shopping", activeSpaceId] });
      router.back();
    },
  });

  if (isLoading || !existing) {
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
        <Text className="text-text text-xl font-bold">Editează item</Text>
        <Pressable onPress={() => router.back()}>
          <Text className="text-text-muted">{t("common.cancel")}</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 40, gap: 16 }}>
        <Input
          label="Nume"
          value={name}
          onChangeText={setName}
          autoCapitalize="sentences"
          maxLength={80}
        />
        <Input
          label="Cantitate (opțional)"
          placeholder="2 kg, 1 buc, 500 ml…"
          value={quantity}
          onChangeText={setQuantity}
        />

        <View className="gap-2">
          <Text className="text-text-muted text-sm font-medium">Categorie</Text>
          <View className="flex-row flex-wrap gap-2">
            <Pressable
              onPress={() => setCategory(null)}
              className={`px-3 py-2 rounded-xl border ${category === null ? "bg-accent border-accent" : "bg-bg-card border-border"}`}
            >
              <Text
                className={`text-xs font-medium ${category === null ? "text-white" : "text-text-muted"}`}
              >
                Fără
              </Text>
            </Pressable>
            {SHOPPING_CATEGORIES.map((c) => {
              const active = category === c.label;
              return (
                <Pressable
                  key={c.label}
                  onPress={() => setCategory(c.label)}
                  className={`flex-row items-center gap-1 px-3 py-2 rounded-xl border ${active ? "bg-accent border-accent" : "bg-bg-card border-border"}`}
                >
                  <Text>{c.emoji}</Text>
                  <Text
                    className={`text-xs font-medium ${active ? "text-white" : "text-text-muted"}`}
                  >
                    {c.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <Button
          label={t("closet.save")}
          onPress={() => save.mutate()}
          loading={save.isPending}
          disabled={!name.trim() || save.isPending}
        />

        <Pressable
          onPress={() =>
            Alert.alert("Șterge item", "Sigur?", [
              { text: t("common.cancel"), style: "cancel" },
              {
                text: "Șterge",
                style: "destructive",
                onPress: () => remove.mutate(),
              },
            ])
          }
          className="items-center py-3"
        >
          <Text className="text-red-400">Șterge item</Text>
        </Pressable>
      </ScrollView>
    </Screen>
  );
}
