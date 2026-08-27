import { Component, OnDestroy, effect, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { App } from '@capacitor/app';
import { Capacitor, PluginListenerHandle } from '@capacitor/core';
import { ActionPerformed, LocalNotifications } from '@capacitor/local-notifications';
import { StatusBar, Style } from '@capacitor/status-bar';
import { AlertController, IonApp, IonRouterOutlet, ToastController } from '@ionic/angular';
import { addIcons } from 'ionicons';
import {
  add,
  alertCircleOutline,
  archiveOutline,
  calendarClearOutline,
  calendarOutline,
  cameraOutline,
  checkmarkCircleOutline,
  cloudDownloadOutline,
  cloudUploadOutline,
  createOutline,
  eyeOffOutline,
  eyeOutline,
  fingerPrintOutline,
  giftOutline,
  heart,
  heartOutline,
  imageOutline,
  keyOutline,
  lockClosedOutline,
  notificationsOutline,
  personOutline,
  peopleOutline,
  removeCircleOutline,
  refreshOutline,
  settingsOutline,
  shieldCheckmarkOutline,
  syncOutline,
  todayOutline,
  trashOutline,
  unlinkOutline,
} from 'ionicons/icons';
import { BirthdayStoreService } from './core/services/birthday-store.service';
import { ContactSyncService } from './core/services/contact-sync.service';
import { PinService } from './core/services/pin.service';
import { ReminderSchedulerService } from './core/services/reminder-scheduler.service';
import { LockScreenComponent } from './shared/components/lock-screen/lock-screen.component';

const NOTIFICATION_PROMPT_KEY = 'birthday-buddy.notification-permission-v1';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  imports: [IonApp, IonRouterOutlet, LockScreenComponent],
})
export class AppComponent implements OnDestroy {
  readonly store = inject(BirthdayStoreService);
  readonly security = inject(PinService);
  private readonly scheduler = inject(ReminderSchedulerService);
  private readonly contacts = inject(ContactSyncService);
  private readonly router = inject(Router);
  private readonly alerts = inject(AlertController);
  private readonly toasts = inject(ToastController);
  private readonly darkMedia = window.matchMedia('(prefers-color-scheme: dark)');
  private readonly startupReady = signal(false);
  private backgroundedAt?: number;
  private notificationPromptStarted = false;
  private appStateListener?: PluginListenerHandle;
  private notificationActionListener?: PluginListenerHandle;
  private readonly darkModeChanged = (): void => {
    if (this.store.settings().theme === 'SYSTEM') {
      document.documentElement.classList.toggle('ion-palette-dark', this.darkMedia.matches);
      void this.updateNativeStatusBar(this.darkMedia.matches);
    }
  };

  constructor() {
    addIcons({
      add,
      alertCircleOutline,
      archiveOutline,
      calendarClearOutline,
      calendarOutline,
      cameraOutline,
      checkmarkCircleOutline,
      cloudDownloadOutline,
      cloudUploadOutline,
      createOutline,
      eyeOffOutline,
      eyeOutline,
      fingerPrintOutline,
      giftOutline,
      heart,
      heartOutline,
      imageOutline,
      keyOutline,
      lockClosedOutline,
      notificationsOutline,
      personOutline,
      peopleOutline,
      removeCircleOutline,
      refreshOutline,
      settingsOutline,
      shieldCheckmarkOutline,
      syncOutline,
      todayOutline,
      trashOutline,
      unlinkOutline,
    });
    void this.initialize();
    effect(() => {
      const theme = this.store.settings().theme;
      const dark = theme === 'DARK' || (theme === 'SYSTEM' && this.darkMedia.matches);
      document.documentElement.classList.toggle('ion-palette-dark', dark);
      document.documentElement.classList.toggle('force-light', theme === 'LIGHT');
      void this.updateNativeStatusBar(dark);
    });
    effect(() => {
      if (!this.startupReady() || !this.security.unlocked() || this.notificationPromptStarted) return;
      this.notificationPromptStarted = true;
      queueMicrotask(() => void this.promptForNotificationPermission());
    });
    this.darkMedia.addEventListener('change', this.darkModeChanged);
  }

