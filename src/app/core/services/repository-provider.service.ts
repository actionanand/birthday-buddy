import { Service } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { IndexedDbAdapter } from '../database/indexeddb/indexed-db.adapter';
import { SQLiteAdapter } from '../database/sqlite/sqlite.adapter';
import {
  ContactSyncRepository,
  DatabaseAdapter,
  NotificationScheduleRepository,
  OccasionsRepository,
  PeopleRepository,
  ReminderRepository,
  SettingsRepository,
} from '../repositories/repository.interfaces';
import {
  IndexedDbContactSyncRepository,
  IndexedDbNotificationScheduleRepository,
  IndexedDbOccasionsRepository,
  IndexedDbPeopleRepository,
  IndexedDbReminderRepository,
  IndexedDbSettingsRepository,
} from '../repositories/indexeddb.repositories';
import {
  SQLiteContactSyncRepository,
  SQLiteNotificationScheduleRepository,
  SQLiteOccasionsRepository,
  SQLitePeopleRepository,
  SQLiteReminderRepository,
  SQLiteSettingsRepository,
} from '../repositories/sqlite.repositories';

@Service()
export class RepositoryProviderService {
  readonly adapter: DatabaseAdapter;
  readonly people: PeopleRepository;
  readonly occasions: OccasionsRepository;
  readonly reminders: ReminderRepository;
  readonly settings: SettingsRepository;
  readonly contactSync: ContactSyncRepository;
  readonly notificationSchedules: NotificationScheduleRepository;

  constructor() {
    if (Capacitor.isNativePlatform()) {
      const adapter = new SQLiteAdapter();
      this.adapter = adapter;
      this.people = new SQLitePeopleRepository(adapter);
      this.occasions = new SQLiteOccasionsRepository(adapter);
      this.reminders = new SQLiteReminderRepository(adapter);
      this.settings = new SQLiteSettingsRepository(adapter);
      this.contactSync = new SQLiteContactSyncRepository(adapter);
      this.notificationSchedules = new SQLiteNotificationScheduleRepository(adapter);
    } else {
      const adapter = new IndexedDbAdapter();
      this.adapter = adapter;
      this.people = new IndexedDbPeopleRepository(adapter);
      this.occasions = new IndexedDbOccasionsRepository(adapter);
      this.reminders = new IndexedDbReminderRepository(adapter);
      this.settings = new IndexedDbSettingsRepository(adapter);
      this.contactSync = new IndexedDbContactSyncRepository(adapter);
      this.notificationSchedules = new IndexedDbNotificationScheduleRepository(adapter);
    }
  }

  initialize(): Promise<void> {
    return this.adapter.initialize();
  }
}
