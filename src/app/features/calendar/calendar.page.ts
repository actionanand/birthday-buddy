import { Component, computed, inject, signal } from '@angular/core';
import { IonContent, IonDatetime, IonHeader, IonSegment, IonSegmentButton, IonTitle, IonToolbar } from '@ionic/angular';
import { BirthdayStoreService } from '../../core/services/birthday-store.service';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';
import { OccasionCardComponent } from '../../shared/components/occasion-card/occasion-card.component';

@Component({
  selector: 'app-calendar',
  imports: [
    IonContent,
    IonDatetime,
    IonHeader,
    IonSegment,
    IonSegmentButton,
    IonTitle,
    IonToolbar,
    EmptyStateComponent,
    OccasionCardComponent,
  ],
  template: `<ion-header translucent="true"
      ><ion-toolbar><ion-title>Calendar</ion-title></ion-toolbar
      ><ion-toolbar
        ><ion-segment [value]="view()" (ionChange)="setView($event.detail.value)"
          ><ion-segment-button value="DAY">Month</ion-segment-button
          ><ion-segment-button value="YEAR">Year</ion-segment-button></ion-segment
        ></ion-toolbar
      ></ion-header
    ><ion-content fullscreen="true"
      ><main class="page-shell">
        @if (view() === 'DAY') {
          <section class="calendar-panel">
            <ion-datetime
              presentation="date"
              [value]="selected()"
              [highlightedDates]="highlightedDates"
              (ionChange)="select($any($event.detail.value))"
              aria-label="Occasion calendar"></ion-datetime>
          </section>
          <div class="section-heading">
            <div>
              <span class="eyebrow">Selected day</span>
              <h2>{{ selectedLabel() }}</h2>
            </div>
          </div>
          @if (!selectedOccasions().length) {
            <app-empty-state
              title="No occasions this day"
              message="Choose a highlighted date or add an occasion."
              icon="calendar-clear-outline" />
          }
          @for (occasion of selectedOccasions(); track occasion.id) {
            @if (store.person(occasion.personId); as person) {
              <app-occasion-card [occasion]="occasion" [person]="person" />
            }
          }
        } @else {
          <div class="section-heading">
            <div>
              <span class="eyebrow">At a glance</span>
              <h2>{{ year() }}</h2>
            </div>
          </div>
          @if (!yearOccasions().length) {
            <app-empty-state
              title="No occasions this year"
              message="Add an occasion to see it in the year view."
              icon="calendar-clear-outline" />
          }
          @for (occasion of yearOccasions(); track occasion.id) {
            @if (store.person(occasion.personId); as person) {
              <app-occasion-card [occasion]="occasion" [person]="person" />
            }
          }
        }</main
    ></ion-content>`,
})
export class CalendarPage {
  readonly store = inject(BirthdayStoreService);
  readonly view = signal<'DAY' | 'YEAR'>('DAY');
  readonly selected = signal(this.localIso(new Date()));
  readonly year = computed(() => Number(this.selected().slice(0, 4)));
  readonly selectedLabel = computed(() =>
    new Intl.DateTimeFormat(undefined, { dateStyle: 'long' }).format(new Date(`${this.selected()}T12:00:00`)),
  );
  readonly selectedOccasions = computed(() => {
    const [, month, day] = this.selected().split('-').map(Number);
    return this.store.enabledOccasions().filter(occasion => occasion.month === month && occasion.day === day);
  });
  readonly yearOccasions = computed(() =>
    [...this.store.enabledOccasions()].sort((left, right) => left.month - right.month || left.day - right.day),
  );
  readonly highlightedDates = (isoString: string) => {
    const date = new Date(isoString);
    return this.store
      .enabledOccasions()
      .some(occasion => occasion.month === date.getMonth() + 1 && occasion.day === date.getDate())
      ? { textColor: 'var(--ion-color-primary-contrast)', backgroundColor: 'var(--ion-color-primary)' }
      : undefined;
  };
  select(value: string | string[] | null | undefined): void {
    if (typeof value === 'string') this.selected.set(value.slice(0, 10));
  }
  setView(value: string | number | undefined): void {
    if (value === 'DAY' || value === 'YEAR') this.view.set(value);
  }
  private localIso(date: Date): string {
    const offset = date.getTimezoneOffset() * 60_000;
    return new Date(date.getTime() - offset).toISOString().slice(0, 10);
  }
}
