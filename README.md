# acasa

Aplicație mobilă pentru familie / spațiu de locuit. Membrii unei case se conectează la un "spațiu" comun și își partajează feed (anunțuri, evenimente, sondaje), aparate (mașina de spălat, cuptor, etc. cu countdown live + push), listă de cumpărături, statusuri ("la sală", "doarme") și outfituri din garderoba personală.

Stack: **Expo SDK 54 + React Native + TypeScript strict + Expo Router + Supabase + NativeWind + TanStack Query + Zustand**.

---

## Features

- **Auth**: email + parolă, profil cu avatar (foto) și nume editabil
- **Spații**: creare, invitații prin cod 6-char, switcher multi-spațiu, roluri admin/membru
- **Feed**: 3 tipuri post (Anunț / Eveniment / Sondaj), reacții emoji, pagină detalii, ștergere de către autor sau admin
  - Eveniment: nume + interval (date+time picker) + participanți
  - Sondaj: 2-6 opțiuni cu votare în timp real, lista voturilor în detalii
- **Membri**: tab dedicat, fiecare cu avatar + status (24 emoji preset + text liber)
- **Casa**: WiFi (parolă + cod QR), aparate generice (washer/dryer/oven/etc.) cu sesiuni, countdown live, istoric și sidedock toggleable în feed
- **Cumpărături**: listă partajată cu 14 categorii preset, realtime, istoric "luat de [nume]"
- **Garderoba** (privată per owner):
  - Items cu foto, categorii preset cu slot-mapping (top/bottom/shoes/...) + custom
  - Filtre după categorie / culoare / sezon, search
  - **Outfits**: random generator cu constraint pe slot/culoare/sezon, creare manuală, preview "manechin", favorite
- **Push notifications** (necesită dev build): trimise prin pg_cron + pg_net direct la Expo Push API când expiră o sesiune de aparat

---

## Setup local (cu cod existent)

### 1. Clonează și instalează

```bash
git clone git@github.com:Leoooii/acasa.git
cd acasa
npm install
```

### 2. Configurează Supabase

