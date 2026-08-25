import { Component, effect, inject } from '@angular/core';
import { App } from '@capacitor/app';
import { IonApp, IonRouterOutlet } from '@ionic/angular';
import { addIcons } from 'ionicons';
import {
  add,
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
  peopleOutline,
  removeCircleOutline,
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
export class AppComponent {
  readonly store = inject(BirthdayStoreService);
  readonly security = inject(PinService);
  private readonly scheduler = inject(ReminderSchedulerService);
  private readonly contacts = inject(ContactSyncService);
  private readonly darkMedia = window.matchMedia('(prefers-color-scheme: dark)');
  private backgroundedAt?: number;

  constructor() {
    addIcons({
      add,
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
      peopleOutline,
      removeCircleOutline,
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
    this.darkMedia.addEventListener('change', () => {
      if (this.store.settings().theme === 'SYSTEM')
        document.documentElement.classList.toggle('ion-palette-dark', this.darkMedia.matches);
    });
  }

  private async initialize(): Promise<void> {
    await this.store.initialize();
    await this.security.initialize();
    await this.scheduler.reconcileAll(false);
    await this.contacts.automaticScanIfDue();
    await App.addListener('appStateChange', ({ isActive }) => {
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
}
