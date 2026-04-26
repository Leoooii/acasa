import { Pressable, Text, View } from "react-native";
import { router } from "expo-router";

import { Screen } from "@/components/Screen";
import { AddSpaceForm } from "@/features/spaces/AddSpaceForm";

export default function AddSpace() {
  return (
    <Screen>
      <View className="flex-1 gap-6 pt-2">
        <View className="flex-row justify-between items-center">
          <Text className="text-text text-xl font-bold">Adaugă spațiu</Text>
          <Pressable onPress={() => router.back()}>
            <Text className="text-text-muted">Închide</Text>
          </Pressable>
        </View>
        <AddSpaceForm onDone={() => router.replace("/")} />
      </View>
    </Screen>
  );
}
