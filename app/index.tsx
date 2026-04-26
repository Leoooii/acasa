import { Redirect } from "expo-router";
import { ActivityIndicator, View } from "react-native";

import { useSession } from "@/stores/session";
import { useActiveSpace } from "@/stores/activeSpace";

export default function Index() {
  const session = useSession((s) => s.session);
  const loading = useSession((s) => s.loading);
  const hydrated = useActiveSpace((s) => s.hydrated);

  if (loading || !hydrated) {
    return (
      <View className="flex-1 items-center justify-center bg-bg">
        <ActivityIndicator color="#7c5cff" />
      </View>
    );
  }
  if (!session) return <Redirect href="/(auth)/sign-in" />;
  return <Redirect href="/(app)" />;
}
