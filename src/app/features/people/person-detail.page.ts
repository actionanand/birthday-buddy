import { Component, computed, inject } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import {
  AlertController,
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
  IonItemOption,
  IonItemOptions,
  IonItemSliding,
  IonLabel,
  IonList,
  IonNote,
  IonTitle,
  IonToolbar,
  ToastController,
} from '@ionic/angular';
import { OCCASION_LABELS } from '../../core/models/domain.models';
import { BirthdayStoreService } from '../../core/services/birthday-store.service';
import { OccasionDateService } from '../../core/services/occasion-date.service';
import { ReminderSchedulerService } from '../../core/services/reminder-scheduler.service';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';
import { PersonAvatarComponent } from '../../shared/components/person-avatar/person-avatar.component';

@Component({
  selector: 'app-person-detail',
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
    IonItemOption,
    IonItemOptions,
    IonItemSliding,
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
        ><ion-buttons slot="start"><ion-back-button defaultHref="/tabs/people"></ion-back-button></ion-buttons
        ><ion-title>Person</ion-title
        ><ion-buttons slot="end">
          @if (person(); as person) {
            <ion-button [routerLink]="['/person', person.id, 'edit']" aria-label="Edit person"
              ><ion-icon name="create-outline"></ion-icon
            ></ion-button>
          }</ion-buttons></ion-toolbar></ion-header
    ><ion-content
      ><main class="page-shell">
        @if (person(); as person) {
          <section class="profile-hero">
            <app-person-avatar [name]="person.name" [photoPath]="person.photoPath" size="large" />
            <div>
              <h1>{{ person.name }}</h1>
              @if (person.source === 'ANDROID_CONTACT') {
                <ion-badge color="primary"><ion-icon name="sync-outline"></ion-icon>Contact synced</ion-badge>
              } @else if (person.source === 'ANDROID_CONTACT_DELETED') {
                <ion-badge color="warning"
                  ><ion-icon name="alert-circle-outline"></ion-icon>Synced contact deleted</ion-badge
                >
              } @else {
                <ion-badge color="medium"><ion-icon name="person-outline"></ion-icon>Created in app</ion-badge>
              }
            </div>
          </section>
          @if (!person.contactAvailable) {
            <ion-card color="warning"
              ><ion-card-content
                >The linked Android contact was deleted. Birthday Buddy kept this person's name, photo, occasions, and
                reminders locally. You can edit it, unlink it, or move it to Trash.</ion-card-content
              ></ion-card
            >
          }
          <div class="section-heading">
            <div>
              <span class="eyebrow">Important dates</span>
              <h2>Occasions</h2>
            </div>
            <ion-button [routerLink]="['/occasion/new']" [queryParams]="{ personId: person.id }"
              ><ion-icon slot="start" name="add"></ion-icon>Add</ion-button
            >
          </div>
          @if (!occasions().length) {
            <app-empty-state
              title="No occasions yet"
              message="Add a birthday, anniversary, or another date for this person."
              icon="gift-outline" />
          } @else {
            <ion-list inset="true">
              @for (occasion of occasions(); track occasion.id) {
                <ion-item-sliding
                  ><ion-item [routerLink]="['/occasion', occasion.id, 'edit']" detail="true"
                    ><ion-icon
                      slot="start"
                      [name]="occasion.type === 'BIRTHDAY' ? 'gift-outline' : 'heart-outline'"
                      color="primary"></ion-icon
                    ><ion-label
                      ><h2>{{ occasion.customTypeName || labels[occasion.type] }}</h2>
                      <p>{{ dates.formatDate(occasion) }}</p></ion-label
                    ><ion-note slot="end">{{
                      occasion.reminderMode === 'DEFAULT'
                        ? 'Default reminders'
                        : store.remindersFor(occasion.id).length + ' custom reminders'
                    }}</ion-note></ion-item
                  ><ion-item-options side="end"
                    ><ion-item-option
                      color="danger"
                      (click)="deleteOccasion(occasion.id, occasion.customTypeName || labels[occasion.type])"
                      [attr.aria-label]="'Delete ' + (occasion.customTypeName || labels[occasion.type])"
                      ><ion-icon slot="icon-only" name="trash-outline"></ion-icon></ion-item-option></ion-item-options
                ></ion-item-sliding>
              }
            </ion-list>
          }
          @if (person.source !== 'MANUAL') {
            <ion-button expand="block" fill="outline" (click)="unlink(person.id)"
              ><ion-icon slot="start" name="unlink-outline"></ion-icon>Unlink from Contacts</ion-button
            >
          }
          <ion-button expand="block" fill="clear" color="danger" (click)="deletePerson(person.id, person.name)"
            >Delete person</ion-button
          >
        }
      </main></ion-content
    >`,
})
export class PersonDetailPage {
  readonly store = inject(BirthdayStoreService);
  readonly dates = inject(OccasionDateService);
  readonly labels = OCCASION_LABELS;
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly alerts = inject(AlertController);
  private readonly scheduler = inject(ReminderSchedulerService);
  private readonly toasts = inject(ToastController);
  readonly id = this.route.snapshot.paramMap.get('id') ?? '';
  readonly person = computed(() => this.store.person(this.id));
  readonly occasions = computed(() => this.store.occasionsFor(this.id));
  async deleteOccasion(id: string, label: string): Promise<void> {
    const alert = await this.alerts.create({
      header: `Delete ${label}?`,
      message: 'This occasion will move to Trash for 30 days. Its reminders will stop until it is restored.',
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Move to Trash',
          role: 'destructive',
          handler: () => {
            void this.scheduler.cancelOccasion(id).then(() => this.store.deleteOccasion(id));
          },
        },
      ],
    });
    await alert.present();
  }
  async unlink(id: string): Promise<void> {
    const alert = await this.alerts.create({
      header: 'Unlink from Contacts?',
      message:
        'This person will remain with all occasions and reminders. Future Android Contact changes will no longer be detected.',
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Unlink',
          handler: () => {
            void this.store.unlinkPerson(id).then(() => this.toast('Contact unlinked'));
          },
        },
      ],
    });
    await alert.present();
  }
  async deletePerson(id: string, name: string): Promise<void> {
    const alert = await this.alerts.create({
      header: `Delete ${name}?`,
      message: 'This person and all occasions will move to Trash for 30 days. Android Contacts will not be changed.',
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Move to Trash',
          role: 'destructive',
          handler: () => {
            void this.removePerson(id);
          },
        },
      ],
    });
    await alert.present();
  }
  private async removePerson(id: string): Promise<void> {
    for (const occasion of this.store.occasionsFor(id)) await this.scheduler.cancelOccasion(occasion.id);
    await this.store.deletePerson(id);
    await this.router.navigate(['/tabs/people']);
  }
  private async toast(message: string): Promise<void> {
    const toast = await this.toasts.create({ message, duration: 1600 });
    await toast.present();
  }
}