Ai nevoie de un proiect Supabase (gratuit la [supabase.com](https://supabase.com)).

Copiază templateul de env:

```bash
cp .env.example .env.local
```

Completează în `.env.local` cu valorile din **Supabase Dashboard → Project Settings → API**:

```env
EXPO_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=<anon public key>
SUPABASE_SERVICE_ROLE_KEY=<service_role secret>  # doar pentru scripturi locale, NU se folosește în app
```

### 3. Aplică migrările SQL

În **Supabase Dashboard → SQL Editor**, rulează în ordine fișierele din [`supabase/migrations/`](supabase/migrations/):

1. `0001_init.sql` — schema MVP (tables, RLS, RPCs, triggere, storage buckets, realtime publication)
2. `0002_post_author_profile_fk.sql` — FK posts → profiles pentru embed
3. `0003_space_delete_policy.sql` — admin poate șterge spațiul
4. `0004_member_profile_fk.sql` — FK space_members → profiles pentru embed
5. `0005_appliance_fk_and_policy.sql` — FK appliance_sessions + policy pe finish
6. `0006_push_notifications.sql` — `device_tokens`, pg_cron + pg_net pentru push
7. `0007_appliance_finished_meta.sql` — `finished_by` + trigger
8. `0008_generic_appliances.sql` — tabelul `appliances` (washer/dryer/oven/...)
9. `0009_events_and_admin_delete.sql` — tip post `event`, admin poate șterge orice post
10. `0010_member_status.sql` — coloane status pe profiles + realtime
11. `0011_outfits.sql` — slot pe items + tabele `outfits` / `outfit_items`
12. `0012_remap_hoodie_slot.sql` — mapping hanorac/pulover → outerwear
13. `0013_shopping.sql` — `shopping_items` + trigger done_meta

> Notă: pentru migrarea 0006 (push) extensiile `pg_cron` și `pg_net` trebuie active. Pe planul gratuit Supabase merg, dar dacă cere activare manual mergi la **Database → Extensions** și le activezi.

### 4. Configurează auth

În **Supabase Dashboard → Authentication → Providers**:

- Email provider: ON
- Confirm email: **OFF** (opțional, simplifică dezvoltarea — link-ul de confirmare default duce la `localhost:3000` care nu există pe mobil)

### 5. Pornește app-ul

#### Cu Expo Go (development rapid, fără push)

```bash
npx expo start
```

Scanează QR-ul cu Expo Go pe Android. **Push notifications nu funcționează** în Expo Go începând cu SDK 53.

#### Cu development build (EAS, push funcționează)

Vezi secțiunea [EAS Build](#eas-build) mai jos.

---

## Structura proiectului

```
acasa/
├── app/                      # Expo Router (file-based)
│   ├── (auth)/               # ecrane sign-in / sign-up
│   ├── (app)/                # rute autentificate
│   │   ├── (tabs)/           # 5 tab-uri: feed / home / shopping / closet / members
│   │   ├── modal/            # modale (new-post, clothing-edit, status-edit, etc.)
│   │   ├── appliance/[id]    # detalii aparat
│   │   ├── outfit/[id]       # detalii outfit
│   │   ├── post/[id]         # detalii post
│   │   └── outfits           # listă outfits
│   ├── onboarding.tsx        # creare/intrare spațiu
│   └── _layout.tsx           # root: providers, auth bootstrap
├── src/
│   ├── api/                  # supabase client + queryClient
│   ├── components/           # Avatar, Button, Input, Screen, RemoteImage
│   ├── features/             # fiecare feature izolat
│   │   ├── appliances/
│   │   ├── auth/
│   │   ├── closet/           # api + categories + photo + outfits
│   │   ├── feed/
│   │   ├── home/             # wifi
│   │   ├── notifications/
│   │   ├── profile/
│   │   ├── shopping/
│   │   └── spaces/
│   ├── hooks/                # useAuth, useCountdown
│   ├── i18n/                 # ro.json + en.json
│   ├── stores/               # zustand: session, activeSpace, preferences
│   └── theme/                # dark mode tokens
├── supabase/migrations/      # versionate, idempotente
├── app.json                  # Expo config (slug, plugins, projectId)
├── eas.json                  # EAS Build profiles
└── .env.local                # GITIGNORED — chei Supabase
```

---

## EAS Build

Pentru un APK real (cu push activ și UI ca de aplicație instalată):

### 1. Cont Expo

[expo.dev/signup](https://expo.dev/signup) — gratis, 30 build-uri/lună pe planul free.

### 2. Login + init

```bash
npx eas-cli@latest login
npx eas-cli@latest init   # creează proiect EAS și-l scrie în app.json
```

### 3. Build dev client

```bash
npx eas-cli@latest build --profile development --platform android
```

Cloud build, ~10-15 min. Primești un link cu APK-ul în terminal + email.

### 4. Instalează APK-ul pe telefon

Deschide link-ul pe telefon → Install (permite "from unknown sources" dacă cere). Aplicația apare ca **acasa** în launcher.

### 5. Pornește dezvoltarea cu dev client

```bash
npx expo start --dev-client
```

Pe telefon deschizi noua aplicație **acasa** (nu Expo Go) → scanează QR. Hot-reload + push funcționează.

### Production APK

Pentru un APK final (fără dev client overhead):

```bash
npx eas-cli@latest build --profile preview --platform android
```

---

## Push notifications

Backend-ul rulează independent prin pg_cron (verifică la fiecare minut) și pg_net (HTTP POST direct la Expo Push API). La signin, app-ul înregistrează token-ul push în tabelul `device_tokens`. Când expiră o sesiune de aparat:

1. Cron-ul rulează `notify_expired_appliances()`
2. Funcția găsește sesiunile cu `ends_at < now()` și `notified_at is null`
3. Pentru fiecare token al membrilor spațiului, POST la `https://exp.host/--/api/v2/push/send`
4. Setează `notified_at = now()` ca să nu repete

**Important**: push-ul nu merge pe Expo Go (SDK 53+). Necesită development build sau production APK.

---

## Git workflow

```bash
# rulează typecheck înainte de commit
npx tsc --noEmit

# pentru schimbări de schemă: scrie un fișier nou supabase/migrations/00XX_*.sql
# (idempotent dacă e posibil) și aplică-l manual în SQL Editor
```

---

## Tech stack detaliat

| Strat | Tool |
|---|---|
| Frontend | React Native 0.81, React 19.1, Expo SDK 54 |
| Routing | expo-router 6 (file-based, typed routes experimental) |
| Limbaj | TypeScript strict + `noUncheckedIndexedAccess` |
| Backend | Supabase (Postgres + Auth + Realtime + Storage + Edge Functions native via pg_cron) |
| State server | TanStack Query 5 |
| State client | Zustand |
| Stiluri | NativeWind 4 + Tailwind 3.4 (dark mode din start) |
| Imagini | expo-image + expo-image-manipulator (resize la upload) |
| Push | expo-notifications + pg_cron + pg_net |
| Date | date-fns + date-fns/locale/ro |
| i18n | i18n-js (ro principal, en fallback) |
| QR | react-native-qrcode-svg |
| Date pickers | @react-native-community/datetimepicker |
