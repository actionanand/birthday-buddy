import { Component, computed, inject } from '@angular/core';
import {
  AlertController,
  IonBackButton,
  IonBadge,
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonTitle,
  IonToolbar,
  ToastController,
} from '@ionic/angular';
import { OCCASION_LABELS, Occasion } from '../../core/models/domain.models';
import { BirthdayStoreService } from '../../core/services/birthday-store.service';
import { OccasionDateService } from '../../core/services/occasion-date.service';
import { ReminderSchedulerService } from '../../core/services/reminder-scheduler.service';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';
import { PersonAvatarComponent } from '../../shared/components/person-avatar/person-avatar.component';

@Component({
  selector: 'app-trash',
  imports: [
    IonBackButton,
    IonBadge,
    IonButton,
    IonButtons,
    IonContent,
    IonHeader,
    IonIcon,
    IonItem,
    IonLabel,
    IonList,
    IonTitle,
    IonToolbar,
    EmptyStateComponent,
    PersonAvatarComponent,
  ],
  template: `<ion-header>
      <ion-toolbar>
        <ion-buttons slot="start"><ion-back-button defaultHref="/settings"></ion-back-button></ion-buttons>
        <ion-title>Trash</ion-title>
        @if (store.trashCount()) {
          <ion-buttons slot="end"><ion-button color="danger" (click)="confirmEmpty()">Empty</ion-button></ion-buttons>
        }
      </ion-toolbar>
    </ion-header>
    <ion-content>
      <main class="page-shell">
        <p class="form-help">
          Items are permanently deleted 30 days after they enter Trash. Restore them at any time before then.
        </p>
        @if (!store.trashCount()) {
          <app-empty-state
            title="Trash is empty"
            message="Deleted people and occasions will appear here for 30 days."
            icon="trash-outline" />
        } @else {
          @if (store.trashedPeople().length) {
            <div class="section-heading">
              <div>
                <span class="eyebrow">Deleted records</span>
                <h2>People</h2>
              </div>
            </div>
            <ion-list inset="true">
              @for (person of store.trashedPeople(); track person.id) {
                <ion-item>
                  <app-person-avatar slot="start" [name]="person.name" [photoPath]="person.photoPath" />
                  <ion-label>
                    <h2>{{ person.name }}</h2>
                    <p>
                      {{ store.occasionsFor(person.id, true).length }} occasions ·
                      {{ daysRemaining(person.deleteAfter) }} days left
                    </p>
                    <ion-badge
                      [color]="
                        person.source === 'ANDROID_CONTACT_DELETED'
                          ? 'warning'
                          : person.source === 'ANDROID_CONTACT'
                            ? 'primary'
                            : 'medium'
                      ">
                      {{
                        person.source === 'ANDROID_CONTACT_DELETED'
                          ? 'Contact deleted'
                          : person.source === 'ANDROID_CONTACT'
                            ? 'Contact synced'
                            : 'Created in app'
                      }}
                    </ion-badge>
                  </ion-label>
                  <ion-button slot="end" fill="clear" (click)="restorePerson(person.id)">
                    <ion-icon slot="start" name="refresh-outline"></ion-icon>Restore
                  </ion-button>
                  <ion-button
                    slot="end"
                    fill="clear"
                    color="danger"
                    (click)="confirmDeletePerson(person.id, person.name)"
                    [attr.aria-label]="'Delete ' + person.name + ' permanently'">
                    <ion-icon slot="icon-only" name="trash-outline"></ion-icon>
                  </ion-button>
                </ion-item>
              }
            </ion-list>
          }
          @if (standaloneOccasions().length) {
            <div class="section-heading">
              <div>
                <span class="eyebrow">Deleted dates</span>
                <h2>Occasions</h2>
              </div>
            </div>
            <ion-list inset="true">
              @for (occasion of standaloneOccasions(); track occasion.id) {
                <ion-item>
                  <ion-icon
                    slot="start"
                    [name]="occasion.type === 'BIRTHDAY' ? 'gift-outline' : 'heart-outline'"
                    color="primary"></ion-icon>
                  <ion-label>
                    <h2>{{ occasion.customTypeName || labels[occasion.type] }}</h2>
                    <p>
                      {{ personName(occasion) }} · {{ dates.formatDate(occasion) }} ·
                      {{ daysRemaining(occasion.deleteAfter) }} days left
                    </p>
                  </ion-label>
                  <ion-button slot="end" fill="clear" (click)="restoreOccasion(occasion.id)">
                    <ion-icon slot="start" name="refresh-outline"></ion-icon>Restore
                  </ion-button>
                  <ion-button
                    slot="end"
                    fill="clear"
                    color="danger"
                    (click)="confirmDeleteOccasion(occasion)"
                    [attr.aria-label]="'Delete ' + (occasion.customTypeName || labels[occasion.type]) + ' permanently'">
                    <ion-icon slot="icon-only" name="trash-outline"></ion-icon>
                  </ion-button>
                </ion-item>
              }
            </ion-list>
          }
        }
      </main>
    </ion-content>`,
})
export class TrashPage {
  readonly store = inject(BirthdayStoreService);
  readonly dates = inject(OccasionDateService);
  readonly labels = OCCASION_LABELS;
  private readonly scheduler = inject(ReminderSchedulerService);
  private readonly alerts = inject(AlertController);
  private readonly toasts = inject(ToastController);
  readonly standaloneOccasions = computed(() => {
    const trashedPersonIds = new Set(this.store.trashedPeople().map(person => person.id));
    return this.store.trashedOccasions().filter(occasion => !trashedPersonIds.has(occasion.personId));
  });

