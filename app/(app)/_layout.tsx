import { Redirect, Stack } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { ActivityIndicator, View } from "react-native";
import { useEffect } from "react";

import { listMySpaces } from "@/features/spaces/api";
import { useSession } from "@/stores/session";
import { useActiveSpace } from "@/stores/activeSpace";

export default function AppLayout() {
  const session = useSession((s) => s.session);
  const activeSpaceId = useActiveSpace((s) => s.activeSpaceId);
  const setActiveSpace = useActiveSpace((s) => s.setActiveSpace);

  const { data: spaces, isLoading } = useQuery({
    queryKey: ["my-spaces"],
    queryFn: listMySpaces,
    enabled: !!session,
  });

  useEffect(() => {
    if (!spaces) return;
    if (spaces.length === 0) return;
    const stillValid = spaces.some((s) => s.space_id === activeSpaceId);
    if (!stillValid) {
      setActiveSpace(spaces[0]?.space_id ?? null);
    }
  }, [spaces, activeSpaceId, setActiveSpace]);

  if (!session) return <Redirect href="/(auth)/sign-in" />;

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-bg">
        <ActivityIndicator color="#7c5cff" />
      </View>
    );
  }

  if (!spaces || spaces.length === 0) {
    return <Redirect href="/onboarding" />;
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}
