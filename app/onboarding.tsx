import { Pressable, Text, View } from "react-native";
import { Redirect, router } from "expo-router";

import { Screen } from "@/components/Screen";
import { AddSpaceForm } from "@/features/spaces/AddSpaceForm";
import { signOut } from "@/features/auth/api";
import { useSession } from "@/stores/session";
import { t } from "@/i18n";

export default function Onboarding() {
  const session = useSession((s) => s.session);
  if (!session) return <Redirect href="/(auth)/sign-in" />;

  return (
    <Screen>
      <View className="flex-1 gap-6 pt-12">
        <View className="gap-2">
          <Text className="text-text text-3xl font-bold">
            {t("spaces.onboardingTitle")}
          </Text>
          <Text className="text-text-muted">
            {t("spaces.onboardingSubtitle")}
          </Text>
        </View>
        <AddSpaceForm onDone={() => router.replace("/")} />
        <View className="flex-1" />
        <Pressable className="items-center py-2" onPress={signOut}>
          <Text className="text-text-muted">{t("common.signOut")}</Text>
        </Pressable>
      </View>
    </Screen>
  );
}
