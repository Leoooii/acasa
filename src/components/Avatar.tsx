import { Text, View } from "react-native";
import { Image } from "expo-image";

import { avatarPublicUrl } from "@/features/profile/api";

type Props = {
  avatarPath: string | null | undefined;
  displayName: string | null | undefined;
  statusIcon?: string | null;
  size?: number;
};

export function Avatar({
  avatarPath,
  displayName,
  statusIcon,
  size = 48,
}: Props) {
  const initial = (displayName ?? "?").charAt(0).toUpperCase();
  const url = avatarPath ? avatarPublicUrl(avatarPath) : null;

  return (
    <View style={{ width: size, height: size }}>
      <View
        className="rounded-full bg-bg-elevated border border-border items-center justify-center overflow-hidden"
        style={{ width: size, height: size }}
      >
        {url ? (
          <Image
            source={{ uri: url }}
            style={{ width: size, height: size }}
            contentFit="cover"
            transition={150}
          />
        ) : (
          <Text
            className="text-text-muted font-semibold"
            style={{ fontSize: size * 0.4 }}
          >
            {initial}
          </Text>
        )}
      </View>
      {statusIcon ? (
        <View
          className="absolute bg-bg-card border-2 border-bg rounded-full items-center justify-center"
          style={{
            width: Math.max(20, size * 0.4),
            height: Math.max(20, size * 0.4),
            bottom: -2,
            right: -2,
          }}
        >
          <Text style={{ fontSize: Math.max(11, size * 0.22) }}>
            {statusIcon}
          </Text>
        </View>
      ) : null}
    </View>
  );
}
