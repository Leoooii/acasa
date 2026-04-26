import { SafeAreaView } from "react-native-safe-area-context";
import { View, KeyboardAvoidingView, Platform } from "react-native";
import type { ReactNode } from "react";

type Props = {
  children: ReactNode;
  scroll?: boolean;
  padded?: boolean;
};

export function Screen({ children, padded = true }: Props) {
  return (
    <SafeAreaView className="flex-1 bg-bg" edges={["top", "bottom"]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 0}
        className="flex-1"
      >
        <View className={`flex-1 ${padded ? "px-5" : ""}`}>{children}</View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
