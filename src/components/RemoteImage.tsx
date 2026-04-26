import { Image } from "expo-image";
import { useQuery } from "@tanstack/react-query";
import { View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { getSignedPhotoUrl } from "@/features/closet/photo";

type Props = {
  path: string | null;
  className?: string;
  fallbackIcon?: keyof typeof Ionicons.glyphMap;
};

export function RemoteImage({ path, className, fallbackIcon = "shirt-outline" }: Props) {
  const { data: url, error } = useQuery({
    queryKey: ["signed-url", path],
    queryFn: () => getSignedPhotoUrl(path!),
    enabled: !!path,
    staleTime: 50 * 60 * 1000,
  });

  if (error) console.warn("[RemoteImage] sign err:", error.message);

  if (!path || !url) {
    return (
      <View
        className={`bg-bg-elevated items-center justify-center ${className ?? ""}`}
      >
        <Ionicons name={fallbackIcon} size={32} color="#6b6b78" />
      </View>
    );
  }

  return (
    <Image
      source={{ uri: url }}
      className={className}
      style={{ width: "100%", height: "100%" }}
      contentFit="cover"
      transition={150}
      onError={(e) => console.warn("[RemoteImage] load err:", e.error)}
    />
  );
}
