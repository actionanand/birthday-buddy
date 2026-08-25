import { Component, computed, input } from '@angular/core';
import { IonAvatar } from '@ionic/angular';

@Component({
  selector: 'app-person-avatar',
  imports: [IonAvatar],
  template: `
    <ion-avatar [class.avatar-large]="size() === 'large'" [attr.aria-label]="name() + ' profile picture'">
      @if (photoPath()) {
        <img [src]="photoPath()" [alt]="name() + ' profile picture'" loading="lazy" />
      } @else {
        <span aria-hidden="true">{{ initials() }}</span>
      }
    </ion-avatar>
  `,
  styles: [
    `
      ion-avatar {
        width: 48px;
        height: 48px;
        background: var(--app-avatar);
        color: var(--app-avatar-text);
        display: grid;
        place-items: center;
        font-weight: 750;
        letter-spacing: 0.03em;
      }
      ion-avatar.avatar-large {
        width: 92px;
        height: 92px;
        font-size: 1.5rem;
      }
      img {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }
    `,
  ],
})
export class PersonAvatarComponent {
  readonly name = input.required<string>();
  readonly photoPath = input<string>();
  readonly size = input<'regular' | 'large'>('regular');
  readonly initials = computed(
    () =>
      this.name()
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map(part => part[0]?.toUpperCase() ?? '')
        .join('') || '?',
  );
}
