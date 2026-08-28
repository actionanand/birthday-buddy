import { Service, inject, signal } from '@angular/core';
import { Capacitor, registerPlugin } from '@capacitor/core';
import { AndroidContactSummary, ContactSyncCandidate, Occasion } from '../models/domain.models';
import { createId } from '../utils/id';
import { BirthdayStoreService } from './birthday-store.service';
import { ReminderSchedulerService } from './reminder-scheduler.service';

interface NativeContactsPlugin {
  pickContact(): Promise<{ contact?: AndroidContactSummary }>;
  readContacts(options: { linkedLookupKeys: string[] }): Promise<{
    contacts: AndroidContactSummary[];
    lookupKeys?: string[];
  }>;
  permissionStatus(): Promise<{ granted: boolean }>;
}

const NativeContacts = registerPlugin<NativeContactsPlugin>('BirthdayBuddyContacts');

@Service()
export class ContactSyncService {
  private readonly store = inject(BirthdayStoreService);
  private readonly scheduler = inject(ReminderSchedulerService);
  readonly candidates = signal<ContactSyncCandidate[]>([]);
  readonly syncing = signal(false);
  readonly availabilityChanges = signal(0);

  get available(): boolean {
    return Capacitor.getPlatform() === 'android';
  }

  async pickContact(): Promise<ContactSyncCandidate[]> {
    if (!this.available) return [];
    const result = await NativeContacts.pickContact();
    this.availabilityChanges.set(0);
    const candidates = result.contact ? this.compare([result.contact]) : [];
    this.candidates.set(candidates);
    return candidates;
  }

  async scanContacts(): Promise<ContactSyncCandidate[]> {
    if (!this.available) return [];
    if (this.syncing()) return this.candidates();
    this.syncing.set(true);
    try {
      const linkedLookupKeys = this.store
        .activePeople()
        .flatMap(person => [person.androidContactLookupKey, ...(person.androidContactLookupKeys ?? [])])
        .filter((value): value is string => Boolean(value));
      const result = await NativeContacts.readContacts({ linkedLookupKeys });
      this.availabilityChanges.set(
        await this.syncAvailability(result.lookupKeys ?? result.contacts.map(contact => contact.lookupKey)),
      );
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
    if (permission.granted) {
      const candidates = await this.scanContacts();
      await this.apply(candidates, false);
    }
  }

  async apply(candidates = this.candidates(), requestNotificationPermission = true): Promise<void> {
    const selectedCandidates = candidates.filter(item => item.selected);
    for (const candidate of selectedCandidates) {
      const contact = candidate.contact;
      let person = candidate.personId ? this.store.person(candidate.personId) : undefined;
      if (candidate.kind === 'NEW_PERSON') {
        person = this.findPerson(contact.lookupKey);
        person ??= await this.store.savePerson({
          name: contact.displayName,
          favorite: contact.favorite,
          source: 'ANDROID_CONTACT',
          androidContactLookupKey: contact.lookupKey,
          androidContactLookupKeys: [contact.lookupKey],
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
      if (candidate.kind === 'FAVORITE_CHANGE' && person) await this.store.savePerson({ ...person, favorite: true });
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
              androidEventReference: candidate.event.reference,
              userModified: false,
            },
            reminders,
            first?.hour ?? 8,
            first?.minute ?? 0,
          );
        }
      }
      if (candidate.kind === 'EVENT_LINK_CHANGE' && candidate.occasionId && candidate.event) {
        const occasion = this.store.occasion(candidate.occasionId);
        if (occasion) {
          const reminders = this.store
            .remindersFor(occasion.id)
            .map(reminder => ({ unit: reminder.offsetUnit, value: reminder.offsetValue }));
          const first = this.store.remindersFor(occasion.id)[0];
          await this.store.saveOccasion(
            {
              ...occasion,
              source: 'ANDROID_CONTACT',
              androidEventReference: candidate.event.reference,
              userModified: occasion.source === 'MANUAL' || occasion.userModified,
            },
            reminders,
            first?.hour ?? 8,
            first?.minute ?? 0,
          );
        }
      }
    }
    if (selectedCandidates.length) await this.scheduler.reconcileAll(requestNotificationPermission);
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
      const contactEvents = this.uniqueEvents(contact.events);
      const person = this.findPerson(contact.lookupKey);
      if (!person) {
        for (const event of contactEvents)
          result.push(this.candidate('NEW_PERSON', contact, undefined, undefined, event));
        continue;
      }
      if (!person.nameUserModified && person.name !== contact.displayName)
        result.push(this.candidate('NAME_CHANGE', contact, person.id));
      if (
        !person.photoUserModified &&
        person.photoPath !== contact.photoData &&
        (person.photoSource === 'ANDROID_CONTACT' || Boolean(contact.photoData))
      )
        result.push(this.candidate('PHOTO_CHANGE', contact, person.id));
      if (contact.favorite && !person.favorite) result.push(this.candidate('FAVORITE_CHANGE', contact, person.id));
      for (const event of contactEvents) {
        if (
          ignores.some(
            ignore =>
              ignore.ignoreType === 'OCCASION' &&
              ignore.androidContactLookupKey === contact.lookupKey &&
              (ignore.androidEventReference === event.reference || ignore.eventType === event.type),
          )
        )
          continue;
        const occasionsOfType = this.store
          .occasionsFor(person.id)
          .filter(
            item =>
              item.type === event.type &&
              (event.type !== 'CUSTOM' ||
                (item.customTypeName?.trim().toLocaleLowerCase() ?? '') ===
                  (event.customTypeName?.trim().toLocaleLowerCase() ?? '')),
          );
        const occasion =
          occasionsOfType.find(item => item.androidEventReference === event.reference) ??
          occasionsOfType.find(
            item => item.day === event.day && item.month === event.month && item.year === event.year,
          ) ??
          (occasionsOfType.filter(item => item.source === 'ANDROID_CONTACT').length === 1 &&
          contactEvents.filter(item => item.type === event.type).length === 1
            ? occasionsOfType.find(item => item.source === 'ANDROID_CONTACT')
            : undefined);
        if (!occasion) result.push(this.candidate('NEW_OCCASION', contact, person.id, undefined, event));
        else if (occasion.day !== event.day || occasion.month !== event.month || occasion.year !== event.year) {
          result.push(this.candidate('DATE_CONFLICT', contact, person.id, occasion.id, event));
        } else if (occasion.androidEventReference !== event.reference)
          result.push(this.candidate('EVENT_LINK_CHANGE', contact, person.id, occasion.id, event));
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
      selected: true,
      resolution:
        kind === 'NAME_CHANGE' || kind === 'PHOTO_CHANGE' || kind === 'DATE_CONFLICT' ? 'USE_CONTACT' : 'KEEP_APP',
    };
  }

