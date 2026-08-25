import { Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import {
  AlertController,
  IonBackButton,
  IonButton,
  IonButtons,
  IonCheckbox,
  IonContent,
  IonDatetime,
  IonDatetimeButton,
  IonHeader,
  IonIcon,
  IonInput,
  IonItem,
  IonLabel,
  IonList,
  IonModal,
  IonNote,
  IonSelect,
  IonSelectOption,
  IonTitle,
  IonToggle,
  IonToolbar,
  ToastController,
} from '@ionic/angular';
import { OCCASION_LABELS, OccasionType, REMINDER_PRESETS, ReminderChoice } from '../../core/models/domain.models';
import { BirthdayStoreService } from '../../core/services/birthday-store.service';
import { OccasionDateService } from '../../core/services/occasion-date.service';
import { ReminderSchedulerService } from '../../core/services/reminder-scheduler.service';

@Component({
  selector: 'app-occasion-editor',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    IonBackButton,
    IonButton,
    IonButtons,
    IonCheckbox,
    IonContent,
    IonDatetime,
    IonDatetimeButton,
    IonHeader,
    IonIcon,
    IonInput,
    IonItem,
    IonLabel,
    IonList,
    IonModal,
    IonNote,
    IonSelect,
    IonSelectOption,
    IonTitle,
    IonToggle,
    IonToolbar,
  ],
  template: `<ion-header
      ><ion-toolbar
        ><ion-buttons slot="start"><ion-back-button defaultHref="/tabs/home"></ion-back-button></ion-buttons
        ><ion-title>{{ occasionId ? 'Edit Occasion' : 'Add Occasion' }}</ion-title
        ><ion-buttons slot="end"
          ><ion-button (click)="save()" [disabled]="form.invalid || saving()">Save</ion-button></ion-buttons
        ></ion-toolbar
      ></ion-header
    ><ion-content
      ><main class="form-shell">
        @if (!store.people().length) {
          <section class="callout">
            <h2>Add someone first</h2>
            <p>An occasion belongs to a person. Create a person, then return here.</p>
            <ion-button routerLink="/person/new">Add person</ion-button>
          </section>
        } @else {
          <ion-list class="form-card"
            ><ion-item
              ><ion-select
                label="Person"
                labelPlacement="stacked"
                interface="action-sheet"
                [formControl]="form.controls.personId"
                required>
                @for (person of store.people(); track person.id) {
                  <ion-select-option [value]="person.id">{{ person.name }}</ion-select-option>
                }
              </ion-select></ion-item
            ><ion-item
              ><ion-select
                label="Occasion"
                labelPlacement="stacked"
                interface="action-sheet"
                [formControl]="form.controls.type">
                @for (entry of occasionTypes; track entry[0]) {
                  <ion-select-option [value]="entry[0]">{{ entry[1] }}</ion-select-option>
                }
              </ion-select></ion-item
            >
            @if (form.controls.type.value === 'CUSTOM') {
              <ion-item
                ><ion-input
                  label="Custom occasion name"
                  labelPlacement="stacked"
                  [formControl]="form.controls.customTypeName"
                  maxlength="60"
                  required></ion-input
              ></ion-item>
            }
            <ion-item
              ><ion-label
                ><h2>Date</h2>
                <p>{{ dateLabel() }}</p></ion-label
              ><ion-datetime-button datetime="occasion-date"></ion-datetime-button></ion-item
            ><ion-item
              ><ion-toggle
                justify="space-between"
                [checked]="form.controls.yearUnknown.value"
                (ionChange)="yearUnknownChanged($any($event.detail.checked))"
                >Year unknown</ion-toggle
              ></ion-item
            ><ion-item
              ><ion-toggle justify="space-between" [formControl]="form.controls.enabled"
                >Occasion enabled</ion-toggle
              ></ion-item
            ></ion-list
          >
          <ion-modal [keepContentsMounted]="true"
            ><ng-template
              ><ion-datetime
                id="occasion-date"
                presentation="date"
                [value]="dateValue()"
                [showDefaultButtons]="true"
                [max]="maxDate"
                (ionChange)="dateChanged($any($event.detail.value))"
                ><span slot="title">Occasion date</span></ion-datetime
              ></ng-template
            ></ion-modal
          >
          <section class="form-section">
            <div class="section-heading">
              <div>
                <span class="eyebrow">Multiple alerts supported</span>
                <h2>Remind me</h2>
              </div>
            </div>
            <ion-list class="form-card">
              @for (preset of presets; track key(preset.choice)) {
                <ion-item
                  ><ion-checkbox
                    justify="space-between"
                    [checked]="selected(key(preset.choice))"
                    (ionChange)="toggleReminder(preset.choice, $any($event.detail.checked))"
                    >{{ preset.label }}</ion-checkbox
                  ></ion-item
                >
              }
              <ion-item
                ><ion-checkbox
                  justify="space-between"
                  [checked]="customEnabled()"
                  (ionChange)="customEnabled.set($any($event.detail.checked))"
                  >Custom</ion-checkbox
                ></ion-item
              >
              @if (customEnabled()) {
                <ion-item
                  ><ion-input
                    label="Days before"
                    labelPlacement="stacked"
                    inputmode="numeric"
                    type="number"
                    min="1"
                    max="365"
                    [formControl]="form.controls.customDays"></ion-input
                ></ion-item>
              }
            </ion-list>
          </section>
          <section class="form-section">
            <div class="section-heading">
              <div>
                <span class="eyebrow">Notification time</span>
                <h2>Reminder time</h2>
              </div>
            </div>
            <ion-list class="form-card"
              ><ion-item
                ><ion-toggle
                  justify="space-between"
                  [checked]="useDefaultTime()"
                  (ionChange)="useDefaultTime.set($any($event.detail.checked))"
                  >Use default time</ion-toggle
                ></ion-item
              >
              @if (!useDefaultTime()) {
                <ion-item
                  ><ion-input
                    label="Time"
                    labelPlacement="stacked"
                    type="time"
                    [formControl]="form.controls.time"></ion-input
                ></ion-item>
              } @else {
                <ion-item
                  ><ion-label
                    ><p>Default</p>
                    <h2>{{ defaultTimeLabel() }}</h2></ion-label
                  ></ion-item
                >
              }
            </ion-list>
          </section>
          @if (error()) {
            <ion-note class="form-error" color="danger" role="alert">{{ error() }}</ion-note>
          }
          <ion-button expand="block" (click)="save()" [disabled]="form.invalid || saving()">{{
            occasionId ? 'Save changes' : 'Add occasion'
          }}</ion-button>
          @if (occasionId) {
            <ion-button expand="block" fill="clear" color="danger" (click)="confirmDelete()"
              ><ion-icon slot="start" name="trash-outline"></ion-icon>Delete occasion</ion-button
            >
          }
        }
      </main></ion-content
    >`,
})
export class OccasionEditorPage {
  readonly store = inject(BirthdayStoreService);
  private readonly dates = inject(OccasionDateService);
  private readonly scheduler = inject(ReminderSchedulerService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly alerts = inject(AlertController);
  private readonly toasts = inject(ToastController);
  readonly occasionId = this.route.snapshot.paramMap.get('id');
  readonly presets = REMINDER_PRESETS;
  readonly occasionTypes = Object.entries(OCCASION_LABELS) as [OccasionType, string][];
  readonly saving = signal(false);
  readonly error = signal('');
  readonly customEnabled = signal(false);
  readonly useDefaultTime = signal(true);
  readonly selectedChoices = signal<ReminderChoice[]>([]);
  readonly maxDate = `${new Date().getFullYear() + 1}-12-31`;
  readonly form = new FormGroup({
    personId: new FormControl(this.route.snapshot.queryParamMap.get('personId') ?? '', {
      nonNullable: true,
      validators: [Validators.required],
    }),
    type: new FormControl<OccasionType>('BIRTHDAY', { nonNullable: true }),
    customTypeName: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(60)] }),
    day: new FormControl(new Date().getDate(), { nonNullable: true }),
    month: new FormControl(new Date().getMonth() + 1, { nonNullable: true }),
    year: new FormControl<number | null>(new Date().getFullYear()),
    yearUnknown: new FormControl(false, { nonNullable: true }),
    enabled: new FormControl(true, { nonNullable: true }),
    customDays: new FormControl(10, { nonNullable: true, validators: [Validators.min(1), Validators.max(365)] }),
    time: new FormControl('08:00', { nonNullable: true }),
  });
  dateValue(): string {
    return `${this.form.controls.year.value ?? 2024}-${String(this.form.controls.month.value).padStart(2, '0')}-${String(this.form.controls.day.value).padStart(2, '0')}`;
  }
  dateLabel(): string {
    return this.dates.formatDate({
      day: this.form.controls.day.value,
      month: this.form.controls.month.value,
      year: this.form.controls.yearUnknown.value ? undefined : (this.form.controls.year.value ?? undefined),
    });
  }
  defaultTimeLabel(): string {
    return this.formatTime(this.store.settings().defaultReminderHour, this.store.settings().defaultReminderMinute);
  }
  constructor() {
    void this.populate();
  }
  private async populate(): Promise<void> {
    await this.store.initialize();
    const occasion = this.occasionId ? this.store.occasion(this.occasionId) : undefined;
    if (occasion) {
      this.form.patchValue({
        personId: occasion.personId,
        type: occasion.type,
        customTypeName: occasion.customTypeName ?? '',
        day: occasion.day,
        month: occasion.month,
        year: occasion.year ?? 2024,
        yearUnknown: occasion.year === undefined,
        enabled: occasion.enabled,
      });
      const reminders = this.store.remindersFor(occasion.id);
      this.selectedChoices.set(reminders.map(item => ({ unit: item.offsetUnit, value: item.offsetValue })));
      const first = reminders[0];
      if (first) {
        this.form.controls.time.setValue(
          `${String(first.hour).padStart(2, '0')}:${String(first.minute).padStart(2, '0')}`,
        );
        this.useDefaultTime.set(
          first.hour === this.store.settings().defaultReminderHour &&
            first.minute === this.store.settings().defaultReminderMinute,
        );
      }
    } else this.selectedChoices.set([...this.store.settings().defaultReminderOffsets]);
  }
  key(choice: ReminderChoice): string {
    return `${choice.unit}:${choice.value}`;
  }
  selected(key: string): boolean {
    return this.selectedChoices().some(choice => this.key(choice) === key);
  }
  toggleReminder(choice: ReminderChoice, checked: boolean): void {
    this.selectedChoices.update(items =>
      checked
        ? [...items.filter(item => this.key(item) !== this.key(choice)), choice]
        : items.filter(item => this.key(item) !== this.key(choice)),
    );
  }
  dateChanged(value: string | string[] | null | undefined): void {
    if (typeof value !== 'string') return;
    const [year, month, day] = value.slice(0, 10).split('-').map(Number);
    this.form.patchValue({
      day,
      month,
      year: this.form.controls.yearUnknown.value ? this.form.controls.year.value : year,
    });
  }
  yearUnknownChanged(unknown: boolean): void {
    this.form.controls.yearUnknown.setValue(unknown);
    if (!unknown && this.form.controls.year.value === null) this.form.controls.year.setValue(new Date().getFullYear());
  }
  async save(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const raw = this.form.getRawValue();
    if (raw.type === 'CUSTOM' && !raw.customTypeName.trim()) {
      this.error.set('Enter a custom occasion name.');
      return;
    }
    const year = raw.yearUnknown ? undefined : (raw.year ?? undefined);
    if (!this.dates.isValidDate(raw.day, raw.month, year)) {
      this.error.set('Choose a valid calendar date.');
      return;
    }
    let choices = [...this.selectedChoices()];
    if (this.customEnabled()) choices.push({ unit: 'DAY', value: raw.customDays });
    choices = [...new Map(choices.map(choice => [this.key(choice), choice])).values()];
    const [hour, minute] = this.useDefaultTime()
      ? [this.store.settings().defaultReminderHour, this.store.settings().defaultReminderMinute]
      : raw.time.split(':').map(Number);
    const existing = this.occasionId ? this.store.occasion(this.occasionId) : undefined;
    this.saving.set(true);
    if (existing) await this.scheduler.cancelOccasion(existing.id);
    const occasion = await this.store.saveOccasion(
      {
        id: this.occasionId ?? undefined,
        personId: raw.personId,
        type: raw.type,
        customTypeName: raw.type === 'CUSTOM' ? raw.customTypeName.trim() : undefined,
        day: raw.day,
        month: raw.month,
        year,
        source: existing?.source ?? 'MANUAL',
        androidEventReference: existing?.androidEventReference,
        userModified: existing?.source === 'ANDROID_CONTACT' ? true : false,
        enabled: raw.enabled,
      },
      choices,
      hour,
      minute,
    );
    const result = await this.scheduler.rescheduleOccasion(occasion.id, choices.length > 0);
    this.saving.set(false);
    const toast = await this.toasts.create({
      message:
        result === 'denied'
          ? 'Saved. Notifications are blocked in Android settings.'
          : existing
            ? 'Occasion updated'
            : 'Occasion added',
      duration: 2200,
    });
    await toast.present();
    await this.router.navigate(['/person', raw.personId]);
  }
  async confirmDelete(): Promise<void> {
    const occasion = this.occasionId ? this.store.occasion(this.occasionId) : undefined;
    if (!occasion) return;
    const label = occasion.customTypeName || OCCASION_LABELS[occasion.type];
    const alert = await this.alerts.create({
      header: `Delete ${label}?`,
      message: 'This removes the occasion and its reminders from this app.',
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Delete',
          role: 'destructive',
          handler: () => {
            void this.remove(occasion.id, occasion.personId);
          },
        },
      ],
    });
    await alert.present();
  }
  private async remove(id: string, personId: string): Promise<void> {
    await this.scheduler.cancelOccasion(id);
    await this.store.deleteOccasion(id);
    await this.router.navigate(['/person', personId]);
  }
  private formatTime(hour: number, minute: number): string {
    return new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(
      new Date(2024, 0, 1, hour, minute),
    );
  }
}
