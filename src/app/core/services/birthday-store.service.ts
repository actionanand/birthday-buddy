import { Service, computed, inject, signal } from '@angular/core';
import {
  AppSettings,
  ContactSyncIgnore,
  DEFAULT_SETTINGS,
  Occasion,
  OccasionReminder,
  Person,
  ReminderChoice,
  TRASH_RETENTION_DAYS,
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

  readonly activePeople = computed(() => this.people().filter(person => !person.trashedAt));
  readonly trashedPeople = computed(() => this.people().filter(person => Boolean(person.trashedAt)));
  readonly activeOccasions = computed(() => this.occasions().filter(occasion => !occasion.trashedAt));
  readonly trashedOccasions = computed(() => this.occasions().filter(occasion => Boolean(occasion.trashedAt)));
  readonly trashCount = computed(() => {
    const trashedPersonIds = new Set(this.trashedPeople().map(person => person.id));
    return (
      this.trashedPeople().length +
      this.trashedOccasions().filter(occasion => !trashedPersonIds.has(occasion.personId)).length
    );
  });
  readonly favorites = computed(() => this.activePeople().filter(person => person.favorite));
  readonly enabledOccasions = computed(() => this.activeOccasions().filter(occasion => occasion.enabled));
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
    await this.migrateLegacyReminderModes();
    await this.purgeExpiredTrash();
    this.loading.set(false);
    this.ready.set(true);
  }

  person(id: string): Person | undefined {
    return this.people().find(person => person.id === id);
  }
  occasion(id: string): Occasion | undefined {
    return this.occasions().find(occasion => occasion.id === id);
  }
  occasionsFor(personId: string, includeTrashed = false): Occasion[] {
    return this.occasions().filter(
      occasion => occasion.personId === personId && (includeTrashed || !occasion.trashedAt),
    );
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
      trashedAt: 'trashedAt' in input ? input.trashedAt : existing?.trashedAt,
      deleteAfter: 'deleteAfter' in input ? input.deleteAfter : existing?.deleteAfter,
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
    const reminderMode = input.reminderMode ?? existing?.reminderMode ?? 'DEFAULT';
    const occasion: Occasion = {
      ...input,
      id: existing?.id ?? createId(),
      reminderMode,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
    const oldReminders = existing ? this.remindersFor(existing.id) : [];
    const reminders = this.buildReminders(
      occasion.id,
      reminderMode === 'DEFAULT' ? this.settings().defaultReminderOffsets : choices,
      reminderMode === 'DEFAULT' ? this.settings().defaultReminderHour : hour,
      reminderMode === 'DEFAULT' ? this.settings().defaultReminderMinute : minute,
      oldReminders,
      now,
    );
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
    if (!occasion || occasion.trashedAt) return;
    const trashedAt = new Date().toISOString();
    const trashed: Occasion = {
      ...occasion,
      enabledBeforeTrash: occasion.enabled,
      enabled: false,
      trashedAt,
      deleteAfter: this.deleteAfter(trashedAt),
      updatedAt: trashedAt,
    };
    const ignore =
      ignoreImported && occasion.source === 'ANDROID_CONTACT' && occasion.androidEventReference
        ? this.createOccasionIgnore(occasion)
        : undefined;
    await this.repositories.adapter.batch([
      { store: 'occasions', operation: 'PUT', value: trashed },
      ...(ignore ? [{ store: 'contact_sync_ignores' as const, operation: 'PUT' as const, value: ignore }] : []),
    ]);
    this.occasions.update(items => [...items.filter(item => item.id !== id), trashed]);
    if (ignore) this.ignores.update(items => [...items, ignore]);
  }

  async deletePerson(id: string): Promise<void> {
    const person = this.person(id);
    if (!person || person.trashedAt) return;
    const trashedAt = new Date().toISOString();
    const trashedPerson: Person = {
      ...person,
      trashedAt,
      deleteAfter: this.deleteAfter(trashedAt),
      updatedAt: trashedAt,
    };
    const occasions = this.occasionsFor(id, true).map<Occasion>(occasion => ({
      ...occasion,
      ...(occasion.trashedAt
        ? {}
        : {
            enabledBeforeTrash: occasion.enabled,
            enabled: false,
            trashedAt,
            deleteAfter: this.deleteAfter(trashedAt),
            trashedWithPerson: true,
            updatedAt: trashedAt,
          }),
    }));
    const ignore = this.createContactIgnore(person);
    await this.repositories.adapter.batch([
      { store: 'people', operation: 'PUT', value: trashedPerson },
      ...occasions.map(value => ({ store: 'occasions' as const, operation: 'PUT' as const, value })),
      ...(ignore ? [{ store: 'contact_sync_ignores' as const, operation: 'PUT' as const, value: ignore }] : []),
    ]);
    this.people.update(items => [...items.filter(item => item.id !== id), trashedPerson]);
    this.occasions.update(items => [...items.filter(item => item.personId !== id), ...occasions]);
    if (ignore) this.ignores.update(items => [...items, ignore]);
  }

  async restoreOccasion(id: string): Promise<void> {
    const occasion = this.occasion(id);
    if (!occasion?.trashedAt || this.person(occasion.personId)?.trashedAt) return;
    const restored: Occasion = {
      ...occasion,
      enabled: occasion.enabledBeforeTrash ?? true,
      enabledBeforeTrash: undefined,
      trashedAt: undefined,
      deleteAfter: undefined,
      trashedWithPerson: undefined,
      updatedAt: new Date().toISOString(),
    };
    const ignoreIds = this.occasionIgnoreIds(occasion);
    await this.repositories.adapter.batch([
      { store: 'occasions', operation: 'PUT', value: restored },
      ...ignoreIds.map(ignoreId => ({
        store: 'contact_sync_ignores' as const,
        operation: 'DELETE' as const,
        id: ignoreId,
      })),
    ]);
    this.occasions.update(items => [...items.filter(item => item.id !== id), restored]);
    this.removeIgnores(ignoreIds);
  }

  async restorePerson(id: string): Promise<void> {
    const person = this.person(id);
    if (!person?.trashedAt) return;
    const now = new Date().toISOString();
    const restoredPerson: Person = { ...person, trashedAt: undefined, deleteAfter: undefined, updatedAt: now };
    const restoredOccasions = this.occasionsFor(id, true).map<Occasion>(occasion =>
      occasion.trashedWithPerson
        ? {
            ...occasion,
            enabled: occasion.enabledBeforeTrash ?? true,
            enabledBeforeTrash: undefined,
            trashedAt: undefined,
            deleteAfter: undefined,
            trashedWithPerson: undefined,
            updatedAt: now,
          }
        : occasion,
    );
    const ignoreIds = [
      ...this.ignores()
        .filter(
          ignore =>
            ignore.ignoreType === 'CONTACT' && ignore.androidContactLookupKey === person.androidContactLookupKey,
        )
        .map(ignore => ignore.id),
      ...restoredOccasions.flatMap(occasion => this.occasionIgnoreIds(occasion)),
    ];
    await this.repositories.adapter.batch([
      { store: 'people', operation: 'PUT', value: restoredPerson },
      ...restoredOccasions.map(value => ({ store: 'occasions' as const, operation: 'PUT' as const, value })),
      ...[...new Set(ignoreIds)].map(ignoreId => ({
        store: 'contact_sync_ignores' as const,
        operation: 'DELETE' as const,
        id: ignoreId,
      })),
    ]);
    this.people.update(items => [...items.filter(item => item.id !== id), restoredPerson]);
    this.occasions.update(items => [...items.filter(item => item.personId !== id), ...restoredOccasions]);
    this.removeIgnores(ignoreIds);
  }

  async permanentlyDeleteOccasion(id: string): Promise<void> {
    const occasion = this.occasion(id);
    if (!occasion) return;
    const reminderIds = this.remindersFor(id).map(reminder => reminder.id);
    await this.repositories.adapter.batch([
      ...reminderIds.map(reminderId => ({
        store: 'occasion_reminders' as const,
        operation: 'DELETE' as const,
        id: reminderId,
      })),
      { store: 'occasions', operation: 'DELETE', id },
    ]);
    this.occasions.update(items => items.filter(item => item.id !== id));
    this.reminders.update(items => items.filter(item => item.occasionId !== id));
  }

  async permanentlyDeletePerson(id: string): Promise<void> {
    const person = this.person(id);
    if (!person) return;
    const occasions = this.occasionsFor(id, true);
    const occasionIds = new Set(occasions.map(occasion => occasion.id));
    const reminders = this.reminders().filter(reminder => occasionIds.has(reminder.occasionId));
    await this.repositories.adapter.batch([
      ...reminders.map(reminder => ({
        store: 'occasion_reminders' as const,
        operation: 'DELETE' as const,
        id: reminder.id,
      })),
      ...occasions.map(occasion => ({ store: 'occasions' as const, operation: 'DELETE' as const, id: occasion.id })),
      { store: 'people', operation: 'DELETE', id },
    ]);
    this.people.update(items => items.filter(item => item.id !== id));
    this.occasions.update(items => items.filter(item => item.personId !== id));
    this.reminders.update(items => items.filter(item => !occasionIds.has(item.occasionId)));
  }

  async emptyTrash(): Promise<void> {
    for (const person of [...this.trashedPeople()]) await this.permanentlyDeletePerson(person.id);
    for (const occasion of [...this.trashedOccasions()]) await this.permanentlyDeleteOccasion(occasion.id);
  }

  async purgeExpiredTrash(now = new Date()): Promise<void> {
    const expiredPeople = this.trashedPeople().filter(person => this.isTrashExpired(person.deleteAfter, now));
    for (const person of expiredPeople) await this.permanentlyDeletePerson(person.id);
    const expiredOccasions = this.trashedOccasions().filter(occasion => this.isTrashExpired(occasion.deleteAfter, now));
    for (const occasion of expiredOccasions) await this.permanentlyDeleteOccasion(occasion.id);
  }

  async updateSettings(settings: AppSettings): Promise<void> {
    const updated = { ...settings, id: 'settings' as const, updatedAt: new Date().toISOString() };
    const previous = this.settings();
    const defaultsChanged =
      previous.defaultReminderHour !== updated.defaultReminderHour ||
      previous.defaultReminderMinute !== updated.defaultReminderMinute ||
      this.reminderChoiceSignature(previous.defaultReminderOffsets) !==
        this.reminderChoiceSignature(updated.defaultReminderOffsets);
    if (!defaultsChanged) {
      await this.repositories.settings.save(updated);
      this.settings.set(updated);
      return;
    }
    const inheritedOccasions = this.occasions().filter(occasion => occasion.reminderMode === 'DEFAULT');
    const inheritedIds = new Set(inheritedOccasions.map(occasion => occasion.id));
    const now = new Date().toISOString();
    const reminders = inheritedOccasions.flatMap(occasion =>
      this.buildReminders(
        occasion.id,
        updated.defaultReminderOffsets,
        updated.defaultReminderHour,
        updated.defaultReminderMinute,
        this.remindersFor(occasion.id),
        now,
      ),
    );
    await this.repositories.adapter.batch([
      { store: 'app_settings', operation: 'PUT', value: updated },
      ...this.reminders()
        .filter(reminder => inheritedIds.has(reminder.occasionId))
        .filter(old => !reminders.some(reminder => reminder.id === old.id))
        .map(old => ({ store: 'occasion_reminders' as const, operation: 'DELETE' as const, id: old.id })),
      ...reminders.map(value => ({ store: 'occasion_reminders' as const, operation: 'PUT' as const, value })),
    ]);
    this.settings.set(updated);
    this.reminders.update(items => [...items.filter(reminder => !inheritedIds.has(reminder.occasionId)), ...reminders]);
  }

  async unlinkPerson(id: string): Promise<void> {
    const person = this.person(id);
    if (!person) return;
    await this.savePerson({
      ...person,
      source: 'MANUAL',
      androidContactLookupKey: undefined,
      contactAvailable: true,
    });
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

  private createContactIgnore(person: Person): ContactSyncIgnore | undefined {
    if (!person.androidContactLookupKey) return undefined;
    if (
      this.ignores().some(
        ignore => ignore.ignoreType === 'CONTACT' && ignore.androidContactLookupKey === person.androidContactLookupKey,
      )
    )
      return undefined;
    return {
      id: createId(),
      androidContactLookupKey: person.androidContactLookupKey,
      ignoreType: 'CONTACT',
      ignoredAt: new Date().toISOString(),
    };
  }

  private occasionIgnoreIds(occasion: Occasion): string[] {
    const person = this.person(occasion.personId);
    if (!person?.androidContactLookupKey || !occasion.androidEventReference) return [];
    return this.ignores()
      .filter(
        ignore =>
          ignore.ignoreType === 'OCCASION' &&
          ignore.androidContactLookupKey === person.androidContactLookupKey &&
          ignore.androidEventReference === occasion.androidEventReference,
      )
      .map(ignore => ignore.id);
  }

  private removeIgnores(ids: string[]): void {
    const idSet = new Set(ids);
    this.ignores.update(items => items.filter(item => !idSet.has(item.id)));
  }

  private async migrateLegacyReminderModes(): Promise<void> {
    const legacy = this.occasions().filter(occasion => occasion.reminderMode === undefined);
    if (legacy.length === 0) return;
    const normalized = legacy.map<Occasion>(occasion => ({
      ...occasion,
      reminderMode: this.remindersMatchDefaults(occasion.id) ? 'DEFAULT' : 'CUSTOM',
    }));
    await this.repositories.adapter.batch(
      normalized.map(value => ({ store: 'occasions' as const, operation: 'PUT' as const, value })),
    );
    const normalizedById = new Map(normalized.map(occasion => [occasion.id, occasion]));
    this.occasions.update(items => items.map(occasion => normalizedById.get(occasion.id) ?? occasion));
  }

  private remindersMatchDefaults(occasionId: string): boolean {
    const reminders = this.remindersFor(occasionId);
    const settings = this.settings();
    if (reminders.length !== new Set(settings.defaultReminderOffsets.map(choice => this.reminderKey(choice))).size)
      return false;
    const defaults = new Set(settings.defaultReminderOffsets.map(choice => this.reminderKey(choice)));
    return reminders.every(
      reminder =>
        reminder.enabled &&
        reminder.hour === settings.defaultReminderHour &&
        reminder.minute === settings.defaultReminderMinute &&
        defaults.has(this.reminderKey(reminder)),
    );
  }

  private buildReminders(
    occasionId: string,
    choices: ReminderChoice[],
    hour: number,
    minute: number,
    existing: OccasionReminder[],
    now: string,
  ): OccasionReminder[] {
    const unique = [...new Map(choices.map(choice => [this.reminderKey(choice), choice])).values()];
    return unique.map(choice => {
      const old = existing.find(
        reminder => reminder.offsetUnit === choice.unit && reminder.offsetValue === choice.value,
      );
      return {
        id: old?.id ?? createId(),
        occasionId,
        offsetUnit: choice.unit,
        offsetValue: choice.value,
        hour,
        minute,
        enabled: true,
        createdAt: old?.createdAt ?? now,
        updatedAt: now,
      };
    });
  }

  private reminderChoiceSignature(choices: ReminderChoice[]): string {
    return [...new Set(choices.map(choice => this.reminderKey(choice)))].sort().join('|');
  }

  private reminderKey(choice: ReminderChoice | OccasionReminder): string {
    return 'unit' in choice ? `${choice.unit}:${choice.value}` : `${choice.offsetUnit}:${choice.offsetValue}`;
  }

  private deleteAfter(trashedAt: string): string {
    return new Date(new Date(trashedAt).getTime() + TRASH_RETENTION_DAYS * 86_400_000).toISOString();
  }

  private isTrashExpired(deleteAfter: string | undefined, now: Date): boolean {
    return Boolean(deleteAfter && new Date(deleteAfter).getTime() <= now.getTime());
  }
}
