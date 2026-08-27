import { Component, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { IonButton, IonCard, IonCardContent, IonIcon, IonInput, IonNote } from '@ionic/angular';
import { PinService } from '../../../core/services/pin.service';

@Component({
  selector: 'app-lock-screen',
  imports: [ReactiveFormsModule, IonButton, IonCard, IonCardContent, IonIcon, IonInput, IonNote],
  template: `<div class="lock-backdrop" role="dialog" aria-modal="true" aria-labelledby="lock-title">
    <ion-card
      ><ion-card-content>
        <span class="lock-icon"><ion-icon name="lock-closed-outline" aria-hidden="true"></ion-icon></span>
        <h1 id="lock-title">Birthday Buddy is locked</h1>
        <p>Your occasions stay private on this device.</p>
        <ion-input
          label="PIN"
          labelPlacement="stacked"
          inputmode="numeric"
          type="password"
          maxlength="8"
          [formControl]="pin"
          (keyup.enter)="unlock()"></ion-input>
        @if (error()) {
          <ion-note color="danger" role="alert">{{ error() }}</ion-note>
        }
        <ion-button expand="block" (click)="unlock()" [disabled]="pin.invalid || busy()">Unlock</ion-button>
        @if (security.biometricEnabled()) {
          <ion-button expand="block" fill="clear" (click)="biometric()" [disabled]="busy()"
            ><ion-icon slot="start" name="finger-print-outline"></ion-icon>Use biometrics</ion-button
          >
        }
      </ion-card-content></ion-card
    >
  </div>`,
  styles: [
    `
      .lock-backdrop {
        position: fixed;
        inset: 0;
        z-index: 99999;
        display: grid;
        place-items: center;
        padding: 1.25rem;
        background: var(--app-background);
      }
      ion-card {
        width: min(100%, 28rem);
        text-align: center;
      }
      .lock-icon {
        display: grid;
        place-items: center;
        width: 70px;
        height: 70px;
        border-radius: 24px;
        margin: 0 auto;
        background: var(--app-surface-secondary);
        color: var(--ion-color-primary);
      }
      .lock-icon ion-icon {
        font-size: 2rem;
      }
      h1 {
        font: 700 1.5rem/1.25 var(--app-font-display);
      }
      p {
        color: var(--app-text-secondary);
      }
      ion-input {
        margin: 1.2rem 0 0.5rem;
      }
      ion-button {
        margin-top: 1rem;
      }
    `,
  ],
})
export class LockScreenComponent {
  readonly security = inject(PinService);
  readonly pin = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required, Validators.pattern(/^\d{4,8}$/)],
  });
  readonly error = signal('');
  readonly busy = signal(false);
  async unlock(): Promise<void> {
    if (this.busy()) return;
    this.busy.set(true);
    try {
      if (await this.security.verify(this.pin.value)) {
        this.pin.reset();
        this.error.set('');
      } else this.error.set('That PIN is not correct.');
    } finally {
      this.busy.set(false);
    }
  }
  async biometric(): Promise<void> {
    if (this.busy()) return;
    this.busy.set(true);
    this.error.set('');
    try {
      if (!(await this.security.unlockWithBiometric())) this.error.set('Biometric unlock failed. Enter your PIN.');
    } finally {
      this.busy.set(false);
    }
  }
}
