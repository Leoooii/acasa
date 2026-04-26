import { useState } from "react";
import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { router } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import { format } from "date-fns";
import { ro } from "date-fns/locale";

import { Screen } from "@/components/Screen";
import { Input } from "@/components/Input";
import { Button } from "@/components/Button";
import { createPost, type PostType } from "@/features/feed/api";
import { listSpaceMembers } from "@/features/spaces/api";
import { useActiveSpace } from "@/stores/activeSpace";
import { useSession } from "@/stores/session";
import { t } from "@/i18n";

const TYPES: PostType[] = ["announcement", "event", "poll"];
const MIN_OPTIONS = 2;
const MAX_OPTIONS = 6;

function nextHour(offsetHours = 1) {
  const d = new Date();
  d.setMinutes(0, 0, 0);
  d.setHours(d.getHours() + offsetHours);
  return d;
}

export default function NewPost() {
  const activeSpaceId = useActiveSpace((s) => s.activeSpaceId);
  const myUserId = useSession((s) => s.session?.user.id) ?? "";
  const [type, setType] = useState<PostType>("announcement");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [pollOptions, setPollOptions] = useState<string[]>(["", ""]);
  const [start, setStart] = useState(() => nextHour(1));
  const [end, setEnd] = useState(() => nextHour(2));
  const [participants, setParticipants] = useState<string[]>(
    myUserId ? [myUserId] : [],
  );
  const [picker, setPicker] = useState<
    { field: "start" | "end"; mode: "date" | "time" } | null
  >(null);
  const qc = useQueryClient();

  const { data: members } = useQuery({
    queryKey: ["members", activeSpaceId],
    queryFn: () => listSpaceMembers(activeSpaceId!),
    enabled: !!activeSpaceId && type === "event",
  });

  const cleanedOptions = pollOptions.map((o) => o.trim()).filter(Boolean);
  const pollValid = type !== "poll" || cleanedOptions.length >= MIN_OPTIONS;
  const eventValid =
    type !== "event" || (end.getTime() > start.getTime() && participants.length > 0);
  const canPublish = !!title.trim() && pollValid && eventValid;

  const m = useMutation({
    mutationFn: async () => {
      if (!activeSpaceId) throw new Error("no_active_space");
      let payload: Record<string, unknown> | null = null;
      if (type === "poll") payload = { options: cleanedOptions };
      else if (type === "event")
        payload = {
          start_at: start.toISOString(),
          end_at: end.toISOString(),
          participants,
        };
      return createPost({ spaceId: activeSpaceId, type, title, body, payload });
    },
    onSuccess: async () => {
      await qc.refetchQueries({ queryKey: ["posts", activeSpaceId] });
      router.back();
    },
    onError: (err) => {
      Alert.alert(
        t("feed.newPost"),
        err instanceof Error ? err.message : t("auth.errors.generic"),
      );
    },
  });

  function updateOption(idx: number, value: string) {
    setPollOptions((prev) => prev.map((o, i) => (i === idx ? value : o)));
  }
  function addOption() {
    if (pollOptions.length >= MAX_OPTIONS) return;
    setPollOptions((prev) => [...prev, ""]);
  }
  function removeOption(idx: number) {
    if (pollOptions.length <= MIN_OPTIONS) return;
    setPollOptions((prev) => prev.filter((_, i) => i !== idx));
  }

  function toggleParticipant(userId: string) {
    setParticipants((prev) =>
      prev.includes(userId)
        ? prev.filter((p) => p !== userId)
        : [...prev, userId],
    );
  }

  function setAllParticipants() {
    if (!members) return;
    setParticipants(members.map((mm) => mm.user_id));
  }

  function handlePickerChange(_: unknown, picked?: Date) {
    const cur = picker;
    if (Platform.OS !== "ios") setPicker(null);
    if (!picked || !cur) return;

    const target = cur.field === "start" ? start : end;
    const setter = cur.field === "start" ? setStart : setEnd;
    const merged = new Date(target);
    if (cur.mode === "date") {
      merged.setFullYear(picked.getFullYear());
      merged.setMonth(picked.getMonth());
      merged.setDate(picked.getDate());
    } else {
      merged.setHours(picked.getHours(), picked.getMinutes(), 0, 0);
    }
    setter(merged);

    if (cur.mode === "date" && Platform.OS !== "ios") {
      setTimeout(() => setPicker({ field: cur.field, mode: "time" }), 50);
    } else if (Platform.OS === "ios") {
      // pe iOS picker-ul ramane vizibil; user inchide explicit
    }
  }

  return (
    <Screen>
      <View className="flex-row justify-between items-center pt-2 pb-3">
        <Text className="text-text text-xl font-bold">{t("feed.newPost")}</Text>
        <Pressable onPress={() => router.back()}>
          <Text className="text-text-muted">{t("common.cancel")}</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 40, gap: 16 }}>
        <View className="flex-row gap-2">
          {TYPES.map((typ) => (
            <Pressable
              key={typ}
              onPress={() => setType(typ)}
              className={`flex-1 rounded-xl py-3 items-center border ${type === typ ? "bg-accent border-accent" : "bg-bg-card border-border"}`}
            >
              <Text
                className={
                  type === typ ? "text-white font-medium" : "text-text-muted"
                }
              >
                {t(`feed.postType.${typ}`)}
              </Text>
            </Pressable>
          ))}
        </View>

        <Input
          label={type === "event" ? t("feed.event.name") : t("feed.postTitle")}
          placeholder={type === "event" ? t("feed.event.namePlaceholder") : undefined}
          value={title}
          onChangeText={setTitle}
          maxLength={140}
        />

        <Input
          label={
            type === "event" ? t("feed.event.description") : t("feed.postBody")
          }
          value={body}
          onChangeText={setBody}
          multiline
          numberOfLines={4}
          className="min-h-[100px]"
        />

        {type === "poll" ? (
          <View className="gap-2">
            {pollOptions.map((opt, idx) => (
              <View key={idx} className="flex-row items-center gap-2">
                <View className="flex-1">
                  <Input
                    placeholder={t("feed.pollOptionPlaceholder", {
                      n: idx + 1,
                    })}
                    value={opt}
                    onChangeText={(v) => updateOption(idx, v)}
                    maxLength={80}
                  />
                </View>
                {pollOptions.length > MIN_OPTIONS ? (
                  <Pressable onPress={() => removeOption(idx)} hitSlop={8}>
                    <Ionicons name="close-circle" size={22} color="#9a9aa8" />
                  </Pressable>
                ) : null}
              </View>
            ))}
            {pollOptions.length < MAX_OPTIONS ? (
              <Pressable
                onPress={addOption}
                className="bg-bg-card border border-border rounded-xl py-3 items-center"
              >
                <Text className="text-accent font-medium">
                  {t("feed.pollAddOption")}
                </Text>
              </Pressable>
            ) : null}
            {!pollValid ? (
              <Text className="text-red-400 text-xs">
                {t("feed.pollNeedTwoOptions")}
              </Text>
            ) : null}
          </View>
        ) : null}

        {type === "event" ? (
          <View className="gap-3">
            <Text className="text-text-muted text-sm font-medium">
              {t("feed.event.interval")}
            </Text>
            <DateTimeRow
              label={t("feed.event.from")}
              date={start}
              onDate={() => setPicker({ field: "start", mode: "date" })}
              onTime={() => setPicker({ field: "start", mode: "time" })}
            />
            <DateTimeRow
              label={t("feed.event.to")}
              date={end}
              onDate={() => setPicker({ field: "end", mode: "date" })}
              onTime={() => setPicker({ field: "end", mode: "time" })}
            />
            {!eventValid && end.getTime() <= start.getTime() ? (
              <Text className="text-red-400 text-xs">
                {t("feed.event.endBeforeStart")}
              </Text>
            ) : null}

            <View className="flex-row items-center justify-between mt-2">
              <Text className="text-text-muted text-sm font-medium">
                {t("feed.event.participants")}
              </Text>
              <Pressable onPress={setAllParticipants} hitSlop={6}>
                <Text className="text-accent text-xs">
                  {t("feed.event.selectAll")}
                </Text>
              </Pressable>
            </View>
            <View className="gap-2">
              {(members ?? []).map((mm) => {
                const checked = participants.includes(mm.user_id);
                const name = mm.profiles?.display_name ?? "—";
                const isMe = mm.user_id === myUserId;
                return (
                  <Pressable
                    key={mm.user_id}
                    onPress={() => toggleParticipant(mm.user_id)}
                    className={`flex-row items-center gap-3 rounded-2xl p-3 border ${
                      checked
                        ? "bg-accent/15 border-accent/40"
                        : "bg-bg-card border-border"
                    }`}
                  >
                    <View
                      className={`w-6 h-6 rounded-md items-center justify-center border ${
                        checked
                          ? "bg-accent border-accent"
                          : "bg-bg-elevated border-border"
                      }`}
                    >
                      {checked ? (
                        <Ionicons name="checkmark" size={14} color="#fff" />
                      ) : null}
                    </View>
                    <Text className="text-text flex-1">
                      {name}
                      {isMe ? " (tu)" : ""}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        ) : null}

        <Button
          label={t("feed.publish")}
          onPress={() => m.mutate()}
          loading={m.isPending}
          disabled={!canPublish}
        />
      </ScrollView>

      {picker ? (
        <DateTimePicker
          value={picker.field === "start" ? start : end}
          mode={picker.mode}
          is24Hour
          onChange={handlePickerChange}
        />
      ) : null}
    </Screen>
  );
}

function DateTimeRow({
  label,
  date,
  onDate,
  onTime,
}: {
  label: string;
  date: Date;
  onDate: () => void;
  onTime: () => void;
}) {
  return (
    <View className="flex-row items-center gap-2">
      <Text className="text-text-muted text-sm w-16">{label}</Text>
      <Pressable
        onPress={onDate}
        className="flex-1 bg-bg-card border border-border rounded-xl px-3 py-3"
      >
        <Text className="text-text">
          {format(date, "d MMM yyyy", { locale: ro })}
        </Text>
      </Pressable>
      <Pressable
        onPress={onTime}
        className="bg-bg-card border border-border rounded-xl px-4 py-3"
      >
        <Text className="text-text font-mono">
          {format(date, "HH:mm", { locale: ro })}
        </Text>
      </Pressable>
    </View>
  );
}
