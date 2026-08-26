import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Capacitor } from '@capacitor/core';
import {
  AlertController,
  IonBackButton,
  IonBadge,
  IonButton,
  IonButtons,
  IonCheckbox,
  IonContent,
  IonHeader,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonSelect,
  IonSelectOption,
  IonTitle,
  IonToggle,
  IonToolbar,
  LoadingController,
  ToastController,
} from '@ionic/angular';
import { AppSettings, REMINDER_PRESETS, ReminderChoice } from '../../core/models/domain.models';
import { BackupService } from '../../core/services/backup.service';
import { BirthdayStoreService } from '../../core/services/birthday-store.service';
import { ContactSyncService } from '../../core/services/contact-sync.service';
import { PinService } from '../../core/services/pin.service';
import { ReminderSchedulerService } from '../../core/services/reminder-scheduler.service';

@Component({
  selector: 'app-settings',
  imports: [
    RouterLink,
    IonBackButton,
    IonBadge,
    IonButton,
    IonButtons,
    IonCheckbox,
    IonContent,
    IonHeader,
    IonIcon,
    IonItem,
    IonLabel,
    IonList,
    IonSelect,
    IonSelectOption,
    IonTitle,
    IonToggle,
    IonToolbar,
  ],
  template: `<ion-header
      ><ion-toolbar
        ><ion-buttons slot="start"><ion-back-button defaultHref="/tabs/home"></ion-back-button></ion-buttons
        ><ion-title>Settings</ion-title></ion-toolbar
      ></ion-header
    ><ion-content
      ><main class="settings-shell">
        <section>
          <p class="settings-kicker">Appearance</p>
          <ion-list inset="true"
            ><ion-item
              ><ion-select
                label="Theme"
                interface="action-sheet"
                [value]="settings().theme"
                (ionChange)="patch({ theme: $any($event.detail.value) })"
                ><ion-select-option value="SYSTEM">Automatic</ion-select-option
                ><ion-select-option value="LIGHT">Light</ion-select-option
                ><ion-select-option value="DARK">Dark</ion-select-option></ion-select
              ></ion-item
            ><ion-item
              ><ion-toggle
                justify="space-between"
                [checked]="settings().showAge"
                (ionChange)="patch({ showAge: $any($event.detail.checked) })"
                >Show age and anniversary number</ion-toggle
              ></ion-item
            ></ion-list
          >
        </section>
        <section>
          <p class="settings-kicker">Default reminders</p>
          <ion-list inset="true">
            @for (preset of presets; track key(preset.choice)) {
              <ion-item
                ><ion-checkbox
                  justify="space-between"
                  [checked]="defaultSelected(preset.choice)"
                  (ionChange)="toggleDefault(preset.choice, $any($event.detail.checked))"
                  >{{ preset.label }}</ion-checkbox
                ></ion-item
              >
            }
            <ion-item
              ><ion-label><p>Default reminder time</p></ion-label
              ><input
                class="native-time"
                type="time"
                [value]="defaultTime()"
                aria-label="Default reminder time"
                (change)="timeChanged($event)" /></ion-item
          ></ion-list>
        </section>
        <section>
          <p class="settings-kicker">Notifications & dates</p>
          <ion-list inset="true"
            ><ion-item
              ><ion-select
                label="Notification content"
                interface="action-sheet"
                [value]="settings().notificationPrivacy"
                (ionChange)="patch({ notificationPrivacy: $any($event.detail.value) })"
                ><ion-select-option value="FULL">Person + Occasion</ion-select-option
                ><ion-select-option value="PERSON_ONLY">Person Only</ion-select-option
                ><ion-select-option value="PRIVATE">Private</ion-select-option></ion-select
              ></ion-item
            ><ion-item
              ><ion-select
                label="Feb 29 in non-leap years"
                interface="action-sheet"
                [value]="settings().feb29Policy"
                (ionChange)="patch({ feb29Policy: $any($event.detail.value) })"
                ><ion-select-option value="FEB_28">February 28</ion-select-option
                ><ion-select-option value="MAR_1">March 1</ion-select-option
                ><ion-select-option value="LEAP_ONLY">Only in leap years</ion-select-option></ion-select
              ></ion-item
            ></ion-list
          >
        </section>
        @if (contacts.available) {
          <section>
            <p class="settings-kicker">Contacts</p>
            <ion-list inset="true"
              ><ion-item
                ><ion-select
                  label="Contacts sync"
                  interface="action-sheet"
                  [value]="settings().contactSyncMode"
                  (ionChange)="patch({ contactSyncMode: $any($event.detail.value) })"
                  ><ion-select-option value="MANUAL">Manual Only</ion-select-option
                  ><ion-select-option value="APP_OPEN">Check When App Opens</ion-select-option
                  ><ion-select-option value="DAILY">Once Per Day</ion-select-option></ion-select
                ></ion-item
              ><ion-item button="true" detail="true" (click)="syncNow()"
                ><ion-icon slot="start" name="sync-outline"></ion-icon
                ><ion-label
                  ><h2>Sync Contacts Now</h2>
                  <p>Update linked names, photos, dates, and contact status</p></ion-label
                ></ion-item
              >
              @for (ignore of store.ignores(); track ignore.id) {
                <ion-item
                  ><ion-icon slot="start" name="archive-outline"></ion-icon
                  ><ion-label
                    ><h2>Ignored {{ ignore.ignoreType === 'CONTACT' ? 'contact' : 'occasion' }}</h2>
                    <p>{{ ignore.androidContactLookupKey }}</p></ion-label
                  ><ion-button slot="end" fill="clear" (click)="store.allowImportAgain(ignore.id)"
                    >Allow again</ion-button
                  ></ion-item
                >
              }
            </ion-list>
          </section>
        }
        <section>
          <p class="settings-kicker">Security</p>
          <ion-list inset="true">
            @if (!security.configured()) {
              <ion-item button="true" detail="true" (click)="configurePin()"
                ><ion-icon slot="start" name="key-outline"></ion-icon><ion-label>Enable PIN</ion-label></ion-item
              >
            } @else {
              <ion-item button="true" detail="true" (click)="configurePin(true)"
                ><ion-icon slot="start" name="key-outline"></ion-icon><ion-label>Change PIN</ion-label></ion-item
              ><ion-item button="true" (click)="removePin()"
                ><ion-icon slot="start" name="remove-circle-outline" color="danger"></ion-icon
                ><ion-label color="danger">Remove PIN</ion-label></ion-item
              >
              @if (native) {
                <ion-item
                  ><ion-toggle
                    justify="space-between"
                    [checked]="security.biometricEnabled()"
                    (ionChange)="biometricChanged($any($event.detail.checked))"
                    ><ion-icon slot="start" name="finger-print-outline"></ion-icon>Biometric unlock</ion-toggle
                  ></ion-item
                >
              }
              <ion-item
                ><ion-select
                  label="Auto lock"
                  interface="action-sheet"
                  [value]="settings().autoLockMinutes"
                  (ionChange)="patch({ autoLockMinutes: $any($event.detail.value) })"
                  ><ion-select-option [value]="0">Immediately</ion-select-option
                  ><ion-select-option [value]="1">1 minute</ion-select-option
                  ><ion-select-option [value]="5">5 minutes</ion-select-option
                  ><ion-select-option [value]="15">15 minutes</ion-select-option
                  ><ion-select-option [value]="30">30 minutes</ion-select-option
                  ><ion-select-option [value]="null">Never</ion-select-option></ion-select
                ></ion-item
              ><ion-item
                ><ion-toggle
                  justify="space-between"
                  [checked]="settings().lockOnBackground"
                  (ionChange)="patch({ lockOnBackground: $any($event.detail.checked) })"
                  >Lock in background</ion-toggle
                ></ion-item
              ><ion-item button="true" (click)="security.lock()"
                ><ion-icon slot="start" name="lock-closed-outline"></ion-icon><ion-label>Lock Now</ion-label></ion-item
              >
            }
          </ion-list>
        </section>
        <section>
          <p class="settings-kicker">Your data</p>
          <ion-list inset="true"
            ><ion-item button="true" detail="true" routerLink="/trash"
              ><ion-icon slot="start" name="trash-outline"></ion-icon
              ><ion-label
                ><h2>Trash</h2>
                <p>Deleted items are kept for 30 days</p></ion-label
              >
              @if (store.trashCount()) {
                <ion-badge slot="end" color="danger">{{ store.trashCount() }}</ion-badge>
              }</ion-item
            ><ion-item button="true" detail="true" (click)="createBackup()"
              ><ion-icon slot="start" name="cloud-download-outline"></ion-icon
              ><ion-label
                ><h2>Create encrypted backup</h2>
                <p>People, pictures, occasions and settings</p></ion-label
              ></ion-item
            ><ion-item button="true" detail="true" (click)="chooseRestore(restoreInput)"
              ><ion-icon slot="start" name="cloud-upload-outline"></ion-icon
              ><ion-label
                ><h2>Restore backup</h2>
                <p>Merge or replace local data</p></ion-label
              ></ion-item
            ></ion-list
          ><input
            #restoreInput
            class="visually-hidden"
            type="file"
            accept=".ocbackup,application/octet-stream"
            (change)="restoreBackup($event)" />
          <p class="privacy-footer">
            <ion-icon name="shield-checkmark-outline"></ion-icon>Everything stays on this device. No account, cloud
            database, analytics, ads, or trackers.
          </p>
        </section>
      </main></ion-content
    >`,
})
export class SettingsPage {
  readonly store = inject(BirthdayStoreService);
  readonly security = inject(PinService);
  readonly contacts = inject(ContactSyncService);
  private readonly backup = inject(BackupService);
  private readonly scheduler = inject(ReminderSchedulerService);
  private readonly alerts = inject(AlertController);
  private readonly loaders = inject(LoadingController);
  private readonly toasts = inject(ToastController);
  readonly presets = REMINDER_PRESETS;
  readonly native = Capacitor.isNativePlatform();
  readonly settings = this.store.settings;
  readonly busy = signal(false);
  key(choice: ReminderChoice): string {
    return `${choice.unit}:${choice.value}`;
  }
  defaultSelected(choice: ReminderChoice): boolean {
    return this.settings().defaultReminderOffsets.some(item => this.key(item) === this.key(choice));
  }
  async patch(patch: Partial<AppSettings>): Promise<void> {
    await this.store.updateSettings({ ...this.settings(), ...patch });
    if (patch.notificationPrivacy || patch.feb29Policy) await this.scheduler.reconcileAll(false);
  }
  async toggleDefault(choice: ReminderChoice, checked: boolean): Promise<void> {
    const values = checked
      ? [...this.settings().defaultReminderOffsets.filter(item => this.key(item) !== this.key(choice)), choice]
      : this.settings().defaultReminderOffsets.filter(item => this.key(item) !== this.key(choice));
    await this.patch({ defaultReminderOffsets: values });
  }
  defaultTime(): string {
    return `${String(this.settings().defaultReminderHour).padStart(2, '0')}:${String(this.settings().defaultReminderMinute).padStart(2, '0')}`;
  }
  async timeChanged(event: Event): Promise<void> {
    const [hour, minute] = (event.target as HTMLInputElement).value.split(':').map(Number);
    await this.patch({ defaultReminderHour: hour, defaultReminderMinute: minute });
  }
  async syncNow(): Promise<void> {
    const alert = await this.alerts.create({
      header: 'Sync Contacts',
      message:
        'Contact access is used only to update linked names, photos, birthdays, anniversaries, and contact status. Changes are stored on this device and are never uploaded.',
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Allow Contact Access',
          handler: () => {
            void this.syncAndApplyContacts();
          },
        },
      ],
    });
    await alert.present();
  }
  private async syncAndApplyContacts(): Promise<void> {
    const candidates = await this.contacts.scanContacts();
    const changes = candidates.length + this.contacts.availabilityChanges();
    await this.contacts.apply(candidates);
    await this.toast(changes ? `${changes} contact changes synced` : 'Contacts are up to date');
  }
  async configurePin(changing = false): Promise<void> {
    const inputs = [
      {
        name: 'pin',
        type: 'password' as const,
        placeholder: 'New PIN',
        attributes: { maxlength: 8, inputmode: 'numeric' },
      },
      {
        name: 'confirm',
        type: 'password' as const,
        placeholder: 'Confirm PIN',
        attributes: { maxlength: 8, inputmode: 'numeric' },
      },
    ];
    if (changing)
      inputs.unshift({
        name: 'current',
        type: 'password',
        placeholder: 'Current PIN',
        attributes: { maxlength: 8, inputmode: 'numeric' },
      });
    const alert = await this.alerts.create({
      header: changing ? 'Change PIN' : 'Enable PIN',
      message: 'Choose a 4–8 digit PIN. It cannot be recovered.',
      inputs,
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Save',
          handler: (values: { current?: string; pin?: string; confirm?: string }) => {
            if (values.pin !== values.confirm || !values.pin) {
              void this.toast('PINs must match');
              return false;
            }
            void this.savePin(values.pin, changing ? values.current : undefined);
            return true;
          },
        },
      ],
    });
    await alert.present();
  }
  private async savePin(pin: string, current?: string): Promise<void> {
    if (current !== undefined && !(await this.security.verify(current))) {
      await this.toast('Current PIN is incorrect');
      return;
    }
    try {
      await this.security.setPin(pin);
      await this.toast(current === undefined ? 'PIN enabled' : 'PIN changed');
    } catch (error: unknown) {
      await this.toast(error instanceof Error ? error.message : 'PIN could not be saved');
    }
  }
  async removePin(): Promise<void> {
    const alert = await this.alerts.create({
      header: 'Remove PIN?',
      inputs: [{ name: 'pin', type: 'password', placeholder: 'Current PIN', attributes: { inputmode: 'numeric' } }],
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Remove',
          role: 'destructive',
          handler: (values: { pin?: string }) => {
            void this.security.removePin(values.pin ?? '').then(ok => this.toast(ok ? 'PIN removed' : 'Incorrect PIN'));
          },
        },
      ],
    });
    await alert.present();
  }
  async biometricChanged(enabled: boolean): Promise<void> {
    if (!enabled) {
      await this.security.disableBiometric();
      return;
    }
    const alert = await this.alerts.create({
      header: 'Enable biometric unlock',
      message: 'Confirm your PIN first. Your secret is protected by Android Keystore.',
      inputs: [{ name: 'pin', type: 'password', placeholder: 'PIN', attributes: { inputmode: 'numeric' } }],
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Continue',
          handler: (values: { pin?: string }) => {
            void this.security
              .enableBiometric(values.pin ?? '')
              .catch((error: unknown) =>
                this.toast(error instanceof Error ? error.message : 'Biometrics could not be enabled'),
              );
          },
        },
      ],
    });
    await alert.present();
  }
  async createBackup(): Promise<void> {
    const alert = await this.alerts.create({
      header: 'Create encrypted backup',
      message: 'Use a password with at least 8 characters. Birthday Buddy cannot recover it.',
      inputs: [{ name: 'password', type: 'password', placeholder: 'Backup password' }],
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Create',
          handler: (values: { password?: string }) => {
            void this.exportBackup(values.password ?? '');
          },
        },
      ],
    });
    await alert.present();
  }
  private async exportBackup(password: string): Promise<void> {
    const loading = await this.loaders.create({ message: 'Encrypting backup…' });
    await loading.present();
    try {
      const filename = await this.backup.export(password);
      await this.toast(`Backup created: ${filename}`);
    } catch (error: unknown) {
      await this.toast(error instanceof Error ? error.message : 'Backup failed');
    } finally {
      await loading.dismiss();
    }
  }
  async restoreBackup(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    const contents = await file.text();
    input.value = '';
    await this.requestBackupPassword(contents);
  }
  async chooseRestore(input: HTMLInputElement): Promise<void> {
    if (Capacitor.getPlatform() !== 'android') {
      input.click();
      return;
    }
    try {
      const contents = await this.backup.pickBackup();
      if (contents) await this.requestBackupPassword(contents);
    } catch (error: unknown) {
      await this.toast(error instanceof Error ? error.message : 'Backup could not be opened');
    }
  }
  private async requestBackupPassword(contents: string): Promise<void> {
    const passwordAlert = await this.alerts.create({
      header: 'Unlock backup',
      inputs: [{ name: 'password', type: 'password', placeholder: 'Backup password' }],
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Continue',
          handler: (values: { password?: string }) => {
            void this.previewRestore(contents, values.password ?? '');
          },
        },
      ],
    });
    await passwordAlert.present();
  }
  private async previewRestore(contents: string, password: string): Promise<void> {
    try {
      const payload = await this.backup.preview(contents, password);
      const alert = await this.alerts.create({
        header: 'Restore backup',
        message: `${payload.people.length} people and ${payload.occasions.length} occasions. Merge keeps existing data. Replace clears it first.`,
        buttons: [
          { text: 'Cancel', role: 'cancel' },
          {
            text: 'Merge',
            handler: () => {
              void this.backup.restore(payload, 'MERGE');
            },
          },
          {
            text: 'Replace',
            role: 'destructive',
            handler: () => {
              void this.backup.restore(payload, 'REPLACE');
            },
          },
        ],
      });
      await alert.present();
    } catch (error: unknown) {
      await this.toast(error instanceof Error ? error.message : 'Restore failed');
    }
  }
  private async toast(message: string): Promise<void> {
    const toast = await this.toasts.create({ message, duration: 2300 });
    await toast.present();
  }
}
