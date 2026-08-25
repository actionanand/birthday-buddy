import {
  AppSettings,
  ContactSyncIgnore,
  NotificationSchedule,
  Occasion,
  OccasionReminder,
  Person,
} from '../models/domain.models';
import {
  ContactSyncRepository,
  DatabaseAdapter,
  NotificationScheduleRepository,
  OccasionsRepository,
  PeopleRepository,
  ReminderRepository,
  SettingsRepository,
} from './repository.interfaces';

export class AdapterPeopleRepository implements PeopleRepository {
  constructor(protected readonly adapter: DatabaseAdapter) {}
  list(): Promise<Person[]> {
    return this.adapter.getAll<Person>('people');
  }
  get(id: string): Promise<Person | undefined> {
    return this.adapter.get<Person>('people', id);
  }
  save(person: Person): Promise<void> {
    return this.adapter.put('people', person);
  }
  delete(id: string): Promise<void> {
    return this.adapter.delete('people', id);
  }
}

export class AdapterOccasionsRepository implements OccasionsRepository {
  constructor(protected readonly adapter: DatabaseAdapter) {}
  list(): Promise<Occasion[]> {
    return this.adapter.getAll<Occasion>('occasions');
  }
  async forPerson(personId: string): Promise<Occasion[]> {
    return (await this.list()).filter(occasion => occasion.personId === personId);
  }
  get(id: string): Promise<Occasion | undefined> {
    return this.adapter.get<Occasion>('occasions', id);
  }
  save(occasion: Occasion): Promise<void> {
    return this.adapter.put('occasions', occasion);
  }
  delete(id: string): Promise<void> {
    return this.adapter.delete('occasions', id);
  }
}

export class AdapterReminderRepository implements ReminderRepository {
  constructor(protected readonly adapter: DatabaseAdapter) {}
  list(): Promise<OccasionReminder[]> {
    return this.adapter.getAll<OccasionReminder>('occasion_reminders');
  }
  async forOccasion(occasionId: string): Promise<OccasionReminder[]> {
    return (await this.list()).filter(reminder => reminder.occasionId === occasionId);
  }
  save(reminder: OccasionReminder): Promise<void> {
    return this.adapter.put('occasion_reminders', reminder);
  }
  delete(id: string): Promise<void> {
    return this.adapter.delete('occasion_reminders', id);
  }
}

export class AdapterSettingsRepository implements SettingsRepository {
  constructor(protected readonly adapter: DatabaseAdapter) {}
  get(): Promise<AppSettings | undefined> {
    return this.adapter.get<AppSettings>('app_settings', 'settings');
  }
  save(settings: AppSettings): Promise<void> {
    return this.adapter.put('app_settings', settings);
  }
}

export class AdapterContactSyncRepository implements ContactSyncRepository {
  constructor(protected readonly adapter: DatabaseAdapter) {}
  listIgnores(): Promise<ContactSyncIgnore[]> {
    return this.adapter.getAll<ContactSyncIgnore>('contact_sync_ignores');
  }
  saveIgnore(ignore: ContactSyncIgnore): Promise<void> {
    return this.adapter.put('contact_sync_ignores', ignore);
  }
  deleteIgnore(id: string): Promise<void> {
    return this.adapter.delete('contact_sync_ignores', id);
  }
}

export class AdapterNotificationScheduleRepository implements NotificationScheduleRepository {
  constructor(protected readonly adapter: DatabaseAdapter) {}
  list(): Promise<NotificationSchedule[]> {
    return this.adapter.getAll<NotificationSchedule>('notification_schedule');
  }
  async forOccasion(occasionId: string): Promise<NotificationSchedule[]> {
    return (await this.list()).filter(schedule => schedule.occasionId === occasionId);
  }
  async replaceForOccasion(occasionId: string, schedules: NotificationSchedule[]): Promise<void> {
    const old = await this.forOccasion(occasionId);
    await this.adapter.batch([
      ...old.map(schedule => ({
        store: 'notification_schedule' as const,
        operation: 'DELETE' as const,
        id: schedule.id,
      })),
      ...schedules.map(schedule => ({
        store: 'notification_schedule' as const,
        operation: 'PUT' as const,
        value: schedule,
      })),
    ]);
  }
}
