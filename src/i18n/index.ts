import { I18n } from "i18n-js";
import { getLocales } from "expo-localization";

import ro from "./ro.json";
import en from "./en.json";

const i18n = new I18n({ ro, en });

i18n.defaultLocale = "ro";
i18n.enableFallback = true;
i18n.locale = getLocales()[0]?.languageCode ?? "ro";

export const t = (scope: string, options?: Record<string, unknown>) =>
  i18n.t(scope, options);

export default i18n;
