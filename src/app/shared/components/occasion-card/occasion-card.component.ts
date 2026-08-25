import { Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IonBadge, IonCard, IonCardContent, IonIcon, IonItem, IonLabel, IonNote } from '@ionic/angular';
import { OCCASION_LABELS, Occasion, Person } from '../../../core/models/domain.models';
import { BirthdayStoreService } from '../../../core/services/birthday-store.service';
import { OccasionDateService } from '../../../core/services/occasion-date.service';
import { PersonAvatarComponent } from '../person-avatar/person-avatar.component';

@Component({
  selector: 'app-occasion-card',
  imports: [RouterLink, IonBadge, IonCard, IonCardContent, IonIcon, IonItem, IonLabel, IonNote, PersonAvatarComponent],
  template: `
    <ion-card class="occasion-card" [routerLink]="['/occasion', occasion().id, 'edit']" button="true">
      <ion-card-content
        ><ion-item lines="none">
          <app-person-avatar slot="start" [name]="person().name" [photoPath]="person().photoPath" />
          <ion-label
            ><h2>{{ person().name }}</h2>
            <p>
              <ion-icon
                [name]="occasion().type === 'BIRTHDAY' ? 'gift-outline' : 'heart-outline'"
                aria-hidden="true"></ion-icon>
              {{ label() }} · {{ dates.formatDate(occasion()) }}
            </p>
            @if (milestone()) {
              <ion-note>{{ milestone() }}</ion-note>
            }
          </ion-label>
          <ion-badge slot="end" color="primary">{{ countdown() }}</ion-badge>
        </ion-item></ion-card-content
      >
    </ion-card>
  `,
})
export class OccasionCardComponent {
  readonly occasion = input.required<Occasion>();
  readonly person = input.required<Person>();
  readonly dates = inject(OccasionDateService);
  private readonly store = inject(BirthdayStoreService);
  readonly label = computed(() => this.occasion().customTypeName || OCCASION_LABELS[this.occasion().type]);
  readonly days = computed(() => this.dates.daysUntil(this.occasion(), this.store.settings().feb29Policy));
  readonly countdown = computed(() => this.dates.labelForCountdown(this.days()));
  readonly milestone = computed(() => {
    if (!this.store.settings().showAge) return '';
    const value =
      this.occasion().type === 'BIRTHDAY'
        ? this.dates.ageOnNextBirthday(this.occasion(), this.store.settings().feb29Policy)
        : this.dates.anniversaryNumber(this.occasion(), this.store.settings().feb29Policy);
    if (value === undefined || value < 0) return '';
    return this.occasion().type === 'BIRTHDAY' ? `Turns ${value}` : `${this.dates.ordinal(value)} anniversary`;
  });
}
