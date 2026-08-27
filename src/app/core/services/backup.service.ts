import { Service, inject } from '@angular/core';
import { Capacitor, registerPlugin } from '@capacitor/core';
import { Directory, Encoding, Filesystem } from '@capacitor/filesystem';
import { AppSettings, ContactSyncIgnore, Occasion, OccasionReminder, Person } from '../models/domain.models';
import { BirthdayStoreService } from './birthday-store.service';
import { RepositoryProviderService } from './repository-provider.service';

export interface BackupPayload {
  format: 'birthday-buddy-backup';
  version: 1;
  createdAt: string;
  people: Person[];
  occasions: Occasion[];
  reminders: OccasionReminder[];
  ignores: ContactSyncIgnore[];
  settings: AppSettings;
}

export interface RestoreResult {
  people: number;
  occasions: number;
  reminders: number;
}

interface EncryptedBackup {
  format: 'birthday-buddy-encrypted-backup';
  version: 1;
  createdAt: string;
  iterations: number;
  salt: string;
  iv: string;
  ciphertext: string;
}

interface BirthdayBuddyFilesPlugin {
  exportFile(options: { filename: string; mimeType: string; contents: string }): Promise<{ saved: boolean }>;
  pickFile(options: { mimeType: string; extension: string }): Promise<{ contents?: string }>;
}

const NativeFiles = registerPlugin<BirthdayBuddyFilesPlugin>('BirthdayBuddyFiles');

@Service()
export class BackupService {
  private readonly store = inject(BirthdayStoreService);
  private readonly repositories = inject(RepositoryProviderService);
  private readonly iterations = 250_000;

