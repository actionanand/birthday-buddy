# Birthday Buddy Android build and release guide

Birthday Buddy uses Capacitor to package the Angular application for Android. The generated `android/` directory is intentionally not committed: local builds and GitHub Actions recreate it from the web application and then apply the idempotent native patch.

## Build files

| File                                  | Purpose                                                                                                                    |
| ------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `capacitor.config.ts`                 | App identity, web output, notification icon and splash behavior                                                            |
| `android-version.json`                | Monotonic Android `versionCode` and public `versionName`                                                                   |
| `scripts/bump-android-version.js`     | Increments the code and optionally the semantic version                                                                    |
| `scripts/patch-android.mjs`           | Adds contacts, document backup, Keystore security, recurring notification, privacy, splash, system-bar and release patches |
| `scripts/generate-keystore.mjs`       | Creates a long-lived PKCS12 release keystore                                                                               |
| `.github/workflows/android-build.yml` | Checks, generates, builds, signs, verifies, uploads and commits APK/AAB releases                                           |
| `src/assets/birthday-buddy.png`       | Canonical launcher, splash, in-app brand and Play Store artwork source                                                     |

## Required packages

From WSL2, install the dependencies declared in `package.json`:

```bash
npm install
```

The packages added for the Android and privacy features are:

```bash
npm i @capacitor/android@8.5.0 @capacitor/camera@8.0.2 @capacitor/filesystem@8.1.3 @capacitor/local-notifications@8.3.1 @capacitor/splash-screen@8.0.2 @capacitor-community/sqlite@8.1.1
```

Running `npm install` also updates `package-lock.json`. Commit that lock-file update because CI deliberately uses `npm ci`.

## Local WSL2 workflow

```bash
npm run android:add
npm run android:sync
```

`android:sync` builds the browser application, syncs Capacitor plugins and reapplies the native patch. Open the generated project from an environment with Android Studio:

```bash
npm run android:open
```

If `android/` does not exist, `npx cap sync android` reports a missing platform. Run `npm run android:add` first. The native patch is safe to rerun after every Capacitor sync.

## App identity and branding

- Application ID: `com.actionanand.birthdaybuddy.app`
- Display name: `Birthday Buddy`
- Canonical art: `src/assets/birthday-buddy.png`
- Notification channel: `occasion-reminders`
- Notification status-bar art: `ic_stat_birthday_buddy`
- Minimum Android SDK: 24
- Target Android SDK: 36

CI scales the source art to 72% of each launcher canvas so adaptive-icon masks do not clip the artwork. It also creates a 168dp centered launch image and a 512×512 `releases/playstore-icon.png`. The notification drawable is a white monochrome silhouette, which Android tints correctly against both light and dark status bars. Day/night themes set matching status and navigation bar colors and icon appearance; the launch theme intentionally stays light to match the splash artwork.

## Versioning

```bash
npm run android:version
npm run android:version:patch
npm run android:version:minor
npm run android:version:major
```

The plain command increments only `versionCode`. The other commands also update `versionName`. Google Play requires a greater `versionCode` for every uploaded release.

The `main-android` workflow increments `versionCode`, commits it with `[skip ci]`, then builds with the checked-in `versionName`.

## CI behavior and release files

The Android workflow runs only from `main-android`:

- A push to `main-android` starts the workflow.
- Manual dispatch works when the workflow is selected on `main-android`.
- Lint and unit tests run before packaging.
- Capacitor recreates `android/`; the native patch is applied afterward.
- Every build creates both a release APK and a Google Play AAB.
- Signed files are named `releases/BirthdayBuddy-<version>.apk` and `.aab`.
- Missing or invalid signing secrets produce clearly named `-unsigned` fallbacks.
- Workflow logs and the Actions summary label signed outputs with `✅` and unsigned fallbacks with `⚠️`.
- R8/resource shrinking is enabled and `BirthdayBuddy-<version>-mapping.txt` is retained for Play Console deobfuscation.
- The complete `releases/` output is committed to `main-android` and uploaded as a 30-day Actions artifact.

CI uses Node 24.16, Java 21, minimum SDK 24 and target SDK 36.

## Signing secrets

Configure these in **Repository Settings → Secrets and variables → Actions**:

| Secret              | Purpose                                                    |
| ------------------- | ---------------------------------------------------------- |
| `KEYSTORE_BASE64`   | Base64 text of the complete release keystore               |
| `KEYSTORE_PASSWORD` | Keystore password                                          |
| `KEY_ALIAS`         | Signing alias; the included generator uses `birthdaybuddy` |
| `KEY_PASSWORD`      | Private-key password; PKCS12 uses the keystore password    |

