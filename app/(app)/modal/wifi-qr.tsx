import { Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import QRCode from "react-native-qrcode-svg";

import { Screen } from "@/components/Screen";
import { getWifi } from "@/features/home/wifi";
import { wifiQrPayload } from "@/features/home/wifiQr";
import { useActiveSpace } from "@/stores/activeSpace";

export default function WifiQR() {
  const activeSpaceId = useActiveSpace((s) => s.activeSpaceId);

  const { data: wifi } = useQuery({
    queryKey: ["wifi", activeSpaceId],
    queryFn: () => getWifi(activeSpaceId!),
    enabled: !!activeSpaceId,
  });

  return (
    <Screen>
      <View className="flex-row justify-between items-center pt-2 pb-3">
        <Text className="text-text text-xl font-bold">QR WiFi</Text>
        <Pressable onPress={() => router.back()}>
          <Text className="text-text-muted">Închide</Text>
        </Pressable>
      </View>

      {wifi?.ssid ? (
        <View className="flex-1 items-center justify-center gap-6">
          <View className="bg-white rounded-3xl p-6">
            <QRCode value={wifiQrPayload(wifi)} size={260} />
          </View>
          <View className="items-center gap-1">
            <Text className="text-text text-lg font-semibold">{wifi.ssid}</Text>
            <Text className="text-text-muted text-sm">
              Scanează cu camera ca să te conectezi
            </Text>
          </View>
        </View>
      ) : (
        <View className="flex-1 items-center justify-center">
          <Text className="text-text-muted">
            Nu există WiFi setat în acest spațiu.
          </Text>
        </View>
      )}
    </Screen>
  );
}
