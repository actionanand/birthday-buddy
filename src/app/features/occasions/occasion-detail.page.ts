import { Component, computed, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import {
  IonBadge,
  IonBackButton,
  IonButton,
  IonButtons,
  IonCard,
  IonCardContent,
  IonContent,
  IonHeader,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonNote,
  IonTitle,
  IonToolbar,
} from '@ionic/angular';
import { OCCASION_LABELS, OccasionReminder } from '../../core/models/domain.models';
import { BirthdayStoreService } from '../../core/services/birthday-store.service';
import { OccasionDateService } from '../../core/services/occasion-date.service';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';
import { PersonAvatarComponent } from '../../shared/components/person-avatar/person-avatar.component';

@Component({
  selector: 'app-occasion-detail',
  imports: [
    RouterLink,
    IonBadge,
    IonBackButton,
    IonButton,
    IonButtons,
    IonCard,
    IonCardContent,
    IonContent,
    IonHeader,
    IonIcon,
    IonItem,
    IonLabel,
    IonList,
    IonNote,
    IonTitle,
    IonToolbar,
    EmptyStateComponent,
    PersonAvatarComponent,
  ],
  template: `<ion-header
      ><ion-toolbar
        ><ion-buttons slot="start"><ion-back-button defaultHref="/tabs/upcoming"></ion-back-button></ion-buttons
        ><ion-title>Occasion</ion-title
        ><ion-buttons slot="end">
          @if (occasion(); as occasion) {
            <ion-button [routerLink]="['/occasion', occasion.id, 'edit']" aria-label="Edit occasion"
              ><ion-icon name="create-outline"></ion-icon
            ></ion-button>
          }</ion-buttons></ion-toolbar></ion-header
    ><ion-content
      ><main class="page-shell">
        @if (occasion(); as occasion) {
          @if (person(); as person) {
            <ion-card class="person-summary" [routerLink]="['/person', person.id]" button="true">
              <ion-card-content>
                <app-person-avatar [name]="person.name" [photoPath]="person.photoPath" size="large" />
                <div>
                  <span class="eyebrow">Person</span>
                  <h1>{{ person.name }}</h1>
                  <p>View person details</p>
                </div>
              </ion-card-content>
            </ion-card>
          }
          <ion-list class="form-card">
            <ion-item>
              <ion-icon
                slot="start"
                [name]="occasion.type === 'BIRTHDAY' ? 'gift-outline' : 'heart-outline'"
                color="primary"></ion-icon>
              <ion-label
                ><p>Occasion</p>
                <h2>{{ occasion.customTypeName || labels[occasion.type] }}</h2></ion-label
              >
              <ion-badge slot="end" [color]="occasion.enabled ? 'primary' : 'medium'">{{
                occasion.enabled ? 'Enabled' : 'Disabled'
              }}</ion-badge>
            </ion-item>
            <ion-item>
              <ion-icon slot="start" name="calendar-outline" color="primary"></ion-icon>
              <ion-label
                ><p>Date</p>
                <h2>{{ dates.formatDate(occasion) }}</h2></ion-label
              >
              <ion-note slot="end">{{ countdown() }}</ion-note>
            </ion-item>
            <ion-item>
              <ion-icon slot="start" name="notifications-outline" color="primary"></ion-icon>
              <ion-label>
                <p>{{ occasion.reminderMode === 'DEFAULT' ? 'Universal reminders' : 'Custom reminders' }}</p>
                <h2>{{ reminderSummary() }}</h2>
              </ion-label>
            </ion-item>
          </ion-list>
          <ion-button expand="block" [routerLink]="['/occasion', occasion.id, 'edit']">
            <ion-icon slot="start" name="create-outline"></ion-icon>Edit occasion
          </ion-button>
        } @else {
          <app-empty-state
            title="Occasion not found"
            message="This occasion may have been deleted or moved to Trash."
            icon="calendar-clear-outline" />
        }</main
    ></ion-content>`,
  styles: `
    .person-summary {
      margin: 0 0 1.4rem;
    }
    .person-summary ion-card-content {
      display: flex;
      align-items: center;
      gap: 1rem;
    }
    .person-summary h1 {
      margin: 0.15rem 0;
      font: 750 1.6rem/1.1 var(--app-font-display);
    }
    .person-summary p {
      margin: 0;
      color: var(--app-text-secondary);
    }
    ion-label h2 {
      white-space: normal;
    }
  `,
})
export class OccasionDetailPage {
  readonly store = inject(BirthdayStoreService);
  readonly dates = inject(OccasionDateService);
  readonly labels = OCCASION_LABELS;
  private readonly route = inject(ActivatedRoute);
  readonly id = this.route.snapshot.paramMap.get('id') ?? '';
  readonly occasion = computed(() => this.store.occasion(this.id));
  readonly person = computed(() => {
    const occasion = this.occasion();
    return occasion ? this.store.person(occasion.personId) : undefined;
  });
  readonly countdown = computed(() => {
    const occasion = this.occasion();
    if (!occasion) return '';
    return this.dates.labelForCountdown(this.dates.daysUntil(occasion, this.store.settings().feb29Policy));
  });
  readonly reminderSummary = computed(() => {
    const occasion = this.occasion();
    if (!occasion) return 'No reminders';
    const reminders = this.store.remindersFor(occasion.id).filter(reminder => reminder.enabled);
    const labels = reminders.map(reminder => this.reminderLabel(reminder));
    if (occasion.type === 'BIRTHDAY' && occasion.birthdayEveReminderTime)
      labels.push(
        occasion.birthdayEveReminderTime === '23:50'
          ? 'Birthday eve at 11:50 PM'
          : `Birthday eve at ${this.formatEveTime(occasion.birthdayEveReminderTime)}`,
      );
    return labels.length ? labels.join(', ') : 'No reminders';
  });

  private reminderLabel(reminder: OccasionReminder): string {
    if (reminder.offsetUnit === 'ON_DAY') return 'On the day';
    const unit =
      reminder.offsetValue === 1
        ? reminder.offsetUnit.toLocaleLowerCase()
        : `${reminder.offsetUnit.toLocaleLowerCase()}s`;
    return `${reminder.offsetValue} ${unit} before`;
  }

  private formatEveTime(value: string): string {
    const hour = Number(value.slice(0, 2));
    return `${hour > 12 ? hour - 12 : hour}:00 PM`;
  }
}
