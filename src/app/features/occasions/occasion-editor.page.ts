import { Component, computed, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Capacitor } from '@capacitor/core';
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
import {
  BirthdayEveReminderTime,
  OCCASION_LABELS,
  OccasionType,
  REMINDER_PRESETS,
  ReminderChoice,
} from '../../core/models/domain.models';
import { BirthdayStoreService } from '../../core/services/birthday-store.service';
import { OccasionDateService } from '../../core/services/occasion-date.service';
import { PhotoService } from '../../core/services/photo.service';
import { ReminderSchedulerService } from '../../core/services/reminder-scheduler.service';
import { PersonAvatarComponent } from '../../shared/components/person-avatar/person-avatar.component';

@Component({
  selector: 'app-occasion-editor',
  host: {
    '(window:beforeunload)': 'beforeUnload($event)',
  },
  imports: [
    ReactiveFormsModule,
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
    PersonAvatarComponent,
  ],
  template: `<ion-header
      ><ion-toolbar
        ><ion-buttons slot="start"><ion-back-button defaultHref="/tabs/home"></ion-back-button></ion-buttons
        ><ion-title>{{
          occasionId ? 'Edit Occasion' : creatingNewPerson() ? 'Add Person & Occasion' : 'Add Occasion'
        }}</ion-title
        ><ion-buttons slot="end"
          ><ion-button
            (click)="save()"
            [disabled]="form.invalid || newPersonInvalid() || hasDuplicateOccasion() || saving()"
            >Save</ion-button
          ></ion-buttons
        ></ion-toolbar
      ></ion-header
    ><ion-content
      ><main class="form-shell">
        @if (creatingNewPerson()) {
          <section class="photo-editor" aria-labelledby="new-person-photo-title">
            <app-person-avatar
              [name]="form.controls.personName.value || 'New person'"
              [photoPath]="photo()"
              size="large" />
            <div>
              <h2 id="new-person-photo-title" class="visually-hidden">New person photo</h2>
              <ion-button size="small" fill="outline" [disabled]="photoBusy()" (click)="choosePhoto(fileInput)"
                ><ion-icon slot="start" name="image-outline"></ion-icon>Choose photo</ion-button
              >
              @if (native) {
                <ion-button size="small" fill="outline" [disabled]="photoBusy()" (click)="takePhoto()"
                  ><ion-icon slot="start" name="camera-outline"></ion-icon>Take photo</ion-button
                >
              }
              @if (photo()) {
                <ion-button size="small" fill="clear" color="danger" (click)="removePhoto()">Remove</ion-button>
              }
            </div>
            <p class="form-help">Images up to 5 MB are cropped square and compressed before being stored.</p>
            <input #fileInput class="visually-hidden" type="file" accept="image/*" (change)="browserPhoto($event)" />
          </section>
        } @else if (targetPerson(); as person) {
          <section class="profile-hero">
            <app-person-avatar [name]="person.name" [photoPath]="person.photoPath" size="large" />
            <div>
              <p class="eyebrow">Adding occasions for</p>
              <h1>{{ person.name }}</h1>
            </div>
          </section>
        }
        <ion-list class="form-card">
          @if (creatingNewPerson()) {
            <ion-item
              ><ion-input
                label="Name"
                labelPlacement="stacked"
                autocomplete="name"
                maxlength="100"
                [formControl]="form.controls.personName"
                required
                errorText="Enter a name"></ion-input>
              <ion-button
                slot="end"
                fill="clear"
                class="favorite-toggle"
                [attr.aria-pressed]="form.controls.personFavorite.value"
                [attr.aria-label]="form.controls.personFavorite.value ? 'Remove from favorites' : 'Add to favorites'"
                (click)="togglePersonFavorite()">
                <ion-icon
                  slot="icon-only"
                  [name]="form.controls.personFavorite.value ? 'heart' : 'heart-outline'"
                  [color]="form.controls.personFavorite.value ? 'primary' : 'medium'"></ion-icon> </ion-button
            ></ion-item>
          }
          <ion-item
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
              (ionChange)="yearUnknownChanged($any($event).detail.checked)"
              >Year unknown</ion-toggle
            ></ion-item
          ><ion-item
            ><ion-toggle justify="space-between" [formControl]="form.controls.enabled"
              >Occasion enabled</ion-toggle
            ></ion-item
          ></ion-list
        >
        @if (form.controls.type.value === 'BIRTHDAY') {
          <section class="form-section" aria-labelledby="birthday-eve-heading">
            <div class="section-heading">
              <div>
                <span class="eyebrow">Birthday only</span>
                <h2 id="birthday-eve-heading">Birthday eve reminder</h2>
              </div>
            </div>
            <ion-list class="form-card">
              <ion-item>
                <ion-select
                  label="Remind the night before"
                  labelPlacement="stacked"
                  interface="action-sheet"
                  [formControl]="form.controls.birthdayEveReminderTime">
                  <ion-select-option value="">Off</ion-select-option>
                  <ion-select-option value="21:00">9:00 PM</ion-select-option>
                  <ion-select-option value="22:00">10:00 PM</ion-select-option>
                  <ion-select-option value="23:00">11:00 PM</ion-select-option>
                  <ion-select-option value="23:50">10 minutes before birthday</ion-select-option>
                </ion-select>
              </ion-item>
              <ion-item lines="none">
                <ion-note>
                  This reminder is scheduled on the previous calendar day. The 10-minute option runs at 11:50 PM.
                </ion-note>
              </ion-item>
            </ion-list>
          </section>
        }
        @if (otherOccasions().length) {
          <section class="form-section" aria-labelledby="other-occasions-heading">
            <div class="section-heading">
              <div>
                <span class="eyebrow">Already saved</span>
                <h2 id="other-occasions-heading">Other occasions</h2>
              </div>
            </div>
            <ion-list class="form-card">
              @for (occasion of otherOccasions(); track occasion.id) {
                <ion-item>
                  <ion-icon
                    slot="start"
                    [name]="occasion.type === 'BIRTHDAY' ? 'gift-outline' : 'heart-outline'"
                    [color]="occasion.enabled ? 'primary' : 'medium'"></ion-icon>
                  <ion-label>
                    <h2>{{ occasion.customTypeName || occasionLabels[occasion.type] }}</h2>
                    <p>{{ dates.formatDate(occasion) }}</p>
                  </ion-label>
                  @if (!occasion.enabled) {
                    <ion-note slot="end">Disabled</ion-note>
                  }
                </ion-item>
              }
            </ion-list>
          </section>
        }
        <ion-modal [keepContentsMounted]="true"
          ><ng-template
            ><ion-datetime
              id="occasion-date"
              presentation="date"
              [value]="dateValue()"
              [showDefaultButtons]="true"
              [max]="maxDate"
              (ionChange)="dateChanged($any($event).detail.value)"
              ><span slot="title">Occasion date</span></ion-datetime
            ></ng-template
          ></ion-modal
        >
        <section class="form-section">
          <div class="section-heading">
            <div>
              <span class="eyebrow">Universal or contact-specific</span>
              <h2>Remind me</h2>
            </div>
          </div>
          <ion-list class="form-card">
            <ion-item
              ><ion-toggle
                justify="space-between"
                [checked]="useDefaultReminders()"
                (ionChange)="useDefaultReminders.set($any($event).detail.checked)"
                >Use universal default reminders</ion-toggle
              ></ion-item
            >
            @if (useDefaultReminders()) {
              <ion-item
                ><ion-label
                  ><h2>Using Settings defaults</h2>
                  <p>{{ defaultReminderSummary() }}</p>
                  <p>{{ defaultTimeLabel() }}</p></ion-label
                ></ion-item
              >
            } @else {
              @for (preset of presets; track key(preset.choice)) {
                <ion-item
                  ><ion-checkbox
                    justify="space-between"
                    [checked]="selected(key(preset.choice))"
                    (ionChange)="toggleReminder(preset.choice, $any($event).detail.checked)"
                    >{{ preset.label }}</ion-checkbox
                  ></ion-item
                >
              }
              <ion-item
                ><ion-checkbox
                  justify="space-between"
                  [checked]="customEnabled()"
                  (ionChange)="customEnabled.set($any($event).detail.checked)"
                  >Custom days before</ion-checkbox
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
            }
          </ion-list>
        </section>
        @if (!useDefaultReminders()) {
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
                  (ionChange)="useDefaultTime.set($any($event).detail.checked)"
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
        }
        @if (error()) {
          <ion-note class="form-error" color="danger" role="alert">{{ error() }}</ion-note>
        }
        @if (hasDuplicateOccasion()) {
          <ion-note class="form-error" color="warning" aria-live="polite">
            This person already has the same occasion on this date. Change the occasion or date to continue.
          </ion-note>
        }
        <ion-button
          expand="block"
          (click)="save()"
          [disabled]="form.invalid || newPersonInvalid() || hasDuplicateOccasion() || saving()"
          >{{ occasionId ? 'Save changes' : 'Add occasion' }}</ion-button
        >
        @if (!occasionId) {
          <ion-button
            expand="block"
            fill="outline"
            (click)="save(true)"
            [disabled]="form.invalid || newPersonInvalid() || hasDuplicateOccasion() || saving()"
            >Save &amp; add another occasion</ion-button
          >
        }
        @if (occasionId) {
          <ion-button expand="block" fill="clear" color="danger" (click)="confirmDelete()"
            ><ion-icon slot="start" name="trash-outline"></ion-icon>Delete occasion</ion-button
          >
        }
      </main></ion-content
    >`,
})
export class OccasionEditorPage {
  readonly store = inject(BirthdayStoreService);
  readonly dates = inject(OccasionDateService);
  private readonly photos = inject(PhotoService);
  private readonly scheduler = inject(ReminderSchedulerService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly alerts = inject(AlertController);
  private readonly toasts = inject(ToastController);
  readonly occasionId = this.route.snapshot.paramMap.get('id');
  readonly native = Capacitor.isNativePlatform();
  readonly presets = REMINDER_PRESETS;
  readonly occasionLabels = OCCASION_LABELS;
  readonly occasionTypes = Object.entries(OCCASION_LABELS) as [OccasionType, string][];
  readonly saving = signal(false);
  readonly photoBusy = signal(false);
  readonly photo = signal<string | undefined>(undefined);
  readonly error = signal('');
  readonly customEnabled = signal(false);
  readonly useDefaultReminders = signal(true);
  readonly useDefaultTime = signal(true);
  readonly selectedChoices = signal<ReminderChoice[]>([]);
  readonly targetPersonId = signal<string | undefined>(this.route.snapshot.queryParamMap.get('personId') ?? undefined);
  readonly maxDate = `${new Date().getFullYear() + 1}-12-31`;
  readonly otherOccasions = computed(() => {
    const personId = this.targetPersonId();
    return personId
      ? this.store
          .occasionsFor(personId)
          .filter(occasion => occasion.id !== this.occasionId)
          .sort((a, b) => a.month - b.month || a.day - b.day)
      : [];
  });
  private populateRun = 0;
  private baselineDraft = '';
  private navigationCommitted = false;
  readonly form = new FormGroup({
    personName: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(100)] }),
    personFavorite: new FormControl(false, { nonNullable: true }),
    birthdayEveReminderTime: new FormControl<BirthdayEveReminderTime | ''>('', { nonNullable: true }),
    type: new FormControl<OccasionType>('BIRTHDAY', { nonNullable: true }),
    customTypeName: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(60)] }),
    day: new FormControl(new Date().getDate(), { nonNullable: true }),
    month: new FormControl(new Date().getMonth() + 1, { nonNullable: true }),
    year: new FormControl<number | null>(new Date().getFullYear()),
    yearUnknown: new FormControl(false, { nonNullable: true }),
    enabled: new FormControl(true, { nonNullable: true }),
    customDays: new FormControl(10, { nonNullable: true, validators: [Validators.min(1), Validators.max(365)] }),
    time: new FormControl('06:00', { nonNullable: true }),
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
  defaultReminderSummary(): string {
    const selected = new Set(this.store.settings().defaultReminderOffsets.map(choice => this.key(choice)));
    const labels = this.presets.filter(preset => selected.has(this.key(preset.choice))).map(preset => preset.label);
    return labels.length ? labels.join(', ') : 'No notifications';
  }
  ionViewWillEnter(): void {
    void this.populate();
  }
  private async populate(): Promise<void> {
    const run = ++this.populateRun;
    const routePersonId = this.occasionId
      ? undefined
      : (this.route.snapshot.queryParamMap.get('personId') ?? undefined);
    this.resetEditorForEntry(routePersonId);
    await this.store.initialize();
    if (run !== this.populateRun) return;
    const occasion = this.occasionId ? this.store.occasion(this.occasionId) : undefined;
    if (!occasion && this.targetPersonId() && !this.targetPerson()) {
      this.targetPersonId.set(undefined);
      this.form.controls.personName.enable({ emitEvent: false });
      this.error.set('That person is no longer available. Create a new person instead.');
    }
    if (occasion) {
      this.form.patchValue({
        type: occasion.type,
        customTypeName: occasion.customTypeName ?? '',
        day: occasion.day,
        month: occasion.month,
        year: occasion.year ?? 2024,
        yearUnknown: occasion.year === undefined,
        enabled: occasion.enabled,
        birthdayEveReminderTime: occasion.birthdayEveReminderTime ?? '',
      });
      this.targetPersonId.set(occasion.personId);
      const reminders = this.store.remindersFor(occasion.id);
      this.useDefaultReminders.set(occasion.reminderMode === 'DEFAULT');
      const presetKeys = new Set(this.presets.map(preset => this.key(preset.choice)));
      this.selectedChoices.set(
        reminders
          .map(item => ({ unit: item.offsetUnit, value: item.offsetValue }))
          .filter(choice => presetKeys.has(this.key(choice))),
      );
      const custom = reminders.find(
        reminder => !presetKeys.has(this.key({ unit: reminder.offsetUnit, value: reminder.offsetValue })),
      );
      if (custom?.offsetUnit === 'DAY') {
        this.customEnabled.set(true);
        this.form.controls.customDays.setValue(custom.offsetValue);
      }
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
    } else {
      this.useDefaultReminders.set(true);
      this.selectedChoices.set([...this.store.settings().defaultReminderOffsets]);
    }
    this.baselineDraft = this.draftSnapshot();
  }
  private resetEditorForEntry(personId: string | undefined): void {
    const today = new Date();
    this.navigationCommitted = false;
    this.baselineDraft = '';
    this.targetPersonId.set(personId);
    this.form.reset({
      personName: '',
      personFavorite: false,
      birthdayEveReminderTime: '',
      type: 'BIRTHDAY',
      customTypeName: '',
      day: today.getDate(),
      month: today.getMonth() + 1,
      year: today.getFullYear(),
      yearUnknown: false,
      enabled: true,
      customDays: 10,
      time: '06:00',
    });
    if (personId || this.occasionId) this.form.controls.personName.disable({ emitEvent: false });
    else this.form.controls.personName.enable({ emitEvent: false });
    this.photo.set(undefined);
    this.photoBusy.set(false);
    this.error.set('');
    this.customEnabled.set(false);
    this.useDefaultReminders.set(true);
    this.useDefaultTime.set(true);
    this.selectedChoices.set([]);
  }
  hasUnsavedChanges(): boolean {
    return !this.navigationCommitted && Boolean(this.baselineDraft) && this.draftSnapshot() !== this.baselineDraft;
  }
  beforeUnload(event: BeforeUnloadEvent): void {
    if (!this.hasUnsavedChanges()) return;
    event.preventDefault();
    event.returnValue = '';
  }
  creatingNewPerson(): boolean {
    return !this.occasionId && !this.targetPersonId();
  }
  targetPerson() {
    const id = this.targetPersonId();
    return id ? this.store.person(id) : undefined;
  }
  newPersonInvalid(): boolean {
    return this.creatingNewPerson() && !this.form.controls.personName.value.trim();
  }
  hasDuplicateOccasion(): boolean {
    const personId = this.targetPersonId();
    if (!personId) return false;
    const raw = this.form.getRawValue();
    return Boolean(
      this.store.findDuplicateOccasion(
        {
          personId,
          type: raw.type,
          customTypeName: raw.type === 'CUSTOM' ? raw.customTypeName : undefined,
          day: raw.day,
          month: raw.month,
          year: raw.yearUnknown ? undefined : (raw.year ?? undefined),
        },
        this.occasionId ?? undefined,
      ),
    );
  }
  togglePersonFavorite(): void {
    const control = this.form.controls.personFavorite;
    control.setValue(!control.value);
    control.markAsDirty();
  }
  async choosePhoto(fileInput: HTMLInputElement): Promise<void> {
    if (!this.native) {
      fileInput.value = '';
      fileInput.click();
      return;
    }
    await this.updatePhoto(() => this.photos.choose());
  }
  async takePhoto(): Promise<void> {
    await this.updatePhoto(() => this.photos.take());
  }
  removePhoto(): void {
    this.photo.set(undefined);
  }
  async browserPhoto(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    await this.updatePhoto(() => this.photos.readBrowserFile(file));
    input.value = '';
  }
  private async updatePhoto(load: () => Promise<string | undefined>): Promise<void> {
    if (this.photoBusy()) return;
    this.photoBusy.set(true);
    this.error.set('');
    try {
      const photo = await load();
      if (photo) this.photo.set(photo);
    } catch (error: unknown) {
      this.error.set(error instanceof Error ? error.message : 'The photo could not be processed.');
    } finally {
      this.photoBusy.set(false);
    }
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
  async save(addAnother = false): Promise<void> {
    if (this.saving()) return;
    if (this.form.invalid || this.newPersonInvalid()) {
      this.form.markAllAsTouched();
      if (this.newPersonInvalid()) this.error.set('Enter a name for the new person.');
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
    let choices = this.useDefaultReminders()
      ? [...this.store.settings().defaultReminderOffsets]
      : [...this.selectedChoices()];
    if (!this.useDefaultReminders() && this.customEnabled()) choices.push({ unit: 'DAY', value: raw.customDays });
    choices = [...new Map(choices.map(choice => [this.key(choice), choice])).values()];
    const [hour, minute] = this.useDefaultTime()
      ? [this.store.settings().defaultReminderHour, this.store.settings().defaultReminderMinute]
      : raw.time.split(':').map(Number);
    const existing = this.occasionId ? this.store.occasion(this.occasionId) : undefined;
    const creatingPerson = this.creatingNewPerson();
    this.saving.set(true);
    this.error.set('');
    try {
      let personId = this.targetPersonId();
      if (creatingPerson) {
        const person = await this.store.savePerson({
          name: raw.personName,
          favorite: raw.personFavorite,
          source: 'MANUAL',
          photoPath: this.photo(),
          photoSource: this.photo() ? 'MANUAL' : 'INITIALS',
          photoUserModified: Boolean(this.photo()),
        });
        personId = person.id;
      }
      if (!personId) throw new Error('The person could not be created.');
      const duplicate = this.store.findDuplicateOccasion(
        {
          personId,
          type: raw.type,
          customTypeName: raw.type === 'CUSTOM' ? raw.customTypeName.trim() : undefined,
          day: raw.day,
          month: raw.month,
          year,
        },
        existing?.id,
      );
      if (duplicate) throw new Error('This person already has the same occasion on this date.');
      if (existing) await this.scheduler.cancelOccasion(existing.id);
      const occasion = await this.store.saveOccasion(
        {
          id: this.occasionId ?? undefined,
          personId,
          type: raw.type,
          customTypeName: raw.type === 'CUSTOM' ? raw.customTypeName.trim() : undefined,
          day: raw.day,
          month: raw.month,
          year,
          source: existing?.source ?? 'MANUAL',
          androidEventReference: existing?.androidEventReference,
          userModified: existing?.source === 'ANDROID_CONTACT' ? true : false,
          reminderMode: this.useDefaultReminders() ? 'DEFAULT' : 'CUSTOM',
          birthdayEveReminderTime:
            raw.type === 'BIRTHDAY' && raw.birthdayEveReminderTime ? raw.birthdayEveReminderTime : undefined,
          enabled: raw.enabled,
        },
        choices,
        hour,
        minute,
      );
      const result = await this.scheduler.rescheduleOccasion(
        occasion.id,
        choices.length > 0 || Boolean(occasion.birthdayEveReminderTime),
      );
      const toast = await this.toasts.create({
        message:
          result === 'denied'
            ? 'Saved. Notifications are blocked in Android settings.'
            : existing
              ? 'Occasion updated'
              : creatingPerson
                ? 'Person and occasion added'
                : 'Occasion added',
        duration: 2200,
      });
      await toast.present();
      if (addAnother && !this.occasionId) {
        this.targetPersonId.set(personId);
        this.resetForAnotherOccasion();
        return;
      }
      this.navigationCommitted = true;
      await this.router.navigate(['/person', personId]);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'The occasion could not be saved.';
      this.error.set(message);
      const toast = await this.toasts.create({ message, duration: 2300 });
      await toast.present();
    } finally {
      this.saving.set(false);
    }
  }
  private resetForAnotherOccasion(): void {
    const today = new Date();
    this.form.controls.personName.disable({ emitEvent: false });
    this.form.patchValue({
      type: 'BIRTHDAY',
      customTypeName: '',
      day: today.getDate(),
      month: today.getMonth() + 1,
      year: today.getFullYear(),
      yearUnknown: false,
      enabled: true,
      customDays: 10,
      time: '06:00',
      birthdayEveReminderTime: '',
    });
    this.useDefaultReminders.set(true);
    this.useDefaultTime.set(true);
    this.customEnabled.set(false);
    this.selectedChoices.set([...this.store.settings().defaultReminderOffsets]);
    this.error.set('');
    this.baselineDraft = this.draftSnapshot();
  }
  async confirmDelete(): Promise<void> {
    const occasion = this.occasionId ? this.store.occasion(this.occasionId) : undefined;
    if (!occasion) return;
    const label = occasion.customTypeName || OCCASION_LABELS[occasion.type];
    const alert = await this.alerts.create({
      header: `Delete ${label}?`,
      message: 'This occasion will move to Trash for 30 days. Its reminders will stop until it is restored.',
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Move to Trash',
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
    this.navigationCommitted = true;
    await this.router.navigate(['/person', personId]);
  }
  private draftSnapshot(): string {
    return JSON.stringify({
      form: this.form.getRawValue(),
      photo: this.photo() ?? null,
      targetPersonId: this.targetPersonId() ?? null,
      useDefaultReminders: this.useDefaultReminders(),
      useDefaultTime: this.useDefaultTime(),
      customEnabled: this.customEnabled(),
      selectedChoices: this.selectedChoices()
        .map(choice => this.key(choice))
        .sort(),
    });
  }
  private formatTime(hour: number, minute: number): string {
    return new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(
      new Date(2024, 0, 1, hour, minute),
    );
  }
}
