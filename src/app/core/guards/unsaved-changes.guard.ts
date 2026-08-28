import { inject } from '@angular/core';
import { CanDeactivateFn } from '@angular/router';
import { AlertController, ToastController } from '@ionic/angular';

export interface UnsavedChangesAware {
  hasUnsavedChanges(): boolean;
}

export const unsavedChangesGuard: CanDeactivateFn<UnsavedChangesAware> = async component => {
  if (!component.hasUnsavedChanges()) return true;

  const alerts = inject(AlertController);
  const toasts = inject(ToastController);
  const alert = await alerts.create({
    header: 'Discard unsaved changes?',
    message: 'You have changes that have not been saved. Continue editing or discard them and leave this screen.',
    backdropDismiss: false,
    buttons: [
      { text: 'Continue editing', role: 'cancel' },
      { text: 'Discard changes', role: 'destructive' },
    ],
  });
  await alert.present();
  const result = await alert.onDidDismiss();
  if (result.role !== 'destructive') return false;

  const toast = await toasts.create({ message: 'Unsaved changes discarded', duration: 1800 });
  await toast.present();
  return true;
};