Generate and encode the keystore once on a trusted WSL/Linux machine:

```bash
npm run generate-keystore
test -s release-keystore.jks
base64 -w 0 release-keystore.jks > keystore.b64.txt
npm run keystore:type
```

Or supply a password non-interactively from a trusted local shell:

```bash
npm run generate-keystore -- --password 'YOUR_STRONG_PASSWORD'
```

Never commit `.jks`, `.keystore`, Base64 key text or passwords. Keep a secure offline copy of the release key; losing it can prevent future Play Store updates.

## Android permissions and privacy

The final merged Android manifest uses these capabilities:

- `INTERNET` loads the packaged Capacitor WebView through its local HTTPS origin; Birthday Buddy does not send personal records to a server.
- `READ_CONTACTS` is requested at runtime only after **Sync Contacts**. The selective picker is used for choosing one contact.
- `POST_NOTIFICATIONS` is requested only when an occasion with active reminders is saved.
- Camera access is requested only after **Take Photo**.
- Android Photo Picker is used by the Capacitor Camera plugin for an existing image; broad media/storage permission is not requested.
- `RECEIVE_BOOT_COMPLETED` lets Capacitor Local Notifications restore pending recurring reminders after reboot.
- `WAKE_LOCK` lets the notification receiver finish delivery while the device is idle.
- `VIBRATE` supports the standard vibration behavior of the occasion-reminder channel.
- `USE_BIOMETRIC` is used only when the user enables biometric unlock.
- The Local Notifications dependency declares `SCHEDULE_EXACT_ALARM`, but the app patch removes it from the merged manifest. Birthday Buddy deliberately schedules idle-safe inexact reminders, matching Life Leaf and avoiding Android's special exact-alarm access screen.
- `WRITE_CONTACTS`, calendar, SMS, call-log, location, microphone and phone-state permissions are never requested.

The native contact plugin reads only lookup key, display name, thumbnail, birthdays and anniversaries. Imported thumbnails are returned as app-owned image data and persisted with the person. Sync is preview-first and the application database remains the source of truth.

PIN records on Android are encrypted with an AES-GCM key stored in Android Keystore. Biometric unlock uses a separate authentication-bound Keystore key that is invalidated after biometric enrollment changes. Browser PIN verifiers use PBKDF2-SHA-256 and IndexedDB. Backups exclude PIN and biometric secrets.

Android Auto Backup and device-transfer extraction are disabled by the patch so private WebView/SQLite data is not silently copied to cloud storage. The password-encrypted `.ocbackup` export is the explicit migration path. On Android, export uses `ACTION_CREATE_DOCUMENT` and import uses `ACTION_OPEN_DOCUMENT`, so the user chooses the destination/source through the system picker without broad storage permission. Backup restoration reloads the local store, then startup reconciliation recreates notification schedules from restored reminders.

## Notification lifecycle

Each enabled reminder is registered as an annual calendar schedule on the private `occasion-reminders` Android channel. Delivery is allowed while idle but is intentionally inexact, so Android may defer it slightly under battery restrictions. Capacitor's native receivers persist and restore pending schedules after locked boot, normal boot and supported quick-boot events. The Birthday Buddy receiver invokes the same restore path after app replacement, device-time changes and timezone changes, matching Life Leaf's Android lifecycle coverage. Birthday Buddy also reconciles schedules on startup, foreground resume, reminder edits/deletes and after backup restore. Tapping a notification opens the related person, with Upcoming as a safe fallback when the record no longer exists.

## Troubleshooting

- **`npm ci` reports a lock mismatch:** run `npm install` in WSL2 and commit `package-lock.json`.
- **Missing Android platform:** run `npm run android:add`, then `npm run android:sync`.
- **Native plugin is unavailable:** ensure `npm run android:patch` ran after the last `npx cap sync android`.
- **Brand changes are absent:** rerun `npm run android:sync`; CI always regenerates launcher, splash and store art.
- **Contacts scan is denied:** Android Settings → Apps → Birthday Buddy → Permissions → Contacts.
- **Notifications are absent:** save an occasion with at least one enabled reminder and grant notification permission when asked.
- **R8 reports missing Tink annotation classes:** rerun `npm run android:patch`. The native patch adds the required narrow `-dontwarn` rules for Tink's compile-time JSR-305 and Error Prone annotations.
- **Unsigned release:** verify all signing secrets and ensure the Base64 keystore text is complete.
- **AAB rejected for version code:** run `npm run android:version` before a local rebuild or let the `main-android` workflow bump it.
