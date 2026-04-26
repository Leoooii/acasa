# acasa — Roadmap

Lista features-urilor planificate dar neimplementate, organizate pe priorități. Bifate la implementare. Adaugă/șterge după nevoie.

## P0 — Următoarele lucruri (ordine sugerată)

### 1. Schimbă parola din app (logged-in)
- Buton "Schimbă parolă" în modal-ul "Profilul tău" (`status-edit.tsx`)
- Form cu **parola curentă** + **parolă nouă** (re-auth pentru securitate)
- Re-auth: `supabase.auth.signInWithPassword({ email, password })` cu parola curentă
- Dacă OK: `supabase.auth.updateUser({ password: newPassword })`
- ~5-10 min implementare

### 2. Distribuție production (app live, fără server PC)
Diferența cheie: dev build are nevoie de Metro pornit pe PC; **preview/production build conține JS embedded** și rulează standalone.

Pași concreți:
1. **Build APK preview**: `npx eas-cli build --profile preview --platform android` → APK independent (~10-15 min cloud)
2. **Distribuie**: link-ul EAS din terminal/email → trimitere prin WhatsApp/Drive → familia instalează o singură dată
3. **Setup EAS Update (OTA)** ca să nu rebuild-uiești APK la fiecare modificare:
   - `npx eas-cli update:configure`
   - Adaugă `expo-updates` plugin (deja inclus parțial)
   - Configurează canale `production` / `preview` în `eas.json`
   - Workflow ulterior: schimbi cod → `eas update --branch production` → JS-ul nou se sincronizează automat la deschiderea app-ului pe telefoanele utilizatorilor
4. **Limitări OTA**: schimbări native (deps noi din package.json care au cod nativ) cer rebuild APK. Schimbări JS pure → OTA în ~5 secunde.

### 3. Recuperare parolă (forgot password) cu email
- Buton "Am uitat parola" pe `sign-in.tsx` → ecran cu input email
- `supabase.auth.resetPasswordForEmail(email, { redirectTo: 'acasa://reset-password' })`
- **Configurare Supabase** Dashboard → Auth → URL Configuration → adaugă `acasa://reset-password` la "Redirect URLs"
- **Deep link handling** în app: la deschidere prin link-ul din email → ecran cu "parolă nouă" → `supabase.auth.updateUser({ password })`
- Necesită dev build (deep link nu merge pe Expo Go)
- ~20-30 min + debugging deep link
- Notă: pe lângă reset, ar trebui și **fluxul de email confirmation** mutat la deep link (acum link-ul de signup duce la localhost)

---

## P1 — Următoarele features mari

### Feed
- **Comentarii la post-uri** — schema + RLS, secțiune comentarii pe post detail, realtime
- **Mark-as-seen / unread badges** — un counter de post-uri necitite per spațiu, badge pe tab Feed
- **Pinned posts** — coloană `is_pinned` pe `posts`, butoane în post detail (admin), pinned apar primele
- **Push pentru post-uri noi** — extensie a `notify_expired_appliances` care trimite push când apare un post nou cu @menționare sau "anunț important"

### Calendar / Evenimente
- **Tab/secțiune Calendar** — vizualizare lunară a tuturor evenimentelor din feed (filtrabile după participanți)
- **Reminder eveniment** — push cu N minute/ore înainte de start_at

### Outfits
- **Two-color random** — random cu 2 culori specifice (în loc de 1 culoare sau toate)
- **Edit outfit** — modifică itemele unui outfit existent (acum doar nume)
- **Outfit pentru sezon curent** — random care folosește automat `season = current` ca filtru default

### Aparate / Casa
- **Quiet hours** — opt-in per user în Setări, intervalul în care nu primești push-uri (ex: 23-07)
- **Editor sesiune in-progress** — modifică `ends_at` dacă greșești durata la pornire
- **Statistici aparat** — pe pagina detalii: "Folosit de 23 ori în ultima lună, în medie 87 min/sesiune"
- **Manuale + service log** — atașează PDF sau notă pentru fiecare aparat