  private async importEvent(personId: string, event: AndroidContactSummary['events'][number]): Promise<Occasion> {
    const settings = this.store.settings();
    const duplicate = this.store.findDuplicateOccasion({ personId, ...event });
    if (duplicate) return duplicate;
    return this.store.saveOccasion(
      {
        personId,
        type: event.type,
        customTypeName: event.customTypeName,
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

  private async syncAvailability(lookupKeys: string[]): Promise<number> {
    const availableLookupKeys = new Set(lookupKeys);
    let changes = 0;
    for (const person of this.store.activePeople()) {
      const personLookupKeys = [person.androidContactLookupKey, ...(person.androidContactLookupKeys ?? [])].filter(
        (value): value is string => Boolean(value),
      );
      if (!personLookupKeys.length || person.source === 'MANUAL') continue;
      const available = personLookupKeys.some(key => availableLookupKeys.has(key));
      const source = available ? 'ANDROID_CONTACT' : 'ANDROID_CONTACT_DELETED';
      if (person.contactAvailable === available && person.source === source) continue;
      await this.store.savePerson({ ...person, source, contactAvailable: available });
      changes += 1;
    }
    return changes;
  }

  private findPerson(lookupKey: string) {
    return this.store
      .activePeople()
      .find(
        person => person.androidContactLookupKey === lookupKey || person.androidContactLookupKeys?.includes(lookupKey),
      );
  }

  private uniqueEvents(events: AndroidContactSummary['events']): AndroidContactSummary['events'] {
    const identities = new Set<string>();
    return events.filter(event => {
      const identity = `${event.type}:${event.customTypeName?.trim().toLocaleLowerCase() ?? ''}:${event.year ?? ''}-${event.month}-${event.day}`;
      if (identities.has(identity)) return false;
      identities.add(identity);
      return true;
    });
  }
}
