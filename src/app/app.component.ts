import { Component, OnDestroy, effect, inject } from '@angular/core';
import { Router } from '@angular/router';
import { App } from '@capacitor/app';
import { Capacitor, PluginListenerHandle } from '@capacitor/core';
import { ActionPerformed, LocalNotifications } from '@capacitor/local-notifications';
import { IonApp, IonRouterOutlet } from '@ionic/angular';
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
  private readonly darkMedia = window.matchMedia('(prefers-color-scheme: dark)');
  private backgroundedAt?: number;
  private appStateListener?: PluginListenerHandle;
  private notificationActionListener?: PluginListenerHandle;
  private readonly darkModeChanged = (): void => {
    if (this.store.settings().theme === 'SYSTEM')
      document.documentElement.classList.toggle('ion-palette-dark', this.darkMedia.matches);
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
      document.documentElement.classList.toggle(
        'ion-palette-dark',
        theme === 'DARK' || (theme === 'SYSTEM' && this.darkMedia.matches),
      );
      document.documentElement.classList.toggle('force-light', theme === 'LIGHT');
    });
    this.darkMedia.addEventListener('change', this.darkModeChanged);
  }

  private async initialize(): Promise<void> {
    await this.store.initialize();
    await this.security.initialize();
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
}
