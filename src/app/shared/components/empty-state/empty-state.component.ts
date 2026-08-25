import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IonButton, IonIcon } from '@ionic/angular';

@Component({
  selector: 'app-empty-state',
  imports: [RouterLink, IonButton, IonIcon],
  template: `
    <section class="empty-state" aria-live="polite">
      <span class="empty-icon"><ion-icon [name]="icon()" aria-hidden="true"></ion-icon></span>
      <h2>{{ title() }}</h2>
      <p>{{ message() }}</p>
      @if (actionLabel()) {
        <ion-button fill="clear" [routerLink]="actionLink()">{{ actionLabel() }}</ion-button>
      }
    </section>
  `,
  styles: [
    `
      .empty-state {
        text-align: center;
        max-width: 28rem;
        margin: 4rem auto;
        padding: 1.5rem;
        color: var(--app-text-secondary);
      }
      .empty-icon {
        display: grid;
        place-items: center;
        width: 72px;
        height: 72px;
        margin: auto;
        border-radius: 24px;
        background: var(--app-surface-secondary);
        color: var(--ion-color-primary);
      }
      ion-icon {
        font-size: 2rem;
      }
      h2 {
        color: var(--app-text-primary);
        font: 650 1.25rem/1.3 var(--app-font-display);
        margin: 1rem 0 0.4rem;
      }
      p {
        line-height: 1.55;
        margin: 0;
      }
    `,
  ],
})
export class EmptyStateComponent {
  readonly icon = input('calendar-clear-outline');
  readonly title = input.required<string>();
  readonly message = input.required<string>();
  readonly actionLabel = input<string>();
  readonly actionLink = input('/');
}
