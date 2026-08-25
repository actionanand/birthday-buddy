import { Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import {
  AlertController,
  IonButton,
  IonButtons,
  IonCheckbox,
  IonContent,
  IonFab,
  IonFabButton,
  IonHeader,
  IonIcon,
  IonItem,
  IonItemOption,
  IonItemOptions,
  IonItemSliding,
  IonLabel,
  IonList,
  IonModal,
  IonNote,
  IonRadio,
  IonRadioGroup,
  IonSearchbar,
  IonTitle,
  IonToolbar,
  ToastController,
} from '@ionic/angular';
import { OCCASION_LABELS } from '../../core/models/domain.models';
import { BirthdayStoreService } from '../../core/services/birthday-store.service';
import { ContactSyncService } from '../../core/services/contact-sync.service';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';
import { PersonAvatarComponent } from '../../shared/components/person-avatar/person-avatar.component';

@Component({
  selector: 'app-people',
  imports: [
    RouterLink,
    IonButton,
    IonButtons,
    IonCheckbox,
    IonContent,
    IonFab,
    IonFabButton,
    IonHeader,
    IonIcon,
    IonItem,
    IonItemOption,
    IonItemOptions,
    IonItemSliding,
    IonLabel,
    IonList,
    IonModal,
    IonNote,
    IonRadio,
    IonRadioGroup,
    IonSearchbar,
    IonTitle,
    IonToolbar,
    EmptyStateComponent,
    PersonAvatarComponent,
  ],
  template: `<ion-header translucent="true"
      ><ion-toolbar
        ><ion-title>People</ion-title
        ><ion-buttons slot="end">
          @if (sync.available) {
            <ion-button (click)="syncContacts()" aria-label="Sync contacts"
              ><ion-icon name="sync-outline"></ion-icon
            ></ion-button>
          }</ion-buttons></ion-toolbar
      ><ion-toolbar
        ><ion-searchbar
          aria-label="Search people"
          placeholder="Search people"
          [debounce]="250"
          (ionInput)="query.set($any($event.detail.value || ''))"></ion-searchbar></ion-toolbar
    ></ion-header>
    <ion-content fullscreen="true"
      ><main class="page-shell list-shell">
        @if (!filtered().length) {
          <app-empty-state
            title="No people yet"
            message="Add someone manually or choose from your contacts."
            icon="people-outline"
            actionLabel="Add a person"
            actionLink="/person/new" />
        } @else {
          <ion-list inset="true">
            @for (person of filtered(); track person.id) {
              <ion-item-sliding
                ><ion-item [routerLink]="['/person', person.id]" detail="true"
                  ><app-person-avatar slot="start" [name]="person.name" [photoPath]="person.photoPath" /><ion-label
                    ><h2>{{ person.name }}</h2>
                    <p>{{ occasionSummary(person.id) }}</p></ion-label
                  >
                  @if (person.favorite) {
                    <ion-icon slot="end" name="heart" color="primary" aria-label="Favorite"></ion-icon>
                  }</ion-item
                ><ion-item-options side="end"
                  ><ion-item-option
                    color="primary"
                    [routerLink]="['/person', person.id, 'edit']"
                    [attr.aria-label]="'Edit ' + person.name"
                    ><ion-icon slot="icon-only" name="create-outline"></ion-icon></ion-item-option
                  ><ion-item-option
                    color="danger"
                    (click)="confirmDelete(person.id, person.name)"
                    [attr.aria-label]="'Delete ' + person.name"
                    ><ion-icon slot="icon-only" name="trash-outline"></ion-icon></ion-item-option></ion-item-options
              ></ion-item-sliding>
            }
          </ion-list>
        }
        <ion-fab slot="fixed" vertical="bottom" horizontal="end"
          ><ion-fab-button (click)="addPerson()" aria-label="Add person"
            ><ion-icon name="add"></ion-icon></ion-fab-button
        ></ion-fab></main
    ></ion-content>
    <ion-modal [isOpen]="previewOpen()" (didDismiss)="previewOpen.set(false)"
      ><ng-template
        ><ion-header
          ><ion-toolbar
            ><ion-title>Sync Contacts</ion-title
            ><ion-buttons slot="end"
              ><ion-button (click)="previewOpen.set(false)">Close</ion-button></ion-buttons
            ></ion-toolbar
          ></ion-header
        ><ion-content
          ><div class="modal-shell">
            <p class="privacy-note">
              <ion-icon name="shield-checkmark-outline"></ion-icon>Contacts stay on this device and are never uploaded.
            </p>
            @if (!sync.candidates().length) {
              <app-empty-state
                title="Everything is up to date"
                message="No new birthdays, anniversaries, or changes were found."
                icon="checkmark-circle-outline" />
            } @else {
              <ion-list>
                @for (candidate of sync.candidates(); track candidate.id) {
                  <ion-item
                    ><app-person-avatar
                      slot="start"
                      [name]="candidate.contact.displayName"
                      [photoPath]="candidate.contact.photoData" /><ion-label
                      ><h2>{{ candidate.contact.displayName }}</h2>
                      <p>{{ candidateLabel(candidate.kind) }}</p>
                      @if (candidate.event) {
                        <ion-note
                          >{{ OCCASION_LABELS[candidate.event.type] }} · {{ candidate.event.day }}/{{
                            candidate.event.month
                          }}{{ candidate.event.year ? '/' + candidate.event.year : '' }}</ion-note
                        >
                      }</ion-label
                    ><ion-checkbox
                      slot="end"
                      [checked]="candidate.selected"
                      (ionChange)="candidate.selected = $any($event.detail.checked)"
                      [attr.aria-label]="'Apply change for ' + candidate.contact.displayName"></ion-checkbox
                  ></ion-item>
                  @if (
                    candidate.kind === 'DATE_CONFLICT' ||
                    candidate.kind === 'NAME_CHANGE' ||
                    candidate.kind === 'PHOTO_CHANGE'
                  ) {
                    <ion-radio-group
                      [value]="candidate.resolution"
                      (ionChange)="candidate.resolution = $any($event.detail.value)"
                      ><ion-item><ion-radio value="KEEP_APP">Keep app value</ion-radio></ion-item
                      ><ion-item
                        ><ion-radio value="USE_CONTACT">Use contact value</ion-radio></ion-item
                      ></ion-radio-group
                    >
                  }
                }</ion-list
              ><ion-button expand="block" (click)="applySync()">Apply selected changes</ion-button>
            }
          </div></ion-content
        ></ng-template
      ></ion-modal
    >`,
  styleUrl: 'people.page.scss',
})
export class PeoplePage {
  readonly store = inject(BirthdayStoreService);
  readonly sync = inject(ContactSyncService);
  readonly OCCASION_LABELS = OCCASION_LABELS;
  private readonly router = inject(Router);
  private readonly alerts = inject(AlertController);
  private readonly toasts = inject(ToastController);
  readonly query = signal('');
  readonly previewOpen = signal(false);
  readonly filtered = computed(() => {
    const query = this.query().trim().toLocaleLowerCase();
    return this.store
      .people()
      .filter(person => !query || person.name.toLocaleLowerCase().includes(query))
      .sort((a, b) => Number(b.favorite) - Number(a.favorite) || a.name.localeCompare(b.name));
  });
  occasionSummary(personId: string): string {
    const occasions = this.store.occasionsFor(personId);
    return occasions.length
      ? `${occasions.length} ${occasions.length === 1 ? 'occasion' : 'occasions'}`
      : 'No occasions';
  }
  async addPerson(): Promise<void> {
    if (!this.sync.available) {
      await this.router.navigate(['/person/new']);
      return;
    }
    const sheet = await this.alerts.create({
      header: 'Add Person',
      message: 'Choose how you would like to add someone.',
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Add Manually',
          handler: () => {
            void this.router.navigate(['/person/new']);
          },
        },
        {
          text: 'Add from Contacts',
          handler: () => {
            void this.pickContact();
          },
        },
      ],
    });
    await sheet.present();
  }
  async pickContact(): Promise<void> {
    await this.sync.pickContact();
    this.previewOpen.set(true);
  }
  async syncContacts(): Promise<void> {
    const alert = await this.alerts.create({
      header: 'Sync Contacts',
      message:
        'Contact access is used to find birthdays and anniversaries saved in your phone contacts. Your contacts stay on this device and are never uploaded.',
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Allow Contact Access',
          handler: () => {
            void this.scan();
          },
        },
      ],
    });
    await alert.present();
  }
  async scan(): Promise<void> {
    await this.sync.scanContacts();
    this.previewOpen.set(true);
  }
  async applySync(): Promise<void> {
    await this.sync.apply();
    this.previewOpen.set(false);
    await this.toast('Sync completed');
  }
  async confirmDelete(id: string, name: string): Promise<void> {
    const alert = await this.alerts.create({
      header: `Delete ${name}?`,
      message: `This removes ${name}, all occasions and all reminders from this app. The Android Contact will not be deleted.`,
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Delete',
          role: 'destructive',
          handler: () => {
            void this.store.deletePerson(id).then(() => this.toast('Person deleted'));
          },
        },
      ],
    });
    await alert.present();
  }
  candidateLabel(kind: string): string {
    return (
      (
        {
          NEW_PERSON: 'New contact with occasions',
          NEW_OCCASION: 'New occasion',
          NAME_CHANGE: 'Name changed in Contacts',
          PHOTO_CHANGE: 'Profile picture changed',
          DATE_CONFLICT: 'Date differs from app',
        } as Record<string, string>
      )[kind] ?? kind
    );
  }
  private async toast(message: string): Promise<void> {
    const toast = await this.toasts.create({ message, duration: 1800, position: 'bottom' });
    await toast.present();
  }
}
