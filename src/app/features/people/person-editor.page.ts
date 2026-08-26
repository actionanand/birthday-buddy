import { Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Capacitor } from '@capacitor/core';
import {
  IonBackButton,
  IonButton,
  IonButtons,
  IonCheckbox,
  IonContent,
  IonHeader,
  IonIcon,
  IonInput,
  IonItem,
  IonList,
  IonTitle,
  IonToolbar,
  ToastController,
} from '@ionic/angular';
import { BirthdayStoreService } from '../../core/services/birthday-store.service';
import { PhotoService } from '../../core/services/photo.service';
import { PersonAvatarComponent } from '../../shared/components/person-avatar/person-avatar.component';

@Component({
  selector: 'app-person-editor',
  imports: [
    ReactiveFormsModule,
    IonBackButton,
    IonButton,
    IonButtons,
    IonCheckbox,
    IonContent,
    IonHeader,
    IonIcon,
    IonInput,
    IonItem,
    IonList,
    IonTitle,
    IonToolbar,
    PersonAvatarComponent,
  ],
  template: `<ion-header
      ><ion-toolbar
        ><ion-buttons slot="start"><ion-back-button defaultHref="/tabs/people"></ion-back-button></ion-buttons
        ><ion-title>{{ personId ? 'Edit Person' : 'Add Person' }}</ion-title
        ><ion-buttons slot="end"
          ><ion-button (click)="save()" [disabled]="form.invalid || saving()">Save</ion-button></ion-buttons
        ></ion-toolbar
      ></ion-header
    ><ion-content
      ><main class="form-shell">
        <section class="photo-editor">
          <app-person-avatar [name]="form.controls.name.value || 'New person'" [photoPath]="photo()" size="large" />
          <div>
            <ion-button size="small" fill="outline" (click)="choosePhoto()"
              ><ion-icon slot="start" name="image-outline"></ion-icon>Choose photo</ion-button
            >
            @if (native) {
              <ion-button size="small" fill="outline" (click)="takePhoto()"
                ><ion-icon slot="start" name="camera-outline"></ion-icon>Take photo</ion-button
              >
            }
            @if (photo()) {
              <ion-button size="small" fill="clear" color="danger" (click)="removePhoto()">Remove</ion-button>
            }
          </div>
          <input #fileInput class="visually-hidden" type="file" accept="image/*" (change)="browserPhoto($event)" />
        </section>
        <ion-list class="form-card"
          ><ion-item
            ><ion-input
              label="Name"
              labelPlacement="stacked"
              autocomplete="name"
              [formControl]="form.controls.name"
              required
              errorText="Enter a name"></ion-input></ion-item
          ><ion-item
            ><ion-checkbox justify="space-between" [formControl]="form.controls.favorite"
              >Favorite</ion-checkbox
            ></ion-item
          ></ion-list
        >
        <p class="form-help">
          Birthday Buddy stores only the details needed for occasions. Phone numbers, email, and address are never
          requested.
        </p>
        <ion-button expand="block" (click)="save()" [disabled]="form.invalid || saving()">{{
          personId ? 'Save changes' : 'Add person'
        }}</ion-button>
      </main></ion-content
    >`,
})
export class PersonEditorPage {
  readonly store = inject(BirthdayStoreService);
  private readonly photos = inject(PhotoService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly toasts = inject(ToastController);
  readonly native = Capacitor.isNativePlatform();
  readonly photo = signal<string | undefined>(undefined);
  readonly saving = signal(false);
  readonly personId = this.route.snapshot.paramMap.get('id');
  readonly form = new FormGroup({
    name: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(100)] }),
    favorite: new FormControl(false, { nonNullable: true }),
  });
  constructor() {
    void this.populate();
  }
  private async populate(): Promise<void> {
    await this.store.initialize();
    const person = this.personId ? this.store.person(this.personId) : undefined;
    if (person) {
      this.form.setValue({ name: person.name, favorite: person.favorite });
      this.photo.set(person.photoPath);
    }
  }
  async choosePhoto(): Promise<void> {
    if (this.native) this.photo.set(await this.photos.choose());
    else document.querySelector<HTMLInputElement>('input[type=file]')?.click();
  }
  async takePhoto(): Promise<void> {
    this.photo.set(await this.photos.take());
  }
  removePhoto(): void {
    this.photo.set(undefined);
  }
  async browserPhoto(event: Event): Promise<void> {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (file) this.photo.set(await this.photos.readBrowserFile(file));
  }
  async save(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.saving.set(true);
    const existing = this.personId ? this.store.person(this.personId) : undefined;
    const photoChanged = Boolean(existing && this.photo() !== existing.photoPath);
    const person = await this.store.savePerson({
      ...existing,
      id: this.personId ?? undefined,
      name: this.form.controls.name.value,
      favorite: this.form.controls.favorite.value,
      photoPath: this.photo(),
      photoSource: photoChanged
        ? this.photo()
          ? 'MANUAL'
          : 'INITIALS'
        : (existing?.photoSource ?? (this.photo() ? 'MANUAL' : 'INITIALS')),
      photoUserModified: photoChanged ? true : (existing?.photoUserModified ?? false),
    });
    this.saving.set(false);
    const toast = await this.toasts.create({ message: existing ? 'Person updated' : 'Person added', duration: 1600 });
    await toast.present();
    await this.router.navigate(['/person', person.id]);
  }
}
