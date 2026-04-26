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
import { Ionicons } from "@expo/vector-icons";

import { Screen } from "@/components/Screen";
import { Input } from "@/components/Input";
import { Button } from "@/components/Button";
import {
  APPLIANCE_ICONS,
  APPLIANCE_KINDS,
  APPLIANCE_LABELS,
  createAppliance,
  deleteAppliance,
  getAppliance,
  updateAppliance,
  type ApplianceKind,
} from "@/features/appliances/api";
import { useActiveSpace } from "@/stores/activeSpace";
import { t } from "@/i18n";

export default function ApplianceEdit() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const editing = !!id;
  const activeSpaceId = useActiveSpace((s) => s.activeSpaceId);
  const qc = useQueryClient();

  const { data: existing, isLoading } = useQuery({
    queryKey: ["appliance", id],
    queryFn: () => getAppliance(id!),
    enabled: !!id,
  });

  const [name, setName] = useState("");
  const [kind, setKind] = useState<ApplianceKind>("washer");
  const [duration, setDuration] = useState("90");

  useEffect(() => {
    if (!existing) return;
    setName(existing.name);
    setKind(existing.kind);
    setDuration(String(existing.default_duration_minutes));
  }, [existing]);

  const save = useMutation({
    mutationFn: async () => {
      if (!activeSpaceId) throw new Error("no_active_space");
      const dur = Math.max(1, Math.min(1440, parseInt(duration, 10) || 90));
      const draft = {
        name: name.trim(),
        kind,
        default_duration_minutes: dur,
      };
      if (editing && id) {
        await updateAppliance(id, draft);
      } else {
        await createAppliance(activeSpaceId, draft);
      }
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["appliances", activeSpaceId] });
      if (id) await qc.invalidateQueries({ queryKey: ["appliance", id] });
      router.back();
    },
    onError: (err) =>
      Alert.alert(
        "Eroare",
        err instanceof Error ? err.message : "Nu s-a putut",
      ),
  });

  const remove = useMutation({
    mutationFn: () => deleteAppliance(id!),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["appliances", activeSpaceId] });
      router.back();
    },
    onError: (err) =>
      Alert.alert(
        "Eroare",
        err instanceof Error ? err.message : "Nu s-a putut",
      ),
  });

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
          {editing ? "Editează aparat" : "Adaugă aparat"}
        </Text>
        <Pressable onPress={() => router.back()}>
          <Text className="text-text-muted">{t("common.cancel")}</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 40, gap: 16 }}>
        <View className="gap-2">
          <Text className="text-text-muted text-sm font-medium">Tip</Text>
          <View className="flex-row flex-wrap gap-2">
            {APPLIANCE_KINDS.map((k) => (
              <Pressable
                key={k}
                onPress={() => {
                  setKind(k);
                  if (!editing && !name.trim())
                    setName(APPLIANCE_LABELS[k]);
                }}
                className={`flex-row items-center gap-1.5 px-3 py-2 rounded-xl border ${
                  kind === k
                    ? "bg-accent border-accent"
                    : "bg-bg-card border-border"
                }`}
              >
                <Ionicons
                  name={APPLIANCE_ICONS[k] as never}
                  size={16}
                  color={kind === k ? "#fff" : "#9a9aa8"}
                />
                <Text
                  className={`text-xs font-medium ${kind === k ? "text-white" : "text-text-muted"}`}
                >
                  {APPLIANCE_LABELS[k]}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        <Input
          label="Nume"
          value={name}
          onChangeText={setName}
          autoCapitalize="sentences"
          placeholder={APPLIANCE_LABELS[kind]}
        />

        <Input
          label="Durată default (minute)"
          value={duration}
          onChangeText={(v) => setDuration(v.replace(/[^0-9]/g, ""))}
          keyboardType="number-pad"
          maxLength={4}
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
              Alert.alert(
                "Șterge aparat",
                "Toată istoria sesiunilor se va șterge. Ireversibil.",
                [
                  { text: t("common.cancel"), style: "cancel" },
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
            <Text className="text-red-400">Șterge aparat</Text>
          </Pressable>
        ) : null}
      </ScrollView>
    </Screen>
  );
}
