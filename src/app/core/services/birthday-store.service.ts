import { Service, computed, inject, signal } from '@angular/core';
import {
  AppSettings,
  ContactSyncIgnore,
  DEFAULT_SETTINGS,
  Occasion,
  OccasionReminder,
  Person,
  ReminderChoice,
} from '../models/domain.models';
import { createId } from '../utils/id';
import { RepositoryProviderService } from './repository-provider.service';
import { OccasionDateService } from './occasion-date.service';

@Service()
export class BirthdayStoreService {
  private readonly repositories = inject(RepositoryProviderService);
  private readonly dates = inject(OccasionDateService);

  readonly people = signal<Person[]>([]);
  readonly occasions = signal<Occasion[]>([]);
  readonly reminders = signal<OccasionReminder[]>([]);
  readonly settings = signal<AppSettings>(DEFAULT_SETTINGS);
  readonly ignores = signal<ContactSyncIgnore[]>([]);
  readonly loading = signal(true);
  readonly ready = signal(false);

  readonly favorites = computed(() => this.people().filter(person => person.favorite));
  readonly enabledOccasions = computed(() => this.occasions().filter(occasion => occasion.enabled));
  readonly upcoming = computed(() =>
    this.enabledOccasions()
      .map(occasion => ({
        occasion,
        occurrence: this.dates.nextOccurrence(occasion, this.settings().feb29Policy),
        daysUntil: this.dates.daysUntil(occasion, this.settings().feb29Policy),
      }))
      .filter(
        (item): item is { occasion: Occasion; occurrence: Date; daysUntil: number } => item.occurrence !== undefined,
      )
      .sort((left, right) => left.daysUntil - right.daysUntil),
  );

  async initialize(): Promise<void> {
    if (this.ready()) return;
    this.loading.set(true);
    await this.repositories.initialize();
    const [people, occasions, reminders, settings, ignores] = await Promise.all([
      this.repositories.people.list(),
      this.repositories.occasions.list(),
      this.repositories.reminders.list(),
      this.repositories.settings.get(),
      this.repositories.contactSync.listIgnores(),
    ]);
    this.people.set(people);
    this.occasions.set(occasions);
    this.reminders.set(reminders);
    if (settings) this.settings.set(settings);
    else await this.updateSettings({ ...DEFAULT_SETTINGS, updatedAt: new Date().toISOString() });
    this.ignores.set(ignores);
    this.loading.set(false);
    this.ready.set(true);
  }

  person(id: string): Person | undefined {
    return this.people().find(person => person.id === id);
  }
  occasion(id: string): Occasion | undefined {
    return this.occasions().find(occasion => occasion.id === id);
  }
  occasionsFor(personId: string): Occasion[] {
    return this.occasions().filter(occasion => occasion.personId === personId);
  }
  remindersFor(occasionId: string): OccasionReminder[] {
    return this.reminders().filter(reminder => reminder.occasionId === occasionId);
  }

