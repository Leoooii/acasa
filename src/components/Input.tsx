import { TextInput, View, Text } from "react-native";
import type { TextInputProps } from "react-native";
import { forwardRef } from "react";

type Props = TextInputProps & {
  label?: string;
  error?: string;
};

export const Input = forwardRef<TextInput, Props>(function Input(
  { label, error, className, ...rest },
  ref,
) {
  return (
    <View className="gap-1.5">
      {label ? (
        <Text className="text-text-muted text-sm font-medium">{label}</Text>
      ) : null}
      <TextInput
        ref={ref}
        placeholderTextColor="#6b6b78"
        className={`bg-bg-card border ${error ? "border-red-500" : "border-border"} rounded-2xl px-4 py-3.5 text-text text-base ${className ?? ""}`}
        {...rest}
      />
      {error ? <Text className="text-red-400 text-xs">{error}</Text> : null}
    </View>
  );
});
