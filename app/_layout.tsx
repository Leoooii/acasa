import "@/../global.css";
import "@/i18n";

import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { QueryClientProvider } from "@tanstack/react-query";
import { useEffect } from "react";
import { View } from "react-native";

import { queryClient } from "@/api/queryClient";
import { useAuthBootstrap } from "@/hooks/useAuth";
import { useActiveSpace } from "@/stores/activeSpace";
import { useSession } from "@/stores/session";
import { usePreferences } from "@/stores/preferences";
import { ensurePushTokenRegistered } from "@/features/notifications/api";
import { darkTheme } from "@/theme";

export default function RootLayout() {
  useAuthBootstrap();
  const hydrate = useActiveSpace((s) => s.hydrate);
  const hydratePrefs = usePreferences((s) => s.hydrate);
  const session = useSession((s) => s.session);

  useEffect(() => {
    hydrate();
    hydratePrefs();
  }, [hydrate, hydratePrefs]);

  useEffect(() => {
    if (session) {
      ensurePushTokenRegistered();
    }
  }, [session]);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <View style={[{ flex: 1 }, darkTheme]} className="dark">
        <QueryClientProvider client={queryClient}>
          <StatusBar style="light" />
          <Stack
            screenOptions={{
              headerStyle: { backgroundColor: "#0b0b0e" },
              headerTitleStyle: { color: "#f4f4f6" },
              headerTintColor: "#f4f4f6",
              contentStyle: { backgroundColor: "#0b0b0e" },
              headerShown: false,
            }}
          />
        </QueryClientProvider>
      </View>
    </GestureHandlerRootView>
  );
}