  async savePerson(input: Pick<Person, 'name' | 'favorite'> & Partial<Person>): Promise<Person> {
    const now = new Date().toISOString();
    const existing = input.id ? this.person(input.id) : undefined;
    const person: Person = {
      id: existing?.id ?? createId(),
      name: input.name.trim(),
      photoPath: 'photoPath' in input ? input.photoPath : existing?.photoPath,
      source: input.source ?? existing?.source ?? 'MANUAL',
      androidContactLookupKey:
        'androidContactLookupKey' in input ? input.androidContactLookupKey : existing?.androidContactLookupKey,
      favorite: input.favorite,
      nameUserModified:
        'nameUserModified' in input
          ? Boolean(input.nameUserModified)
          : existing
            ? input.name.trim() !== existing.name || existing.nameUserModified
            : false,
      photoSource: input.photoSource ?? existing?.photoSource ?? (input.photoPath ? 'MANUAL' : 'INITIALS'),
      photoUserModified:
        'photoUserModified' in input ? Boolean(input.photoUserModified) : (existing?.photoUserModified ?? false),
      contactAvailable: input.contactAvailable ?? existing?.contactAvailable ?? true,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
    await this.repositories.people.save(person);
    this.people.update(items =>
      [...items.filter(item => item.id !== person.id), person].sort((a, b) => a.name.localeCompare(b.name)),
    );
    return person;
  }

  async saveOccasion(
    input: Omit<Occasion, 'id' | 'createdAt' | 'updatedAt'> & Partial<Pick<Occasion, 'id'>>,
    choices: ReminderChoice[],
    hour: number,
    minute: number,
  ): Promise<Occasion> {
    const now = new Date().toISOString();
    const existing = input.id ? this.occasion(input.id) : undefined;
    const occasion: Occasion = {
      ...input,
      id: existing?.id ?? createId(),
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
    const oldReminders = existing ? this.remindersFor(existing.id) : [];
    const unique = [...new Map(choices.map(choice => [`${choice.unit}:${choice.value}`, choice])).values()];
    const reminders: OccasionReminder[] = unique.map(choice => ({
      id:
        oldReminders.find(item => item.offsetUnit === choice.unit && item.offsetValue === choice.value)?.id ??
        createId(),
      occasionId: occasion.id,
      offsetUnit: choice.unit,
      offsetValue: choice.value,
      hour,
      minute,
      enabled: true,
      createdAt: now,
      updatedAt: now,
    }));
    await this.repositories.adapter.batch([
      { store: 'occasions', operation: 'PUT', value: occasion },
      ...oldReminders
        .filter(old => !reminders.some(item => item.id === old.id))
        .map(old => ({ store: 'occasion_reminders' as const, operation: 'DELETE' as const, id: old.id })),
      ...reminders.map(reminder => ({
        store: 'occasion_reminders' as const,
        operation: 'PUT' as const,
        value: reminder,
      })),
    ]);
    this.occasions.update(items => [...items.filter(item => item.id !== occasion.id), occasion]);
    this.reminders.update(items => [...items.filter(item => item.occasionId !== occasion.id), ...reminders]);
    return occasion;
  }

  async deleteOccasion(id: string, ignoreImported = true): Promise<void> {
    const occasion = this.occasion(id);
    if (!occasion) return;
    const reminderIds = this.remindersFor(id).map(reminder => reminder.id);
    const ignore =
      ignoreImported && occasion.source === 'ANDROID_CONTACT' && occasion.androidEventReference
        ? this.createOccasionIgnore(occasion)
        : undefined;
    await this.repositories.adapter.batch([
      ...reminderIds.map(reminderId => ({
        store: 'occasion_reminders' as const,
        operation: 'DELETE' as const,
        id: reminderId,
      })),
      { store: 'occasions', operation: 'DELETE', id },
      ...(ignore ? [{ store: 'contact_sync_ignores' as const, operation: 'PUT' as const, value: ignore }] : []),
    ]);
    this.occasions.update(items => items.filter(item => item.id !== id));
    this.reminders.update(items => items.filter(item => item.occasionId !== id));
    if (ignore) this.ignores.update(items => [...items, ignore]);
  }

  async deletePerson(id: string): Promise<void> {
    const person = this.person(id);
    if (!person) return;
    const occasions = this.occasionsFor(id);
    const occasionIds = new Set(occasions.map(occasion => occasion.id));
    const reminders = this.reminders().filter(reminder => occasionIds.has(reminder.occasionId));
    const ignore: ContactSyncIgnore | undefined = person.androidContactLookupKey
      ? {
          id: createId(),
          androidContactLookupKey: person.androidContactLookupKey,
          ignoreType: 'CONTACT',
          ignoredAt: new Date().toISOString(),
        }
      : undefined;
    await this.repositories.adapter.batch([
      ...reminders.map(reminder => ({
        store: 'occasion_reminders' as const,
        operation: 'DELETE' as const,
        id: reminder.id,
      })),
      ...occasions.map(occasion => ({ store: 'occasions' as const, operation: 'DELETE' as const, id: occasion.id })),
      { store: 'people', operation: 'DELETE', id },
      ...(ignore ? [{ store: 'contact_sync_ignores' as const, operation: 'PUT' as const, value: ignore }] : []),
    ]);
    this.people.update(items => items.filter(item => item.id !== id));
    this.occasions.update(items => items.filter(item => item.personId !== id));
    this.reminders.update(items => items.filter(item => !occasionIds.has(item.occasionId)));
    if (ignore) this.ignores.update(items => [...items, ignore]);
  }

  async updateSettings(settings: AppSettings): Promise<void> {
    const updated = { ...settings, id: 'settings' as const, updatedAt: new Date().toISOString() };
    await this.repositories.settings.save(updated);
    this.settings.set(updated);
  }

  async unlinkPerson(id: string): Promise<void> {
    const person = this.person(id);
    if (!person) return;
    await this.savePerson({ ...person, source: 'MANUAL', androidContactLookupKey: undefined });
  }

  async allowImportAgain(ignoreId: string): Promise<void> {
    await this.repositories.contactSync.deleteIgnore(ignoreId);
    this.ignores.update(items => items.filter(item => item.id !== ignoreId));
  }

  private createOccasionIgnore(occasion: Occasion): ContactSyncIgnore | undefined {
    const person = this.person(occasion.personId);
    if (!person?.androidContactLookupKey || !occasion.androidEventReference) return undefined;
    return {
      id: createId(),
      androidContactLookupKey: person.androidContactLookupKey,
      androidEventReference: occasion.androidEventReference,
      eventType: occasion.type,
      day: occasion.day,
      month: occasion.month,
      year: occasion.year,
      ignoreType: 'OCCASION',
      ignoredAt: new Date().toISOString(),
    };
  }
}
