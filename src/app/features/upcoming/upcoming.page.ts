import { Component, computed, inject, signal } from '@angular/core';
import {
  IonContent,
  IonHeader,
  IonSearchbar,
  IonSegment,
  IonSegmentButton,
  IonTitle,
  IonToolbar,
} from '@ionic/angular';
import { BirthdayStoreService } from '../../core/services/birthday-store.service';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';
import { OccasionCardComponent } from '../../shared/components/occasion-card/occasion-card.component';

@Component({
  selector: 'app-upcoming',
  imports: [
    IonContent,
    IonHeader,
    IonSearchbar,
    IonSegment,
    IonSegmentButton,
    IonTitle,
    IonToolbar,
    EmptyStateComponent,
    OccasionCardComponent,
  ],
  template: `<ion-header translucent="true"
      ><ion-toolbar><ion-title>Upcoming</ion-title></ion-toolbar
      ><ion-toolbar
        ><ion-segment [value]="range()" (ionChange)="setRange($any($event).detail.value)"
          ><ion-segment-button value="30">30 days</ion-segment-button
          ><ion-segment-button value="90">3 months</ion-segment-button
          ><ion-segment-button value="365">Year</ion-segment-button></ion-segment
        ></ion-toolbar
      ><ion-toolbar
        ><ion-searchbar
          placeholder="Search people or occasions"
          [debounce]="250"
          (ionInput)="query.set($any($event).detail.value || '')"></ion-searchbar></ion-toolbar
    ></ion-header>
    <ion-content fullscreen="true"
      ><main class="page-shell">
        @if (!filtered().length) {
          <app-empty-state
            title="Nothing coming up soon"
            message="Try a longer range, or add another important date."
            icon="calendar-clear-outline" />
        } @else {
          <p class="result-count">
            {{ filtered().length }} upcoming {{ filtered().length === 1 ? 'occasion' : 'occasions' }}
          </p>
          @for (item of filtered(); track item.occasion.id) {
            @if (store.person(item.occasion.personId); as person) {
              <app-occasion-card [occasion]="item.occasion" [person]="person" />
            }
          }
        }</main
    ></ion-content>`,
})
export class UpcomingPage {
  readonly store = inject(BirthdayStoreService);
  readonly range = signal('90');
  readonly query = signal('');
  readonly filtered = computed(() => {
    const query = this.query().trim().toLocaleLowerCase();
    const range = Number(this.range());
    return this.store
      .upcoming()
      .filter(
        item =>
          item.daysUntil <= range &&
          (!query ||
            this.store.person(item.occasion.personId)?.name.toLocaleLowerCase().includes(query) ||
            item.occasion.customTypeName?.toLocaleLowerCase().includes(query)),
      );
  });

  setRange(value: string | number | undefined): void {
    const range = String(value);
    if (range === '30' || range === '90' || range === '365') this.range.set(range);
  }
}
