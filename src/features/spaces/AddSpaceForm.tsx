import { useState } from "react";
import { Alert, Pressable, Text, View } from "react-native";
import { useQueryClient } from "@tanstack/react-query";

import { Input } from "@/components/Input";
import { Button } from "@/components/Button";
import { createSpace, joinSpace } from "@/features/spaces/api";
import { useActiveSpace } from "@/stores/activeSpace";
import { t } from "@/i18n";

type Tab = "create" | "join";

export function AddSpaceForm({ onDone }: { onDone: (spaceId: string) => void }) {
  const [tab, setTab] = useState<Tab>("create");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const setActiveSpace = useActiveSpace((s) => s.setActiveSpace);
  const qc = useQueryClient();

  async function submit() {
    setSubmitting(true);
    try {
      const spaceId =
        tab === "create" ? await createSpace(name) : await joinSpace(code);
      await setActiveSpace(spaceId);
      await qc.invalidateQueries({ queryKey: ["my-spaces"] });
      onDone(spaceId);
    } catch (err) {
      Alert.alert(
        "Hop",
        err instanceof Error ? err.message : t("auth.errors.generic"),
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <View className="gap-6">
      <View className="bg-bg-card rounded-2xl p-1 flex-row">
        <TabButton
          active={tab === "create"}
          label={t("spaces.createTab")}
          onPress={() => setTab("create")}
        />
        <TabButton
          active={tab === "join"}
          label={t("spaces.joinTab")}
          onPress={() => setTab("join")}
        />
      </View>

      {tab === "create" ? (
        <View className="gap-4">
          <Input
            label={t("spaces.spaceName")}
            placeholder={t("spaces.spaceNamePlaceholder")}
            value={name}
            onChangeText={setName}
            autoCapitalize="words"
          />
          <Button
            label={t("spaces.createButton")}
            onPress={submit}
            loading={submitting}
            disabled={!name.trim()}
          />
        </View>
      ) : (
        <View className="gap-4">
          <Input
            label={t("spaces.code")}
            placeholder={t("spaces.codePlaceholder")}
            value={code}
            onChangeText={(v) => setCode(v.toUpperCase())}
            autoCapitalize="characters"
            maxLength={6}
          />
          <Button
            label={t("spaces.joinButton")}
            onPress={submit}
            loading={submitting}
            disabled={code.trim().length !== 6}
          />
        </View>
      )}
    </View>
  );
}

function TabButton({
  active,
  label,
  onPress,
}: {
  active: boolean;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      className={`flex-1 rounded-xl py-3 items-center ${active ? "bg-accent" : ""}`}
    >
      <Text
        className={`font-medium ${active ? "text-white" : "text-text-muted"}`}
      >
        {label}
      </Text>
    </Pressable>
  );
}
