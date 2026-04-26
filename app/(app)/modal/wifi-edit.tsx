import { useEffect, useState } from "react";
import { Alert, Pressable, ScrollView, Text, View } from "react-native";
import { router } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { Screen } from "@/components/Screen";
import { Input } from "@/components/Input";
import { Button } from "@/components/Button";
import {
  deleteWifi,
  getWifi,
  upsertWifi,
  type WifiSecurity,
} from "@/features/home/wifi";
import { useActiveSpace } from "@/stores/activeSpace";
import { t } from "@/i18n";

const SECURITIES: { value: WifiSecurity; label: string }[] = [
  { value: "WPA", label: "WPA/WPA2" },
  { value: "WEP", label: "WEP" },
  { value: "nopass", label: "Fără parolă" },
];

export default function WifiEdit() {
  const activeSpaceId = useActiveSpace((s) => s.activeSpaceId);
  const qc = useQueryClient();

  const { data: existing } = useQuery({
    queryKey: ["wifi", activeSpaceId],
    queryFn: () => getWifi(activeSpaceId!),
    enabled: !!activeSpaceId,
  });

  const [ssid, setSsid] = useState("");
  const [password, setPassword] = useState("");
  const [security, setSecurity] = useState<WifiSecurity>("WPA");
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    if (!existing) return;
    setSsid(existing.ssid);
    setPassword(existing.password);
    setSecurity(existing.security);
    setHidden(existing.hidden);
  }, [existing]);

  const save = useMutation({
    mutationFn: () =>
      upsertWifi(activeSpaceId!, {
        ssid: ssid.trim(),
        password: security === "nopass" ? "" : password,
        security,
        hidden,
      }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["wifi", activeSpaceId] });
      router.back();
    },
    onError: (e) =>
      Alert.alert("Eroare", e instanceof Error ? e.message : "Nu s-a putut"),
  });

  const remove = useMutation({
    mutationFn: () => deleteWifi(activeSpaceId!),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["wifi", activeSpaceId] });
      router.back();
    },
  });

  return (
    <Screen>
      <View className="flex-row justify-between items-center pt-2 pb-3">
        <Text className="text-text text-xl font-bold">WiFi</Text>
        <Pressable onPress={() => router.back()}>
          <Text className="text-text-muted">{t("common.cancel")}</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 40, gap: 16 }}>
        <Input
          label="SSID (numele rețelei)"
          value={ssid}
          onChangeText={setSsid}
          autoCapitalize="none"
          autoCorrect={false}
        />

        <View className="gap-2">
          <Text className="text-text-muted text-sm font-medium">Securitate</Text>
          <View className="flex-row gap-2">
            {SECURITIES.map((s) => (
              <Pressable
                key={s.value}
                onPress={() => setSecurity(s.value)}
                className={`flex-1 rounded-xl py-2.5 items-center border ${
                  security === s.value
                    ? "bg-accent border-accent"
                    : "bg-bg-card border-border"
                }`}
              >
                <Text
                  className={`text-xs font-medium ${security === s.value ? "text-white" : "text-text-muted"}`}
                >
                  {s.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        {security !== "nopass" ? (
          <Input
            label="Parolă"
            value={password}
            onChangeText={setPassword}
            autoCapitalize="none"
            autoCorrect={false}
          />
        ) : null}

        <Pressable
          onPress={() => setHidden((v) => !v)}
          className="flex-row items-center justify-between bg-bg-card border border-border rounded-2xl px-4 py-3"
        >
          <View className="flex-1">
            <Text className="text-text">Rețea ascunsă</Text>
            <Text className="text-text-muted text-xs">
              Bifează doar dacă SSID-ul nu e broadcast.
            </Text>
          </View>
          <View
            className={`w-12 h-6 rounded-full ${hidden ? "bg-accent" : "bg-bg-elevated"} justify-center px-0.5`}
          >
            <View
              className={`w-5 h-5 rounded-full bg-white ${hidden ? "ml-auto" : ""}`}
            />
          </View>
        </Pressable>

        <Button
          label={t("closet.save")}
          onPress={() => save.mutate()}
          loading={save.isPending}
          disabled={!ssid.trim() || save.isPending}
        />

        {existing ? (
          <Pressable
            onPress={() =>
              Alert.alert("Șterge WiFi", "Ireversibil pe acest spațiu.", [
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
            <Text className="text-red-400">Șterge WiFi din spațiu</Text>
          </Pressable>
        ) : null}
      </ScrollView>
    </Screen>
  );
}
