import { NgOptimizedImage } from '@angular/common';
import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IonButton, IonButtons, IonContent, IonHeader, IonIcon, IonTitle, IonToolbar } from '@ionic/angular';
import { BirthdayStoreService } from '../../core/services/birthday-store.service';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';
import { OccasionCardComponent } from '../../shared/components/occasion-card/occasion-card.component';

@Component({
  selector: 'app-home',
  imports: [
    NgOptimizedImage,
    RouterLink,
    IonButton,
    IonButtons,
    IonContent,
    IonHeader,
    IonIcon,
    IonTitle,
    IonToolbar,
    EmptyStateComponent,
    OccasionCardComponent,
  ],
  template: `
    <ion-header translucent="true"
      ><ion-toolbar
        ><ion-title
          ><span class="brand-title"
            ><img ngSrc="assets/birthday-buddy.png" width="34" height="34" priority alt="" />Birthday Buddy</span
          ></ion-title
        ><ion-buttons slot="end"
          ><ion-button routerLink="/settings" aria-label="Open settings"
            ><ion-icon name="settings-outline"></ion-icon></ion-button></ion-buttons></ion-toolbar
    ></ion-header>
    <ion-content fullscreen="true"
      ><main class="page-shell">
        <section class="welcome">
          <p class="eyebrow">Your private occasion keeper</p>
          <h1>{{ greeting() }}</h1>
          <p>{{ summary() }}</p>
          <ion-button routerLink="/occasion/new"><ion-icon slot="start" name="add"></ion-icon>Add occasion</ion-button>
        </section>
        @if (store.loading()) {
          <div class="skeleton-stack">
            <div class="skeleton-card"></div>
            <div class="skeleton-card"></div>
          </div>
        } @else if (store.upcoming().length === 0) {
          <app-empty-state
            icon="gift-outline"
            title="No occasions yet"
            message="Add birthdays, anniversaries and important dates so you never miss them."
            actionLabel="Add your first occasion"
            actionLink="/occasion/new" />
        } @else {
          @if (today().length) {
            <section>
              <div class="section-heading">
                <div>
                  <span class="eyebrow">Celebrate</span>
                  <h2>Today</h2>
                </div>
              </div>
              @for (item of today(); track item.occasion.id) {
                @if (person(item.occasion.personId); as owner) {
                  <app-occasion-card [occasion]="item.occasion" [person]="owner" />
                }
              }
            </section>
          }
          @if (soon().length) {
            <section>
              <div class="section-heading">
                <div>
                  <span class="eyebrow">Plan ahead</span>
                  <h2>Coming soon</h2>
                </div>
                <ion-button fill="clear" routerLink="/tabs/upcoming">See all</ion-button>
              </div>
              @for (item of soon(); track item.occasion.id) {
                @if (person(item.occasion.personId); as owner) {
                  <app-occasion-card [occasion]="item.occasion" [person]="owner" />
                }
              }
            </section>
          }
        }</main
    ></ion-content>
  `,
  styleUrl: 'home.page.scss',
})
export class HomePage {
  readonly store = inject(BirthdayStoreService);
  readonly today = computed(() => this.store.upcoming().filter(item => item.daysUntil === 0));
  readonly soon = computed(() =>
    this.store
      .upcoming()
      .filter(item => item.daysUntil > 0)
      .slice(0, 5),
  );
  readonly greeting = computed(() => {
    const hour = new Date().getHours();
    return hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  });
  readonly summary = computed(() =>
    this.today().length
      ? `${this.today().length} special ${this.today().length === 1 ? 'occasion' : 'occasions'} today.`
      : this.soon()[0]
        ? `The next occasion is ${this.soon()[0].daysUntil === 1 ? 'tomorrow' : `in ${this.soon()[0].daysUntil} days`}.`
        : 'Keep every meaningful date close.',
  );
  person(id: string) {
    return this.store.person(id);
  }
}
