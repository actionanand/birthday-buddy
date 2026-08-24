# birthday-buddy

birthday-buddy is a starter Ionic Angular (v9.0.0) project created using the latest modern Ionic + Angular (v22.0.1) stack.

## Tech Stack

- **Angular:** 22.0.1
- **Ionic Angular:** ^9.0.0
- **Ionic CLI:** 7.2.1
- **Capacitor Core / CLI:** 8.5.0
- **TypeScript:** ~6.0.0
- **RxJS:** ~7.8.0
- **Ionicons:** ^8.1.0
- **ESLint:** 9.x
- **Vitest:** 4.x
- **Architecture:** Angular Standalone Components

## Prerequisites

Install a supported Node.js version and npm.

Check the installed versions:

```bash
node -v
npm -v
```

Install Angular CLI:

```bash
npm install -g @angular/cli
```

Install Ionic CLI:

```bash
npm install -g @ionic/cli
```

If the old deprecated `ionic` package is installed globally, remove it first:

```bash
npm uninstall -g ionic
npm install -g @ionic/cli
```

Verify:

```bash
ng version
ionic -v
```

> Ionic CLI and Ionic Framework use independent version numbers. `ionic -v` can show `7.2.1` while the project uses `@ionic/angular` `9.x`.

## Create a New Ionic Angular Project

Create a new Ionic Angular starter project:

```bash
ionic start birthday-buddy blank --type=angular
```

When prompted for the Angular architecture, choose:

```text
Standalone
```

Then move into the project:

```bash
cd birthday-buddy
```

Install dependencies:

```bash
npm install
```

Start the development server:

```bash
ionic serve
```

Other available Ionic starters include:

```bash
ionic start birthday-buddy tabs --type=angular
```

```bash
ionic start birthday-buddy sidemenu --type=angular
```

For this project, the recommended starter is:

```bash
ionic start birthday-buddy blank --type=angular
```

This project was created using Ionic CLI with Angular standalone components.

## Clone the Repository

```bash
git clone https://github.com/actionanand/birthday-buddy.git
cd birthday-buddy
npm install
```

## Development

Start with Ionic:

```bash
ionic serve
```

Or:

```bash
npm start
```

The development server normally runs at:

```text
http://localhost:8100
```

## Available Scripts

```bash
npm start
npm run build
npm run watch
npm test
npm run lint
```

## Production Build

```bash
ionic build --configuration production
```

Or:

```bash
npm run build
```

## Architecture

Life Leaf uses Angular standalone architecture.

Typical structure:

```text
src/
├── app/
│   ├── components/
│   ├── pages/
│   ├── services/
│   ├── models/
│   ├── guards/
│   ├── app.component.ts
│   ├── app.config.ts
│   └── app.routes.ts
├── assets/
├── theme/
├── global.scss
├── index.html
└── main.ts
```

## Ionic Standalone Components

Use Ionic standalone imports:

```typescript
import {
  IonButton,
  IonContent,
  IonHeader,
  IonTitle,
  IonToolbar
} from '@ionic/angular/standalone';
```

Example:

```typescript
import { Component } from '@angular/core';
import {
  IonButton,
  IonContent,
  IonHeader,
  IonTitle,
  IonToolbar
} from '@ionic/angular/standalone';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [
    IonButton,
    IonContent,
    IonHeader,
    IonTitle,
    IonToolbar
  ],
  templateUrl: './home.page.html',
  styleUrl: './home.page.scss'
})
export class HomePage {}
```

## Generate Files

Page:

```bash
ionic g page pages/home
```

Component:

```bash
ionic g component components/example
```

Service:

```bash
ionic g service services/example
```

Guard:

```bash
ng g guard guards/example
```

Interface:

```bash
ng g interface models/example
```

## Capacitor

Check Capacitor:

```bash
npx cap doctor
```

Sync native projects:

```bash
npx cap sync
```

Copy web assets:

```bash
npx cap copy
```

## Android

Install Android support:

```bash
npm install @capacitor/android
```

Add Android:

```bash
npx cap add android
```

Build and sync:

```bash
ionic build
npx cap sync android
```

Open Android Studio:

```bash
npx cap open android
```

### Normal Android Workflow

```bash
ionic build
npx cap sync android
```

If only web content changed:

```bash
ionic build
npx cap copy android
```

### Run on Android

```bash
ionic cap run android
```

Live reload:

```bash
ionic cap run android -l --external
```

## Debug APK

```bash
ionic build
npx cap sync android
cd android
./gradlew assembleDebug
```

Windows:

```powershell
gradlew.bat assembleDebug
```

Output:

```text
android/app/build/outputs/apk/debug/app-debug.apk
```

