import { Service, inject, signal } from '@angular/core';
import { Capacitor, registerPlugin } from '@capacitor/core';
import { AndroidContactSummary, ContactSyncCandidate, Occasion } from '../models/domain.models';
import { createId } from '../utils/id';
import { BirthdayStoreService } from './birthday-store.service';
import { ReminderSchedulerService } from './reminder-scheduler.service';

interface NativeContactsPlugin {
  pickContact(): Promise<{ contact?: AndroidContactSummary }>;
  readContacts(): Promise<{ contacts: AndroidContactSummary[] }>;
  permissionStatus(): Promise<{ granted: boolean }>;
}

const NativeContacts = registerPlugin<NativeContactsPlugin>('BirthdayBuddyContacts');

@Service()
export class ContactSyncService {
  private readonly store = inject(BirthdayStoreService);
  private readonly scheduler = inject(ReminderSchedulerService);
  readonly candidates = signal<ContactSyncCandidate[]>([]);
  readonly syncing = signal(false);

  get available(): boolean {
    return Capacitor.getPlatform() === 'android';
  }

  async pickContact(): Promise<ContactSyncCandidate[]> {
    if (!this.available) return [];
    const result = await NativeContacts.pickContact();
    const candidates = result.contact ? this.compare([result.contact]) : [];
    this.candidates.set(candidates);
    return candidates;
  }

  async scanContacts(): Promise<ContactSyncCandidate[]> {
    if (!this.available) return [];
    this.syncing.set(true);
    try {
      const result = await NativeContacts.readContacts();
      const candidates = this.compare(result.contacts);
      this.candidates.set(candidates);
      await this.store.updateSettings({ ...this.store.settings(), lastContactSyncAt: new Date().toISOString() });
      return candidates;
    } finally {
      this.syncing.set(false);
    }
  }

  async automaticScanIfDue(): Promise<void> {
    if (!this.available || this.store.settings().contactSyncMode === 'MANUAL') return;
    const lastSync = this.store.settings().lastContactSyncAt;
    if (this.store.settings().contactSyncMode === 'DAILY' && lastSync) {
      const elapsed = Date.now() - new Date(lastSync).getTime();
      if (elapsed < 86_400_000) return;
    }
    const permission = await NativeContacts.permissionStatus();
    if (permission.granted) await this.scanContacts();
  }

  async apply(candidates = this.candidates()): Promise<void> {
    for (const candidate of candidates.filter(item => item.selected)) {
      const contact = candidate.contact;
      let person = candidate.personId ? this.store.person(candidate.personId) : undefined;
      if (candidate.kind === 'NEW_PERSON') {
        person = this.store.people().find(item => item.androidContactLookupKey === contact.lookupKey);
        person ??= await this.store.savePerson({
          name: contact.displayName,
          favorite: false,
          source: 'ANDROID_CONTACT',
          androidContactLookupKey: contact.lookupKey,
          photoPath: contact.photoData,
          photoSource: contact.photoData ? 'ANDROID_CONTACT' : 'INITIALS',
          contactAvailable: true,
        });
        if (candidate.event) await this.importEvent(person.id, candidate.event);
      }
      if (candidate.kind === 'NEW_OCCASION' && person && candidate.event)
        await this.importEvent(person.id, candidate.event);
      if (candidate.kind === 'NAME_CHANGE' && person && candidate.resolution === 'USE_CONTACT') {
        await this.store.savePerson({ ...person, name: contact.displayName, nameUserModified: false });
      }
      if (candidate.kind === 'PHOTO_CHANGE' && person && candidate.resolution === 'USE_CONTACT') {
        await this.store.savePerson({
          ...person,
          photoPath: contact.photoData,
          photoSource: 'ANDROID_CONTACT',
          photoUserModified: false,
        });
      }
      if (
        candidate.kind === 'DATE_CONFLICT' &&
        candidate.occasionId &&
        candidate.event &&
        candidate.resolution === 'USE_CONTACT'
      ) {
        const occasion = this.store.occasion(candidate.occasionId);
        if (occasion) {
          const reminders = this.store
            .remindersFor(occasion.id)
            .map(reminder => ({ unit: reminder.offsetUnit, value: reminder.offsetValue }));
          const first = this.store.remindersFor(occasion.id)[0];
          await this.store.saveOccasion(
            {
              ...occasion,
              day: candidate.event.day,
              month: candidate.event.month,
              year: candidate.event.year,
              userModified: false,
            },
            reminders,
            first?.hour ?? 8,
            first?.minute ?? 0,
          );
        }
      }
    }
    await this.scheduler.reconcileAll(true);
    this.candidates.set([]);
  }

  private compare(contacts: AndroidContactSummary[]): ContactSyncCandidate[] {
    const ignores = this.store.ignores();
    const result: ContactSyncCandidate[] = [];
    for (const contact of contacts) {
      if (
        ignores.some(ignore => ignore.ignoreType === 'CONTACT' && ignore.androidContactLookupKey === contact.lookupKey)
      )
        continue;
      const person = this.store.people().find(item => item.androidContactLookupKey === contact.lookupKey);
      if (!person) {
        for (const event of contact.events)
          result.push(this.candidate('NEW_PERSON', contact, undefined, undefined, event));
        continue;
      }
      if (person.name !== contact.displayName) result.push(this.candidate('NAME_CHANGE', contact, person.id));
      if (contact.photoData && person.photoPath !== contact.photoData)
        result.push(this.candidate('PHOTO_CHANGE', contact, person.id));
      for (const event of contact.events) {
        if (
          ignores.some(
            ignore =>
              ignore.androidEventReference === event.reference && ignore.androidContactLookupKey === contact.lookupKey,
          )
        )
          continue;
        const occasion = this.store
          .occasionsFor(person.id)
          .find(item => item.androidEventReference === event.reference);
        if (!occasion) result.push(this.candidate('NEW_OCCASION', contact, person.id, undefined, event));
        else if (occasion.day !== event.day || occasion.month !== event.month || occasion.year !== event.year) {
          result.push(this.candidate('DATE_CONFLICT', contact, person.id, occasion.id, event));
        }
      }
    }
    return result;
  }

  private candidate(
    kind: ContactSyncCandidate['kind'],
    contact: AndroidContactSummary,
    personId?: string,
    occasionId?: string,
    event?: AndroidContactSummary['events'][number],
  ): ContactSyncCandidate {
    return {
      id: createId(),
      kind,
      contact,
      personId,
      occasionId,
      event,
      selected: kind === 'NEW_PERSON' || kind === 'NEW_OCCASION',
      resolution: 'KEEP_APP',
    };
  }

  private async importEvent(personId: string, event: AndroidContactSummary['events'][number]): Promise<Occasion> {
    const settings = this.store.settings();
    return this.store.saveOccasion(
      {
        personId,
        type: event.type,
        day: event.day,
        month: event.month,
        year: event.year,
        source: 'ANDROID_CONTACT',
        androidEventReference: event.reference,
        userModified: false,
        enabled: true,
      },
      settings.defaultReminderOffsets,
      settings.defaultReminderHour,
      settings.defaultReminderMinute,
    );
  }
}
