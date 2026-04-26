import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { router } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";

import { Image } from "expo-image";

import { Screen } from "@/components/Screen";
import { Input } from "@/components/Input";
import { Button } from "@/components/Button";
import { Avatar } from "@/components/Avatar";
import {
  STATUS_PRESETS,
  deleteMyAvatar,
  getMyProfile,
  setAvatarUrl,
  updateMyName,
  updateMyStatus,
  uploadMyAvatar,
} from "@/features/profile/api";
import { pickFromCamera, pickFromLibrary, type PickedPhoto } from "@/features/closet/photo";
import { useActiveSpace } from "@/stores/activeSpace";
import { t } from "@/i18n";

export default function ProfileEdit() {
  const activeSpaceId = useActiveSpace((s) => s.activeSpaceId);
  const qc = useQueryClient();

  const { data: me, isLoading } = useQuery({
    queryKey: ["my-profile"],
    queryFn: getMyProfile,
  });

  const [name, setName] = useState("");
  const [icon, setIcon] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [pendingAvatar, setPendingAvatar] = useState<PickedPhoto | null>(null);
  const [avatarPath, setAvatarPath] = useState<string | null>(null);

  useEffect(() => {
    if (!me) return;
    setName(me.display_name);
    setIcon(me.status_icon ?? null);
    setText(me.status_text ?? "");
    setAvatarPath(me.avatar_url ?? null);
  }, [me]);

  const save = useMutation({
    mutationFn: async () => {
      if (name.trim() && name.trim() !== me?.display_name) {
        await updateMyName(name);
      }
      if (pendingAvatar) {
        const newPath = await uploadMyAvatar(pendingAvatar);
        await setAvatarUrl(newPath);
      }
      await updateMyStatus(icon, text);
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["my-profile"] });
      await qc.invalidateQueries({ queryKey: ["members", activeSpaceId] });
      router.back();
    },
    onError: (err) =>
      Alert.alert(
        "Eroare",
        err instanceof Error ? err.message : "Nu s-a putut",
      ),
  });

  const removeAvatar = useMutation({
    mutationFn: deleteMyAvatar,
    onSuccess: async () => {
      setPendingAvatar(null);
      setAvatarPath(null);
      await qc.invalidateQueries({ queryKey: ["my-profile"] });
      await qc.invalidateQueries({ queryKey: ["members", activeSpaceId] });
    },
  });

  const clearStatus = useMutation({
    mutationFn: () => updateMyStatus(null, null),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["my-profile"] });
      await qc.invalidateQueries({ queryKey: ["members", activeSpaceId] });
      setIcon(null);
      setText("");
    },
  });

  function pickEmoji(e: string) {
    setIcon((prev) => (prev === e ? null : e));
  }

  async function pickAvatar(source: "camera" | "library") {
    const photo =
      source === "camera" ? await pickFromCamera() : await pickFromLibrary();
    if (photo) setPendingAvatar(photo);
  }

  if (isLoading) {
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
        <Text className="text-text text-xl font-bold">Profilul tău</Text>
        <Pressable onPress={() => router.back()}>
          <Text className="text-text-muted">{t("common.cancel")}</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 40, gap: 16 }}>
        {/* Avatar section */}
        <View className="items-center gap-3 py-3">
          {pendingAvatar ? (
            <View
              className="rounded-full overflow-hidden border-2 border-accent"
              style={{ width: 110, height: 110 }}
            >
              <Image
                source={{ uri: pendingAvatar.uri }}
                style={{ width: 110, height: 110 }}
                contentFit="cover"
              />
            </View>
          ) : (
            <Avatar
              avatarPath={avatarPath}
              displayName={name || "?"}
              statusIcon={icon}
              size={110}
            />
          )}
          <View className="flex-row gap-2">
            <Pressable
              onPress={() => pickAvatar("camera")}
              className="bg-bg-card border border-border rounded-xl px-3 py-2 flex-row items-center gap-1.5"
            >
              <Ionicons name="camera-outline" size={16} color="#f4f4f6" />
              <Text className="text-text text-sm">Cameră</Text>
            </Pressable>
            <Pressable
              onPress={() => pickAvatar("library")}
              className="bg-bg-card border border-border rounded-xl px-3 py-2 flex-row items-center gap-1.5"
            >
              <Ionicons name="images-outline" size={16} color="#f4f4f6" />
              <Text className="text-text text-sm">Galerie</Text>
            </Pressable>
            {avatarPath || pendingAvatar ? (
              <Pressable
                onPress={() => {
                  if (pendingAvatar) {
                    setPendingAvatar(null);
                  } else if (avatarPath) {
                    Alert.alert("Șterge avatar", "Sigur?", [
                      { text: "Anulează", style: "cancel" },
                      {
                        text: "Șterge",
                        style: "destructive",
                        onPress: () => removeAvatar.mutate(),
                      },
                    ]);
                  }
                }}
                className="bg-bg-card border border-border rounded-xl px-3 py-2 flex-row items-center"
              >
                <Ionicons name="trash-outline" size={16} color="#9a9aa8" />
              </Pressable>
            ) : null}
          </View>
        </View>

        <Input
          label="Nume"
          value={name}
          onChangeText={setName}
          autoCapitalize="words"
          maxLength={60}
        />

        <View className="border-t border-border pt-4 gap-2">
          <Text className="text-text-muted text-xs uppercase tracking-wide">
            Status
          </Text>
          <View className="flex-row flex-wrap gap-2">
            {STATUS_PRESETS.map((p) => {
              const active = icon === p.emoji;
              return (
                <Pressable
                  key={p.emoji}
                  onPress={() => pickEmoji(p.emoji)}
                  className={`items-center justify-center w-[74px] py-2 rounded-2xl border ${
                    active
                      ? "bg-accent/15 border-accent"
                      : "bg-bg-card border-border"
                  }`}
                >
                  <Text style={{ fontSize: 28 }}>{p.emoji}</Text>
                  <Text
                    className={`text-[10px] mt-1 ${active ? "text-accent font-semibold" : "text-text-muted"}`}
                    numberOfLines={1}
                  >
                    {p.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <Input
          label="Mesaj status (opțional)"
          placeholder="ex: La sală până la 18:00"
          value={text}
          onChangeText={setText}
          maxLength={80}
        />

        <Button
          label={t("closet.save")}
          onPress={() => save.mutate()}
          loading={save.isPending}
          disabled={!name.trim() || save.isPending}
        />

        {(me?.status_icon || me?.status_text) ? (
          <Pressable
            onPress={() =>
              Alert.alert("Șterge status", "Statusul tău se va șterge.", [
                { text: t("common.cancel"), style: "cancel" },
                {
                  text: "Șterge",
                  style: "destructive",
                  onPress: () => clearStatus.mutate(),
                },
              ])
            }
            className="items-center py-2"
          >
            <Text className="text-red-400">Șterge status</Text>
          </Pressable>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