### Cumpărături
- **Mai multe liste per spațiu** — ex: "Săptămânal", "DIY", "Magazin de dulciuri"
- **Recurring items** — itemi care reapar automat după ce sunt bifați (ex: "lapte" — la 3 zile reapare)
- **Estimare cost** — adăugat un câmp opțional `estimated_price` cu total în footer

---

## P2 — Backlog din prompt original (nu am atins încă)

1. **Frigider / cămară** + alerte expirare
2. **Meal plan săptămânal** + generare automată listă cumpărături
3. **Chores cu rotație automată** (gunoi, vase) cu schedule
4. **Cheltuieli comune** stil Splitwise lite (datorii reciproce, settle-uri)
5. **Citiri contoare** lunare cu grafic
6. **Aniversări** / zile de naștere cu reminder push
7. **Pet/plante schedule** — stropit, mâncare animale
8. **Geofencing opt-in** ("X a ajuns acasă") — leverage `expo-location` background
9. **Vault documente** (asigurări, contracte) — Supabase Storage privat per spațiu
10. **Audit/gamification ușoară** ("Maria a folosit washer-ul de 12 ori, Andrei de 3")
11. **Borrow tracker** — cine a împrumutat ce, cui
12. **Web companion** — actualmente structurat web-friendly; activare reală cere config Expo Router web + adaptare câteva componente

---

## Polish & infra

- **Icoane app** custom (acum default Expo) — generare prin `expo-icons` sau adăugare manuală în `assets/images/`
- **Splash screen** branded
- **Onboarding tutorial** — primul login să ghideze prin cele 5 tab-uri
- **Settings screen separat** — actualmente "settings" sunt împrăștiate în space-settings + status-edit; centralizare sub un buton
- **Localization complet** — există i18n setup, dar majoritatea string-urilor sunt hardcoded RO. Audit + migrare la `t()` pentru toate
- **Light mode** — actualmente dark-only; tokens-urile permit ușor adăugare; doar pictat
- **Accessibility audit** — `accessibilityLabel` pe butoane, focus management în modale
- **Performance** — image lazy loading în liste mari (closet 100+ items), query batching
- **Backups / export** — buton "Exportă tot ce am" → JSON cu toate post-urile, items, etc.
- **Migration runner local** — script Node care aplică `supabase/migrations/` în ordine via service_role (în loc de paste în SQL Editor manual)
- **CI**: GitHub Actions pentru `tsc --noEmit` și lint la fiecare PR

---

## Auth & Security

- **OAuth Google** — login one-tap, dar nu e gratuit pe Supabase free (verifică)
- **Two-factor (2FA)** — TOTP via Supabase Auth
- **Rate limiting** custom — Supabase are default, dar poate fi necesar tighter pe endpoint-uri sensibile
- **Service role rotation** — periodic, mai ales după ce a apărut în chat/repo (am notat la început, încă nu rotit)
- **Email templates customizate** — Supabase Dashboard → Auth → Email Templates (acum sunt cele default în engleză)

---

## Push notifications

- **Tap pe push → navighează** — handler `Notifications.addNotificationResponseReceivedListener` care navighează la pagina relevantă (ex: appliance detail) pe baza `data.appliance_id`
- **Topice / canale multiple** — separate channels pentru appliance vs. post-uri, ca utilizatorul să poată dezactiva selectiv
- **Token cleanup** — șterge tokens expirate (Expo returnează errors la POST → cleanup)

---

## Note de implementare

- Migrările sunt **versionate, idempotente unde se poate**. Pentru schimbări de schemă: `supabase/migrations/00XX_description.sql`
- TypeScript strict cu `noUncheckedIndexedAccess`. Nu afecta tipul `Database` automat — regenerează cu `supabase gen types typescript --project-id mkwjhvvskcuhtidwifjv > src/types/database.ts` și activează `<Database>` la `createClient` în `src/api/supabase.ts`
- Realtime: orice tabel care expune live updates trebuie în publicația `supabase_realtime` (vezi migrațiile precedente pentru pattern)
- RLS pattern: **service_role bypass; ceilalți validați prin `is_space_member(space_id)`**
