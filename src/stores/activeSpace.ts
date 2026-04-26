import { create } from "zustand";
import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "acasa.activeSpaceId";

type ActiveSpaceState = {
  activeSpaceId: string | null;
  hydrated: boolean;
  hydrate: () => Promise<void>;
  setActiveSpace: (id: string | null) => Promise<void>;
};

export const useActiveSpace = create<ActiveSpaceState>((set) => ({
  activeSpaceId: null,
  hydrated: false,
  hydrate: async () => {
    const id = await AsyncStorage.getItem(KEY);
    set({ activeSpaceId: id, hydrated: true });
  },
  setActiveSpace: async (id) => {
    if (id) await AsyncStorage.setItem(KEY, id);
    else await AsyncStorage.removeItem(KEY);
    set({ activeSpaceId: id });
  },
}));
