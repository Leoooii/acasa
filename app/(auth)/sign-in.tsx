import { useState } from "react";
import { Text, View, Alert, Pressable } from "react-native";
import { Link, router } from "expo-router";

import { Screen } from "@/components/Screen";
import { Input } from "@/components/Input";
import { Button } from "@/components/Button";
import { signInWithEmail } from "@/features/auth/api";
import { t } from "@/i18n";

export default function SignIn() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit() {
    setSubmitting(true);
    try {
      await signInWithEmail(email, password);
      router.replace("/");
    } catch (err) {
      Alert.alert(
        t("auth.signIn"),
        err instanceof Error ? err.message : t("auth.errors.generic"),
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Screen>
      <View className="flex-1 justify-center gap-6">
        <View className="gap-2">
          <Text className="text-text text-3xl font-bold">{t("app.name")}</Text>
          <Text className="text-text-muted">{t("auth.signIn")}</Text>
        </View>
        <View className="gap-4">
          <Input
            label={t("auth.email")}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
          />
          <Input
            label={t("auth.password")}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete="password"
          />
          <Button
            label={t("auth.submitSignIn")}
            onPress={onSubmit}
            loading={submitting}
          />
        </View>
        <Link href="/(auth)/sign-up" asChild>
          <Pressable className="items-center py-2">
            <Text className="text-accent">{t("auth.switchToSignUp")}</Text>
          </Pressable>
        </Link>
      </View>
    </Screen>
  );
}
