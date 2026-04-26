import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { t } from "@/i18n";

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: "#0b0b0e",
          borderTopColor: "#2a2a35",
        },
        tabBarActiveTintColor: "#7c5cff",
        tabBarInactiveTintColor: "#6b6b78",
      }}
    >
      <Tabs.Screen
        name="feed"
        options={{
          title: t("feed.title"),
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="megaphone-outline" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="home"
        options={{
          title: "Casa",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home-outline" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="shopping"
        options={{
          title: "Cumpărături",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="cart-outline" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="closet"
        options={{
          title: "Haine",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="shirt-outline" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="members"
        options={{
          title: "Membri",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="people-outline" color={color} size={size} />
          ),
        }}
      />
    </Tabs>
  );
}