  private async initialize(): Promise<void> {
    await this.store.initialize();
    await this.security.initialize();
    this.startupReady.set(true);
    if (Capacitor.isNativePlatform()) {
      this.notificationActionListener = await LocalNotifications.addListener(
        'localNotificationActionPerformed',
        action => void this.openNotification(action),
      );
    }
    await this.scheduler.reconcileAll(false);
    await this.contacts.automaticScanIfDue();
    this.appStateListener = await App.addListener('appStateChange', ({ isActive }) => {
      if (!isActive) {
        this.backgroundedAt = Date.now();
        if (this.store.settings().lockOnBackground && this.store.settings().autoLockMinutes === 0) this.security.lock();
        return;
      }
      const delay = this.store.settings().autoLockMinutes;
      if (
        this.store.settings().lockOnBackground &&
        delay !== null &&
        this.backgroundedAt &&
        Date.now() - this.backgroundedAt >= delay * 60_000
      )
        this.security.lock();
      void this.updateNativeStatusBar(this.isDarkTheme());
      void this.scheduler.reconcileAll(false);
    });
  }

  ngOnDestroy(): void {
    this.darkMedia.removeEventListener('change', this.darkModeChanged);
    void this.appStateListener?.remove();
    void this.notificationActionListener?.remove();
  }

  private async openNotification(action: ActionPerformed): Promise<void> {
    const extra: unknown = action.notification.extra;
    if (!extra || typeof extra !== 'object') {
      await this.router.navigate(['/tabs/upcoming']);
      return;
    }
    const personId = Reflect.get(extra, 'personId');
    const occasionId = Reflect.get(extra, 'occasionId');
    if (typeof personId === 'string' && this.store.person(personId)) {
      await this.router.navigate(['/person', personId]);
      return;
    }
    if (typeof occasionId === 'string') {
      const occasion = this.store.occasion(occasionId);
      if (occasion && this.store.person(occasion.personId)) {
        await this.router.navigate(['/person', occasion.personId]);
        return;
      }
    }
    await this.router.navigate(['/tabs/upcoming']);
  }

  private isDarkTheme(): boolean {
    const theme = this.store.settings().theme;
    return theme === 'DARK' || (theme === 'SYSTEM' && this.darkMedia.matches);
  }

  private async updateNativeStatusBar(dark: boolean): Promise<void> {
    if (!Capacitor.isNativePlatform()) return;
    await StatusBar.setStyle({ style: dark ? Style.Dark : Style.Light });
    if (Capacitor.getPlatform() === 'android') {
      await Promise.allSettled([
        StatusBar.setOverlaysWebView({ overlay: false }),
        StatusBar.setBackgroundColor({ color: dark ? '#121C17' : '#F6F3EC' }),
      ]);
    }
  }

  private async promptForNotificationPermission(): Promise<void> {
    if (Capacitor.getPlatform() !== 'android' || this.notificationPromptHandled()) return;
    try {
      if (await this.scheduler.notificationPermissionGranted()) return;
      const alert = await this.alerts.create({
        header: 'Allow birthday reminders?',
        message:
          'Birthday Buddy uses private, on-device notifications for birthdays, anniversaries, and occasions you choose to track.',
        backdropDismiss: false,
        buttons: [
          { text: 'Not now', role: 'cancel' },
          { text: 'Allow notifications', role: 'allow' },
        ],
      });
      await alert.present();
      const result = await alert.onDidDismiss();
      if (result.role !== 'allow') return;
      this.markNotificationPromptHandled();
      const granted = await this.scheduler.requestNotificationPermission();
      const toast = await this.toasts.create({
        message: granted
          ? 'Notifications enabled. Your occasion reminders are ready.'
          : 'Notifications were not enabled. You can allow them later from Android app settings.',
        duration: 2600,
      });
      await toast.present();
    } catch {
      const toast = await this.toasts.create({
        message: 'Notification permission could not be requested. You can enable it from Android app settings.',
        duration: 2600,
      });
      await toast.present();
    }
  }

  private notificationPromptHandled(): boolean {
    try {
      return localStorage.getItem(NOTIFICATION_PROMPT_KEY) === 'handled';
    } catch {
      return false;
    }
  }

  private markNotificationPromptHandled(): void {
    try {
      localStorage.setItem(NOTIFICATION_PROMPT_KEY, 'handled');
    } catch {
      // The Android permission request still works if WebView storage is unavailable.
    }
  }
}
