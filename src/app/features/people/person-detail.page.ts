import { Component, computed, inject } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import {
  AlertController,
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
              <p>{{ person.source === 'ANDROID_CONTACT' ? 'Linked to Android Contacts' : 'Saved locally' }}</p>
            </div>
          </section>
          @if (!person.contactAvailable) {
            <ion-card color="warning"
              ><ion-card-content
                >Android contact is no longer available. Your local data is safe.</ion-card-content
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
                    ><ion-note slot="end">{{ store.remindersFor(occasion.id).length }} reminders</ion-note></ion-item
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
          @if (person.source === 'ANDROID_CONTACT') {
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
      message: 'This removes the occasion and its reminders from this app.',
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Delete',
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
      message:
        'This removes the person, all occasions, and all reminders from this app. Android Contacts will not be changed.',
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Delete',
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