  personName(occasion: Occasion): string {
    return this.store.person(occasion.personId)?.name ?? 'Unknown person';
  }

  daysRemaining(deleteAfter: string | undefined): number {
    if (!deleteAfter) return 30;
    return Math.max(0, Math.ceil((new Date(deleteAfter).getTime() - Date.now()) / 86_400_000));
  }

  async restorePerson(id: string): Promise<void> {
    await this.store.restorePerson(id);
    await this.scheduler.reconcileAll(false);
    await this.toast('Person restored');
  }

  async restoreOccasion(id: string): Promise<void> {
    await this.store.restoreOccasion(id);
    await this.scheduler.reconcileAll(false);
    await this.toast('Occasion restored');
  }

  async confirmDeletePerson(id: string, name: string): Promise<void> {
    const alert = await this.alerts.create({
      header: `Delete ${name} permanently?`,
      message: 'This cannot be undone. All occasions and reminders for this person will also be deleted.',
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Delete permanently',
          role: 'destructive',
          handler: () => void this.store.permanentlyDeletePerson(id).then(() => this.toast('Permanently deleted')),
        },
      ],
    });
    await alert.present();
  }

  async confirmDeleteOccasion(occasion: Occasion): Promise<void> {
    const label = occasion.customTypeName || this.labels[occasion.type];
    const alert = await this.alerts.create({
      header: `Delete ${label} permanently?`,
      message: 'This cannot be undone.',
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Delete permanently',
          role: 'destructive',
          handler: () =>
            void this.store.permanentlyDeleteOccasion(occasion.id).then(() => this.toast('Permanently deleted')),
        },
      ],
    });
    await alert.present();
  }

  async confirmEmpty(): Promise<void> {
    const alert = await this.alerts.create({
      header: 'Empty Trash?',
      message: 'Every person and occasion in Trash will be permanently deleted. This cannot be undone.',
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Empty Trash',
          role: 'destructive',
          handler: () => void this.store.emptyTrash().then(() => this.toast('Trash emptied')),
        },
      ],
    });
    await alert.present();
  }

  private async toast(message: string): Promise<void> {
    const toast = await this.toasts.create({ message, duration: 1700 });
    await toast.present();
  }
}
