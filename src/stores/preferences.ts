import { create } from "zustand";
import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "acasa.preferences.v1";

type State = {
  showAppliancesInFeed: boolean;
  hydrated: boolean;
  hydrate: () => Promise<void>;
  setShowAppliancesInFeed: (v: boolean) => Promise<void>;
};

export const usePreferences = create<State>((set, get) => ({
  showAppliancesInFeed: true,
  hydrated: false,
  hydrate: async () => {
    try {
      const raw = await AsyncStorage.getItem(KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<State>;
        if (typeof parsed.showAppliancesInFeed === "boolean") {
          set({ showAppliancesInFeed: parsed.showAppliancesInFeed });
        }
      }
    } catch {
      /* ignore */
    } finally {
      set({ hydrated: true });
    }
  },
  setShowAppliancesInFeed: async (v) => {
    set({ showAppliancesInFeed: v });
    try {
      await AsyncStorage.setItem(
        KEY,
        JSON.stringify({ showAppliancesInFeed: v }),
      );
    } catch {
      /* ignore */
    }
  },
}));