## Release APK

```bash
ionic build --configuration production
npx cap sync android
cd android
./gradlew assembleRelease
```

Output:

```text
android/app/build/outputs/apk/release/
```

## Android App Bundle

For Google Play:

```bash
ionic build --configuration production
npx cap sync android
cd android
./gradlew bundleRelease
```

Output:

```text
android/app/build/outputs/bundle/release/app-release.aab
```

> Release builds must be configured with the appropriate Android signing credentials.

## iOS

```bash
npm install @capacitor/ios
npx cap add ios
ionic build
npx cap sync ios
npx cap open ios
```

> iOS builds require macOS and Xcode.

## Common Capacitor Plugins

### App

```bash
npm install @capacitor/app
npx cap sync
```

### Haptics

```bash
npm install @capacitor/haptics
npx cap sync
```

### Keyboard

```bash
npm install @capacitor/keyboard
npx cap sync
```

### Status Bar

```bash
npm install @capacitor/status-bar
npx cap sync
```

### Preferences

```bash
npm install @capacitor/preferences
npx cap sync
```

### Filesystem

```bash
npm install @capacitor/filesystem
npx cap sync
```

### Share

```bash
npm install @capacitor/share
npx cap sync
```

### Browser

```bash
npm install @capacitor/browser
npx cap sync
```

After adding or updating native plugins:

```bash
npx cap sync
```

## Ionicons

```typescript
import { addIcons } from 'ionicons';

import {
  addOutline,
  createOutline,
  settingsOutline,
  trashOutline
} from 'ionicons/icons';

addIcons({
  addOutline,
  createOutline,
  settingsOutline,
  trashOutline
});
```

Template:

```html
<ion-icon name="settings-outline"></ion-icon>
```

## Check Versions

```bash
ionic info
ng version
npm list @ionic/angular
npm list @capacitor/core @capacitor/cli
```

Check everything important together:

```bash
npm list @angular/core @angular/cli @ionic/angular @capacitor/core @capacitor/cli
```

## Updating Dependencies

Check outdated packages:

```bash
npm outdated
```

### Angular

```bash
ng update
ng update @angular/core @angular/cli
```

### Ionic

```bash
npm list @ionic/angular
npm install @ionic/angular@latest
```

### Capacitor

Keep these packages on matching major versions:

```text
@capacitor/core
@capacitor/cli
@capacitor/android
@capacitor/ios
```

Example:

```bash
npm install @capacitor/core@latest
npm install -D @capacitor/cli@latest
npm install @capacitor/android@latest
npx cap sync
```

Review official migration guidance before major-version upgrades.

## Clean Installation

Linux/macOS/WSL:

```bash
rm -rf node_modules
rm -f package-lock.json
npm install
```

Windows PowerShell:

```powershell
Remove-Item -Recurse -Force node_modules
Remove-Item package-lock.json
npm install
```

Then:

```bash
ionic build
npx cap sync
```

## Troubleshooting

If changes are not appearing in Android:

```bash
ionic build
npx cap sync android
```

Check Capacitor:

```bash
npx cap doctor
```

Check Ionic environment:

```bash
ionic info
```

Check dependencies:

```bash
npm outdated
```

Check exact framework versions:

```bash
npm list @angular/core @ionic/angular @capacitor/core
```

## Security

Do not commit:

- Passwords
- API secrets
- Private tokens
- Private keys
- Android signing passwords
- Keystore passwords
- Service-account credentials
- Production secrets

Store CI/CD secrets in GitHub Actions Secrets or another secure secret manager.

Values included in Angular frontend environment files should not be considered secret because frontend application bundles can be inspected.

## Recommended Practices

- Use Angular standalone components.
- Use Angular Signals where appropriate.
- Prefer lazy-loaded routes.
- Use strict TypeScript.
- Separate business logic from UI components.
- Keep data-access logic in dedicated services.
- Use Capacitor for supported native functionality.
- Keep platform-specific code isolated.
- Import only required Ionic standalone components.
- Run tests, linting, and production builds before release.
- Upgrade Angular, Ionic, and Capacitor deliberately rather than blindly upgrading major versions.

## Quick Reference

```bash
# Create project
ionic start birthday-buddy blank --type=angular

# Install
npm install

# Development
ionic serve

# Environment
ionic info
ng version

# Build
ionic build --configuration production

# Android sync
npx cap sync android

# Android Studio
npx cap open android

# Run Android
ionic cap run android

# Capacitor diagnostics
npx cap doctor

# Package updates
npm outdated

# Google Play AAB
cd android
./gradlew bundleRelease
```

## Repository

https://github.com/actionanand/birthday-buddy

## License

Add the appropriate license before public distribution.