  async export(password: string): Promise<string> {
    if (password.length < 8) throw new Error('Use a backup password with at least 8 characters.');
    const createdAt = new Date().toISOString();
    const payload: BackupPayload = {
      format: 'birthday-buddy-backup',
      version: 1,
      createdAt,
      people: this.store.people(),
      occasions: this.store.occasions(),
      reminders: this.store.reminders(),
      ignores: this.store.ignores(),
      settings: this.store.settings(),
    };
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const key = await this.deriveKey(password, salt, ['encrypt']);
    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      new TextEncoder().encode(JSON.stringify(payload)),
    );
    const backup: EncryptedBackup = {
      format: 'birthday-buddy-encrypted-backup',
      version: 1,
      createdAt,
      iterations: this.iterations,
      salt: this.toBase64(salt),
      iv: this.toBase64(iv),
      ciphertext: this.toBase64(new Uint8Array(encrypted)),
    };
    const contents = JSON.stringify(backup);
    const filename = `occasion-backup-${createdAt.slice(0, 10)}.ocbackup`;
    if (Capacitor.getPlatform() === 'android') {
      const result = await NativeFiles.exportFile({
        filename,
        mimeType: 'application/octet-stream',
        contents,
      });
      if (!result.saved) throw new Error('Backup export was cancelled.');
    } else if (Capacitor.isNativePlatform()) {
      await Filesystem.writeFile({
        path: filename,
        data: contents,
        directory: Directory.Documents,
        encoding: Encoding.UTF8,
        recursive: true,
      });
    } else {
      const url = URL.createObjectURL(new Blob([contents], { type: 'application/octet-stream' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      link.click();
      URL.revokeObjectURL(url);
    }
    return filename;
  }

  async pickBackup(): Promise<string | undefined> {
    if (Capacitor.getPlatform() !== 'android') return undefined;
    const result = await NativeFiles.pickFile({
      mimeType: 'application/octet-stream',
      extension: '.ocbackup',
    });
    return result.contents;
  }

  async preview(contents: string, password: string): Promise<BackupPayload> {
    const backup = JSON.parse(contents) as Partial<EncryptedBackup>;
    if (
      backup.format !== 'birthday-buddy-encrypted-backup' ||
      backup.version !== 1 ||
      !backup.salt ||
      !backup.iv ||
      !backup.ciphertext
    ) {
      throw new Error('This is not a supported Birthday Buddy backup.');
    }
    const salt = this.fromBase64(backup.salt);
    const iv = this.fromBase64(backup.iv);
    const key = await this.deriveKey(password, salt, ['decrypt']);
    let decrypted: ArrayBuffer;
    try {
      decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, this.fromBase64(backup.ciphertext));
    } catch {
      throw new Error('The backup password is incorrect or the backup is damaged.');
    }
    const payload = JSON.parse(new TextDecoder().decode(decrypted)) as BackupPayload;
    if (payload.format !== 'birthday-buddy-backup' || payload.version !== 1)
      throw new Error('The decrypted backup is invalid.');
    return payload;
  }

  async restore(payload: BackupPayload, mode: 'MERGE' | 'REPLACE'): Promise<RestoreResult> {
    const stores = ['people', 'occasions', 'occasion_reminders', 'contact_sync_ignores'] as const;
    if (mode === 'REPLACE') {
      await this.repositories.adapter.clear([...stores]);
      await this.repositories.adapter.batch([
        ...payload.people.map(value => ({ store: 'people' as const, operation: 'PUT' as const, value })),
        ...payload.occasions.map(value => ({ store: 'occasions' as const, operation: 'PUT' as const, value })),
        ...payload.reminders.map(value => ({ store: 'occasion_reminders' as const, operation: 'PUT' as const, value })),
        ...payload.ignores.map(value => ({ store: 'contact_sync_ignores' as const, operation: 'PUT' as const, value })),
        { store: 'app_settings', operation: 'PUT', value: payload.settings },
      ]);
      return {
        people: payload.people.length,
        occasions: payload.occasions.length,
        reminders: payload.reminders.length,
      };
    }

    const identity = (person: Person) =>
      person.androidContactLookupKey ? `contact:${person.androidContactLookupKey}` : `local-id:${person.id}`;
    const existingPeople = new Map(this.store.people().map(person => [identity(person), person]));
    const personIdMap = new Map<string, string>();
    const people: Person[] = [];
    for (const person of payload.people) {
      const existing = existingPeople.get(identity(person));
      personIdMap.set(person.id, existing?.id ?? person.id);
      if (!existing) people.push(person);
    }
    const occasionIdentity = (occasion: Occasion) =>
      `${occasion.personId}:${occasion.type}:${occasion.customTypeName?.trim().toLocaleLowerCase() ?? ''}:${occasion.year ?? ''}-${occasion.month}-${occasion.day}`;
    const existingOccasions = new Map(this.store.occasions().map(occasion => [occasionIdentity(occasion), occasion]));
    const occasionIdMap = new Map<string, string>();
    const occasions: Occasion[] = [];
    for (const original of payload.occasions) {
      const occasion = { ...original, personId: personIdMap.get(original.personId) ?? original.personId };
      const existing = existingOccasions.get(occasionIdentity(occasion));
      occasionIdMap.set(original.id, existing?.id ?? occasion.id);
      if (!existing) occasions.push(occasion);
    }
    const newOccasionIds = new Set(occasions.map(occasion => occasion.id));
    const reminders = payload.reminders
      .map(reminder => ({ ...reminder, occasionId: occasionIdMap.get(reminder.occasionId) ?? reminder.occasionId }))
      .filter(reminder => newOccasionIds.has(reminder.occasionId));
    await this.repositories.adapter.batch([
      ...people.map(value => ({ store: 'people' as const, operation: 'PUT' as const, value })),
      ...occasions.map(value => ({ store: 'occasions' as const, operation: 'PUT' as const, value })),
      ...reminders.map(value => ({ store: 'occasion_reminders' as const, operation: 'PUT' as const, value })),
      ...payload.ignores.map(value => ({ store: 'contact_sync_ignores' as const, operation: 'PUT' as const, value })),
    ]);
    return { people: people.length, occasions: occasions.length, reminders: reminders.length };
  }

  private async deriveKey(password: string, salt: Uint8Array<ArrayBuffer>, usages: KeyUsage[]): Promise<CryptoKey> {
    const material = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, [
      'deriveKey',
    ]);
    return crypto.subtle.deriveKey(
      { name: 'PBKDF2', hash: 'SHA-256', salt, iterations: this.iterations },
      material,
      { name: 'AES-GCM', length: 256 },
      false,
      usages,
    );
  }

  private toBase64(value: Uint8Array): string {
    let binary = '';
    for (const byte of value) binary += String.fromCharCode(byte);
    return btoa(binary);
  }

  private fromBase64(value: string): Uint8Array<ArrayBuffer> {
    const decoded = atob(value);
    const bytes = new Uint8Array(decoded.length);
    for (let index = 0; index < decoded.length; index += 1) bytes[index] = decoded.charCodeAt(index);
    return bytes;
  }
}
