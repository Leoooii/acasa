import {
  Alert,
  Pressable,
  ScrollView,
  Share,
  Text,
  View,
} from "react-native";
import { router } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as Clipboard from "expo-clipboard";
import { Ionicons } from "@expo/vector-icons";
import { formatDistanceToNow } from "date-fns";
import { ro } from "date-fns/locale";

import { Screen } from "@/components/Screen";
import { Button } from "@/components/Button";
import {
  createInvitation,
  deleteInvitation,
  deleteSpace,
  leaveSpace,
  listActiveInvitations,
  listMySpaces,
  listSpaceMembers,
} from "@/features/spaces/api";
import { signOut } from "@/features/auth/api";
import { useSession } from "@/stores/session";
import { usePreferences } from "@/stores/preferences";
import { t } from "@/i18n";
import { useActiveSpace } from "@/stores/activeSpace";

export default function SpaceSettings() {
  const activeSpaceId = useActiveSpace((s) => s.activeSpaceId);
  const setActiveSpace = useActiveSpace((s) => s.setActiveSpace);
  const qc = useQueryClient();

  const { data: spaces } = useQuery({
    queryKey: ["my-spaces"],
    queryFn: listMySpaces,
  });

  const currentSpace = spaces?.find((s) => s.space_id === activeSpaceId);
  const isAdmin = currentSpace?.role === "admin";
  const spaceName = currentSpace?.spaces.name ?? "—";

  const { data: invites } = useQuery({
    queryKey: ["invitations", activeSpaceId],
    queryFn: () => listActiveInvitations(activeSpaceId!),
    enabled: !!activeSpaceId,
  });

  const { data: members } = useQuery({
    queryKey: ["members", activeSpaceId],
    queryFn: () => listSpaceMembers(activeSpaceId!),
    enabled: !!activeSpaceId,
  });

  const myUserId = useSession((s) => s.session?.user.id);
  const showAppliances = usePreferences((s) => s.showAppliancesInFeed);
  const setShowAppliances = usePreferences((s) => s.setShowAppliancesInFeed);

  const newInvite = useMutation({
    mutationFn: () => createInvitation(activeSpaceId!),
    onSuccess: async () => {
      await qc.refetchQueries({ queryKey: ["invitations", activeSpaceId] });
    },
    onError: (err) =>
      Alert.alert(
        "Invitație",
        err instanceof Error ? err.message : "Eroare la generare",
      ),
  });

  const revokeInvite = useMutation({
    mutationFn: (id: string) => deleteInvitation(id),
    onSuccess: async () => {
      await qc.refetchQueries({ queryKey: ["invitations", activeSpaceId] });
    },
  });

  const remove = useMutation({
    mutationFn: async () => {
      if (!activeSpaceId) throw new Error("no_active_space");
      if (isAdmin) await deleteSpace(activeSpaceId);
      else await leaveSpace(activeSpaceId);
    },
    onSuccess: async () => {
      const remaining = (spaces ?? []).filter(
        (s) => s.space_id !== activeSpaceId,
      );
      await setActiveSpace(remaining[0]?.space_id ?? null);
      await qc.invalidateQueries({ queryKey: ["my-spaces"] });
      router.replace("/");
    },
    onError: (err) =>
      Alert.alert(
        "Eroare",
        err instanceof Error ? err.message : "Nu s-a putut",
      ),
  });

  async function copyCode(code: string) {
    await Clipboard.setStringAsync(code);
    Alert.alert("Copiat", `Codul ${code} e în clipboard.`);
  }

  async function shareCode(code: string) {
    await Share.share({
      message: `Vino în spațiul "${spaceName}" pe acasa: cod ${code}`,
    });
  }

  async function switchTo(id: string) {
    await setActiveSpace(id);
    await qc.invalidateQueries();
    router.replace("/");
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ paddingBottom: 40, gap: 24 }}>
        <View className="flex-row justify-between items-center pt-2">
          <Text className="text-text text-xl font-bold">Setări spațiu</Text>
          <Pressable onPress={() => router.back()}>
            <Text className="text-text-muted">Închide</Text>
          </Pressable>
        </View>

        <View className="bg-bg-card border border-border rounded-2xl p-4 gap-1">
          <Text className="text-text-muted text-xs uppercase tracking-wide">
            Spațiu activ
          </Text>
          <Text className="text-text text-lg font-semibold">{spaceName}</Text>
          <Text className="text-text-muted text-xs">
            {members?.length ?? 0}{" "}
            {(members?.length ?? 0) === 1 ? "membru" : "membri"} ·{" "}
            {isAdmin ? "Administrator" : "Membru"}
          </Text>
        </View>

        <View className="gap-2">
          <Text className="text-text-muted text-xs uppercase tracking-wide">
            Membri
          </Text>
          {(members ?? []).map((m) => {
            const isMe = m.user_id === myUserId;
            return (
              <View
                key={m.user_id}
                className="bg-bg-card border border-border rounded-2xl p-4 flex-row items-center gap-3"
              >
                <View className="w-10 h-10 rounded-full bg-bg-elevated items-center justify-center">
                  <Text className="text-text-muted text-base font-medium">
                    {(m.profiles?.display_name ?? "?")
                      .charAt(0)
                      .toUpperCase()}
                  </Text>
                </View>
                <View className="flex-1">
                  <Text className="text-text font-medium">
                    {m.profiles?.display_name ?? "—"}
                    {isMe ? " (tu)" : ""}
                  </Text>
                  <Text className="text-text-muted text-xs">
                    {m.role === "admin" ? "Administrator" : "Membru"}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>

        <View className="gap-2">
          <Text className="text-text-muted text-xs uppercase tracking-wide">
            Spațiile mele
          </Text>
          {(spaces ?? []).map((s) => (
            <Pressable
              key={s.space_id}
              onPress={() => switchTo(s.space_id)}
              className={`rounded-2xl p-4 flex-row justify-between items-center bg-bg-card border ${
                s.space_id === activeSpaceId
                  ? "border-accent"
                  : "border-border"
              }`}
            >
              <Text className="text-text">{s.spaces.name}</Text>
              {s.space_id === activeSpaceId ? (
                <Ionicons name="checkmark-circle" color="#7c5cff" size={20} />
              ) : (
                <Ionicons name="chevron-forward" color="#6b6b78" size={18} />
              )}
            </Pressable>
          ))}
          <Button
            label="+ Adaugă spațiu"
            variant="secondary"
            onPress={() => router.push("/(app)/modal/add-space")}
          />
        </View>

        <View className="gap-2">
          <Text className="text-text-muted text-xs uppercase tracking-wide">
            Invitații active
          </Text>
          {invites && invites.length > 0 ? (
            invites.map((inv) => (
              <View
                key={inv.id}
                className="bg-bg-card border border-border rounded-2xl p-4 gap-3"
              >
                <View className="flex-row items-center justify-between">
                  <Text className="text-text text-3xl font-mono tracking-widest">
                    {inv.code}
                  </Text>
                  <Pressable
                    onPress={() => revokeInvite.mutate(inv.id)}
                    hitSlop={8}
                  >
                    <Ionicons name="trash-outline" color="#9a9aa8" size={18} />
                  </Pressable>
                </View>
                <Text className="text-text-muted text-xs">
                  Expiră{" "}
                  {formatDistanceToNow(new Date(inv.expires_at), {
                    addSuffix: true,
                    locale: ro,
                  })}
                </Text>
                <View className="flex-row gap-2">
                  <Pressable
                    onPress={() => copyCode(inv.code)}
                    className="flex-1 bg-bg-elevated rounded-xl py-3 items-center"
                  >
                    <Text className="text-text">Copiază</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => shareCode(inv.code)}
                    className="flex-1 bg-bg-elevated rounded-xl py-3 items-center"
                  >
                    <Text className="text-text">Trimite</Text>
                  </Pressable>
                </View>
              </View>
            ))
          ) : (
            <Text className="text-text-muted text-sm">
              Niciun cod activ.
            </Text>
          )}
          <Button
            label="+ Generează cod nou"
            variant="secondary"
            onPress={() => newInvite.mutate()}
            loading={newInvite.isPending}
          />
        </View>

        <View className="gap-2">
          <Text className="text-text-muted text-xs uppercase tracking-wide">
            Preferințe
          </Text>
          <Pressable
            onPress={() => setShowAppliances(!showAppliances)}
            className="flex-row items-center justify-between bg-bg-card border border-border rounded-2xl px-4 py-3"
          >
            <View className="flex-1 pr-3">
              <Text className="text-text">
                Aparate în feed
              </Text>
              <Text className="text-text-muted text-xs">
                Pornit: anunțuri în feed cu countdown.{"\n"}
                Oprit: dock cu iconițe pe partea dreaptă.
              </Text>
            </View>
            <View
              className={`w-12 h-6 rounded-full ${showAppliances ? "bg-accent" : "bg-bg-elevated"} justify-center px-0.5`}
            >
              <View
                className={`w-5 h-5 rounded-full bg-white ${showAppliances ? "ml-auto" : ""}`}
              />
            </View>
          </Pressable>
        </View>

        <View className="pt-4">
          <Pressable
            onPress={() => {
              Alert.alert(
                isAdmin ? "Șterge spațiu" : "Părăsește spațiu",
                isAdmin
                  ? "Toate post-urile, codurile și itemele se șterg. Ireversibil."
                  : "Vei pierde accesul la post-uri.",
                [
                  { text: "Anulează", style: "cancel" },
                  {
                    text: isAdmin ? "Șterge" : "Părăsește",
                    style: "destructive",
                    onPress: () => remove.mutate(),
                  },
                ],
              );
            }}
            className="items-center py-3"
          >
            <Text className="text-red-400">
              {isAdmin ? "Șterge spațiul" : "Părăsește spațiul"}
            </Text>
          </Pressable>
        </View>

        <View className="pt-2 border-t border-border">
          <Pressable
            onPress={() => {
              Alert.alert(t("common.signOut"), "Ești sigur?", [
                { text: t("common.cancel"), style: "cancel" },
                {
                  text: t("common.signOut"),
                  style: "destructive",
                  onPress: async () => {
                    await signOut();
                    router.replace("/(auth)/sign-in");
                  },
                },
              ]);
            }}
            className="items-center py-3 mt-2"
          >
            <Text className="text-text-muted">{t("common.signOut")}</Text>
          </Pressable>
        </View>
      </ScrollView>
    </Screen>
  );
}
