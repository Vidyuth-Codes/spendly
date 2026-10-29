# Releasing Spendly

## 1. Before anyone else uses it

- [ ] Every migration in `supabase/migrations/` has been run, in order (the last is `20260921050000_delete_account.sql`).
- [ ] `node supabase/verify-live.mjs` prints **All checks passed** (needs "Confirm email" OFF in Supabase while it runs).
- [ ] `.env` holds the **publishable/anon** key, never a `secret` or `service_role` key.
- [ ] Supabase free projects **pause after ~7 days without activity**, which would break the app for everyone. Open the app or dashboard at least weekly, or upgrade the project.
- [ ] Decide on "Confirm email" (see below).

**Confirm email.** Off is easiest for a friends beta. Turning it on needs a custom SMTP provider: Supabase's built-in email sender allows only a few emails per hour, so a handful of friends signing up would hit the limit. Keep it off for the beta; consider it before a public launch.

## 2. Build a shareable app (no Play Store needed)

One-time setup, in the `spendly` folder:

```bash
npm install -g eas-cli
eas login
eas init
eas env:push preview --path .env
eas env:push production --path .env
```

`eas env:push` uploads the two `EXPO_PUBLIC_*` values so cloud builds can use them (a cloud build cannot see your local `.env`).

Then build an installable Android file:

```bash
eas build --platform android --profile preview
```

When it finishes (about 10-15 minutes) you get a link and QR code. Anyone opening it on an Android phone can download the `.apk` and install it (Android will ask them to allow installs from their browser).

## 3. Ways to get it to your friends

| Way | Setup | Friends need | Updates | Best for |
| --- | --- | --- | --- | --- |
| **A. Shared APK link** (EAS `preview` build) | Free Expo account, section 2 | Android phone, allow "install unknown apps" once | New build and new link each time (10-15 min) | Fastest start. Recommended first step |
| **B. Google Play internal / closed testing** | $25 Play Console account, section 4 | Android phone, a Gmail address, tap an opt-in link | New upload; installs update through the Play Store | Most trusted install, and it counts toward the required 12 testers |
| **C. Expo Go** | none | Expo Go app, on the same Wi-Fi or a tunnel | Live while your computer runs `npx expo start` | Quick demo in the same room only, not real feedback |

iPhone users cannot install the APK. Testing on iOS needs a paid Apple Developer account ($99/year), so plan this beta for Android.

### Sending updates to installed builds without rebuilding (optional)

```bash
npx expo install expo-updates
eas update:configure
```

Then `eas update --channel preview` pushes JavaScript-only fixes to phones that already have the app. Anything that changes native code (new native packages, `app.json` plugin changes) still needs a new build.

## 4. Google Play

1. Create a Play Console account ($25 one-time) and complete identity verification.
2. Create the app (name **Spendly**, package `com.spendly.tracker`).
3. Build the store bundle: `eas build --platform android --profile production` and upload the `.aab` under **Testing > Closed testing**, or use `eas submit --platform android`.
4. **New personal accounts must run a closed test with at least 12 testers for 14 days in a row before production.** Add friends' Gmail addresses to a tester list and share the opt-in link. Start this early: it is the longest wait.
5. Complete the store listing: short and full description, a 512 px icon (`assets/images/icon.png` works), a 1024x500 feature graphic, and at least 2 phone screenshots.
6. Host `docs/privacy-policy.html` (GitHub Pages is free), fill in its `[...]` blanks, and put the URL in the Play Console, and in `src/constants/links.ts` so Settings shows it.
7. Complete the **Data safety** form (answers below) and the content rating questionnaire.
8. Google requires an in-app way to delete an account: Settings > Delete account.

### Data safety form: what to answer

| Question | Answer |
| --- | --- |
| Does the app collect or share user data? | Collects: yes. Shares with third parties: no |
| Data collected | Email address, name, and financial info (transactions and budgets) |
| Why | App functionality and account management only. Not advertising or analytics |
| Encrypted in transit? | Yes |
| Can users request deletion? | Yes. In-app (Settings > Delete account) |
| Data shared for advertising or sold? | No |

## 5. Collecting feedback

Set `FEEDBACK_URL` in `src/constants/links.ts` to a Google Form link (or `mailto:you@example.com`) and rebuild. A **Send feedback** row then appears in Settings. Useful questions for the form: what were you trying to do, what confused you, what is missing, and would you use it weekly.
