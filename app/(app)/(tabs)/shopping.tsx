import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { router } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { formatDistanceToNow } from "date-fns";
import { ro } from "date-fns/locale";

import { Screen } from "@/components/Screen";
import {
  SHOPPING_CATEGORIES,
  createShoppingItem,
  deleteAllDone,
  deleteShoppingItem,
  listShoppingItems,
  toggleShoppingItem,
  type ShoppingItem,
} from "@/features/shopping/api";
import { useActiveSpace } from "@/stores/activeSpace";
import { useSession } from "@/stores/session";
import { supabase } from "@/api/supabase";

export default function Shopping() {
  const activeSpaceId = useActiveSpace((s) => s.activeSpaceId);
  const qc = useQueryClient();
  const myUserId = useSession((s) => s.session?.user.id);

  const { data: items, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["shopping", activeSpaceId],
    queryFn: () => listShoppingItems(activeSpaceId!),
    enabled: !!activeSpaceId,
  });

  useEffect(() => {
    if (!activeSpaceId) return;
    const rnd = Math.floor(Math.random() * 1e9);
    const channel = supabase
      .channel(`shopping:${activeSpaceId}:${rnd}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "shopping_items",
          filter: `space_id=eq.${activeSpaceId}`,
        },
        () => qc.invalidateQueries({ queryKey: ["shopping", activeSpaceId] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeSpaceId, qc]);

  const [name, setName] = useState("");
  const [category, setCategory] = useState<string | null>(null);

  const add = useMutation({
    mutationFn: () =>
      createShoppingItem(activeSpaceId!, {
        name,
        quantity: null,
        category,
      }),
    onSuccess: () => {
      setName("");
      qc.invalidateQueries({ queryKey: ["shopping", activeSpaceId] });
    },
    onError: (err) =>
      Alert.alert(
        "Eroare",
        err instanceof Error ? err.message : "Nu s-a putut",
      ),
  });

  const toggle = useMutation({
    mutationFn: ({ id, done }: { id: string; done: boolean }) =>
      toggleShoppingItem(id, done),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["shopping", activeSpaceId] }),
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteShoppingItem(id),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["shopping", activeSpaceId] }),
  });

  const clearDone = useMutation({
    mutationFn: () => deleteAllDone(activeSpaceId!),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["shopping", activeSpaceId] }),
  });

  const { pending, done } = useMemo(() => {
    const p: ShoppingItem[] = [];
    const d: ShoppingItem[] = [];
    for (const it of items ?? []) {
      (it.is_done ? d : p).push(it);
    }
    return { pending: p, done: d };
  }, [items]);

  const grouped = useMemo(() => {
    const map = new Map<string, ShoppingItem[]>();
    for (const it of pending) {
      const key = it.category ?? "Altele";
      const list = map.get(key) ?? [];
      list.push(it);
      map.set(key, list);
    }
    const sorted = Array.from(map.entries()).sort((a, b) =>
      a[0].localeCompare(b[0]),
    );
    return sorted;
  }, [pending]);

  function emojiFor(catLabel: string): string {
    return (
      SHOPPING_CATEGORIES.find((c) => c.label === catLabel)?.emoji ?? "🛒"
    );
  }

  return (
    <Screen padded={false}>
      <View className="px-5 pt-4 pb-2 flex-row items-center justify-between">
        <Text className="text-text text-2xl font-bold">Cumpărături</Text>
        {done.length > 0 ? (
          <Pressable
            onPress={() =>
              Alert.alert(
                "Curăță cumpărate",
                `Se șterg ${done.length} item${done.length === 1 ? "" : "i"} marca${done.length === 1 ? "t" : "ți"} ca cumpărați.`,
                [
                  { text: "Anulează", style: "cancel" },
                  {
                    text: "Șterge",
                    style: "destructive",
                    onPress: () => clearDone.mutate(),
                  },
                ],
              )
            }
            hitSlop={6}
          >
            <Text className="text-red-400 text-xs">
              Curăță cumpărate ({done.length})
            </Text>
          </Pressable>
        ) : null}
      </View>

      <View className="px-5 pb-2 gap-2">
        <View className="bg-bg-card border border-border rounded-2xl px-3 flex-row items-center gap-2">
          <Ionicons name="add" size={20} color="#7c5cff" />
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Adaugă (ex: lapte, pâine)…"
            placeholderTextColor="#6b6b78"
            className="flex-1 text-text py-3"
            returnKeyType="done"
            onSubmitEditing={() => name.trim() && add.mutate()}
          />
          <Pressable
            onPress={() => add.mutate()}
            disabled={!name.trim() || add.isPending}
            hitSlop={6}
            className={`px-3 py-1.5 rounded-full ${name.trim() ? "bg-accent" : "bg-bg-elevated"}`}
          >
            <Text className="text-white text-sm font-semibold">+</Text>
          </Pressable>
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 6, paddingHorizontal: 0 }}
        >
          <Pressable
            onPress={() => setCategory(null)}
            className={`px-3 py-1.5 rounded-full border ${category === null ? "bg-accent border-accent" : "bg-bg-card border-border"}`}
          >
            <Text
              className={`text-xs font-medium ${category === null ? "text-white" : "text-text-muted"}`}
            >
              Fără categorie
            </Text>
          </Pressable>
          {SHOPPING_CATEGORIES.map((c) => {
            const active = category === c.label;
            return (
              <Pressable
                key={c.label}
                onPress={() => setCategory(active ? null : c.label)}
                className={`flex-row items-center gap-1 px-3 py-1.5 rounded-full border ${active ? "bg-accent border-accent" : "bg-bg-card border-border"}`}
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
        </ScrollView>
      </View>

      <FlatList
        data={[]}
        keyExtractor={() => ""}
        renderItem={null}
        contentContainerStyle={{ paddingBottom: 40 }}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching && !isLoading}
            onRefresh={refetch}
            tintColor="#7c5cff"
          />
        }
        ListHeaderComponent={
          <View className="px-5 gap-3">
            {grouped.length === 0 ? (
              <View className="items-center pt-12">
                <Text className="text-text-muted">
                  {items === undefined
                    ? ""
                    : "Lista e goală. Adaugă primul item."}
                </Text>
              </View>
            ) : null}

            {grouped.map(([cat, list]) => (
              <View key={cat} className="gap-1.5">
                <View className="flex-row items-center gap-1.5 pt-2">
                  <Text>{emojiFor(cat)}</Text>
                  <Text className="text-text-muted text-xs uppercase tracking-wide">
                    {cat}
                  </Text>
                  <Text className="text-text-muted text-xs">
                    · {list.length}
                  </Text>
                </View>
                {list.map((it) => (
                  <Row
                    key={it.id}
                    item={it}
                    myUserId={myUserId ?? null}
                    onToggle={() =>
                      toggle.mutate({ id: it.id, done: !it.is_done })
                    }
                    onDelete={() => remove.mutate(it.id)}
                  />
                ))}
              </View>
            ))}

            {done.length > 0 ? (
              <View className="gap-1.5 pt-6 border-t border-border mt-4">
                <Text className="text-text-muted text-xs uppercase tracking-wide pt-2">
                  Cumpărate ({done.length})
                </Text>
                {done.map((it) => (
                  <Row
                    key={it.id}
                    item={it}
                    myUserId={myUserId ?? null}
                    onToggle={() =>
                      toggle.mutate({ id: it.id, done: !it.is_done })
                    }
                    onDelete={() => remove.mutate(it.id)}
                  />
                ))}
              </View>
            ) : null}
          </View>
        }
      />
    </Screen>
  );
}

function Row({
  item,
  myUserId,
  onToggle,
  onDelete,
}: {
  item: ShoppingItem;
  myUserId: string | null;
  onToggle: () => void;
  onDelete: () => void;
}) {
  const addedBy = item.added_by_profile?.display_name ?? "—";
  const doneBy = item.done_by_profile?.display_name ?? null;
  const addedMine = item.added_by === myUserId;
  const doneMine = item.done_by === myUserId;
  const doneAgo = item.done_at
    ? formatDistanceToNow(new Date(item.done_at), {
        addSuffix: true,
        locale: ro,
      })
    : null;

  return (
    <Pressable
      onPress={onToggle}
      className={`flex-row items-center gap-3 rounded-xl px-3 py-3 border ${item.is_done ? "bg-bg-card/50 border-border" : "bg-bg-card border-border"}`}
    >
      <View
        className={`w-6 h-6 rounded-full border-2 items-center justify-center ${item.is_done ? "bg-accent border-accent" : "border-border"}`}
      >
        {item.is_done ? (
          <Ionicons name="checkmark" size={14} color="#fff" />
        ) : null}
      </View>
      <View className="flex-1 gap-0.5">
        <Text
          className={`${item.is_done ? "text-text-muted line-through" : "text-text"} font-medium`}
          numberOfLines={1}
        >
          {item.name}
          {item.quantity ? (
            <Text className="text-text-muted font-normal">
              {"  "}· {item.quantity}
            </Text>
          ) : null}
        </Text>
        <Text className="text-text-muted text-xs">
          {item.is_done && doneBy
            ? `Luat de ${doneMine ? "tine" : doneBy} ${doneAgo ?? ""}`
            : `Adăugat de ${addedMine ? "tine" : addedBy}`}
        </Text>
      </View>
      <Pressable
        onPress={() =>
          router.push(`/(app)/modal/shopping-edit?id=${item.id}` as never)
        }
        hitSlop={8}
      >
        <Ionicons name="pencil-outline" size={16} color="#9a9aa8" />
      </Pressable>
      <Pressable onPress={onDelete} hitSlop={8}>
        <Ionicons name="close" size={18} color="#9a9aa8" />
      </Pressable>
    </Pressable>
  );
}
