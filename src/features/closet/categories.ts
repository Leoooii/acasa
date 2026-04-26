export type Slot =
  | "top"
  | "bottom"
  | "dress"
  | "outerwear"
  | "shoes"
  | "socks"
  | "underwear"
  | "accessory"
  | "other";

export type CategoryPreset = {
  label: string;
  slot: Slot;
  emoji: string;
};

export const CATEGORY_PRESETS: ReadonlyArray<CategoryPreset> = [
  { label: "Tricou", slot: "top", emoji: "👕" },
  { label: "Cămașă", slot: "top", emoji: "👔" },
  { label: "Bluză", slot: "top", emoji: "👚" },
  { label: "Pulover", slot: "outerwear", emoji: "🧶" },
  { label: "Hanorac", slot: "outerwear", emoji: "🧥" },
  { label: "Jachetă", slot: "outerwear", emoji: "🧥" },
  { label: "Palton", slot: "outerwear", emoji: "🧥" },
  { label: "Geacă", slot: "outerwear", emoji: "🧥" },

  { label: "Pantaloni", slot: "bottom", emoji: "👖" },
  { label: "Blugi", slot: "bottom", emoji: "👖" },
  { label: "Pantaloni scurți", slot: "bottom", emoji: "🩳" },
  { label: "Fustă", slot: "bottom", emoji: "👗" },

  { label: "Rochie", slot: "dress", emoji: "👗" },

  { label: "Pantofi", slot: "shoes", emoji: "👞" },
  { label: "Adidași", slot: "shoes", emoji: "👟" },
  { label: "Cizme", slot: "shoes", emoji: "🥾" },
  { label: "Sandale", slot: "shoes", emoji: "👡" },

  { label: "Șosete", slot: "socks", emoji: "🧦" },
  { label: "Lenjerie", slot: "underwear", emoji: "🩲" },

  { label: "Pălărie", slot: "accessory", emoji: "🎩" },
  { label: "Șapcă", slot: "accessory", emoji: "🧢" },
  { label: "Eșarfă", slot: "accessory", emoji: "🧣" },
  { label: "Mănuși", slot: "accessory", emoji: "🧤" },
  { label: "Curea", slot: "accessory", emoji: "👔" },
];

export const SLOT_LABELS: Record<Slot, string> = {
  top: "Sus",
  bottom: "Jos",
  dress: "Rochie",
  outerwear: "Strat exterior",
  shoes: "Încălțăminte",
  socks: "Șosete",
  underwear: "Lenjerie",
  accessory: "Accesoriu",
  other: "Altul",
};

export const SLOTS: ReadonlyArray<Slot> = [
  "top",
  "bottom",
  "dress",
  "outerwear",
  "shoes",
  "socks",
  "underwear",
  "accessory",
  "other",
];

export function findPreset(label: string | null | undefined) {
  if (!label) return undefined;
  const normalized = label.trim().toLowerCase();
  return CATEGORY_PRESETS.find((p) => p.label.toLowerCase() === normalized);
}

export const COLOR_PRESETS = [
  "negru",
  "alb",
  "gri",
  "bej",
  "maro",
  "albastru",
  "roșu",
  "verde",
  "galben",
  "portocaliu",
  "roz",
  "violet",
  "crem",
] as const;

export const SEASONS = ["all", "spring", "summer", "autumn", "winter"] as const;
export const SEASON_LABELS: Record<(typeof SEASONS)[number], string> = {
  all: "Toate sezoanele",
  spring: "Primăvară",
  summer: "Vară",
  autumn: "Toamnă",
  winter: "Iarnă",
};
