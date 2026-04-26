import { Pressable, Text, ActivityIndicator } from "react-native";
import type { PressableProps } from "react-native";

type Variant = "primary" | "secondary" | "ghost";

type Props = Omit<PressableProps, "children"> & {
  label: string;
  variant?: Variant;
  loading?: boolean;
};

const base =
  "rounded-2xl px-5 py-4 items-center justify-center active:opacity-80";

const variants: Record<Variant, string> = {
  primary: "bg-accent",
  secondary: "bg-bg-card border border-border",
  ghost: "bg-transparent",
};

const labelVariants: Record<Variant, string> = {
  primary: "text-white font-semibold",
  secondary: "text-text font-medium",
  ghost: "text-accent font-medium",
};

export function Button({
  label,
  variant = "primary",
  loading,
  disabled,
  ...rest
}: Props) {
  const isDisabled = !!(disabled || loading);
  return (
    <Pressable
      className={`${base} ${variants[variant]} ${isDisabled ? "opacity-50" : ""}`}
      disabled={isDisabled}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator color={variant === "primary" ? "#fff" : "#7c5cff"} />
      ) : (
        <Text className={labelVariants[variant]}>{label}</Text>
      )}
    </Pressable>
  );
}
