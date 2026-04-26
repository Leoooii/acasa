import { useState } from "react";
import { Text, View, Alert, Pressable } from "react-native";
import { Link, router } from "expo-router";

import { Screen } from "@/components/Screen";
import { Input } from "@/components/Input";
import { Button } from "@/components/Button";
import { signUpWithEmail } from "@/features/auth/api";
import { t } from "@/i18n";

export default function SignUp() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit() {
    if (!name.trim()) {
      Alert.alert(t("auth.signUp"), t("auth.errors.nameRequired"));
      return;
    }
    if (password.length < 8) {
      Alert.alert(t("auth.signUp"), t("auth.errors.passwordTooShort"));
      return;
    }
    setSubmitting(true);
    try {
      await signUpWithEmail(email, password, name);
      router.replace("/");
    } catch (err) {
      Alert.alert(
        t("auth.signUp"),
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
          <Text className="text-text-muted">{t("auth.signUp")}</Text>
        </View>
        <View className="gap-4">
          <Input
            label={t("auth.displayName")}
            value={name}
            onChangeText={setName}
            autoCapitalize="words"
          />
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
          />
          <Button
            label={t("auth.submitSignUp")}
            onPress={onSubmit}
            loading={submitting}
          />
        </View>
        <Link href="/(auth)/sign-in" asChild>
          <Pressable className="items-center py-2">
            <Text className="text-accent">{t("auth.switchToSignIn")}</Text>
          </Pressable>
        </Link>
      </View>
    </Screen>
  );
}
