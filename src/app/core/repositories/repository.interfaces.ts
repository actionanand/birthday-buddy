import {
  AppSettings,
  ContactSyncIgnore,
  NotificationSchedule,
  Occasion,
  OccasionReminder,
  Person,
} from '../models/domain.models';

export type StoreName =
  'people' | 'occasions' | 'occasion_reminders' | 'notification_schedule' | 'contact_sync_ignores' | 'app_settings';

export interface EntityWithId {
  id: string;
}

export interface StorageMutation {
  store: StoreName;
  operation: 'PUT' | 'DELETE';
  value?: EntityWithId;
  id?: string;
}

export interface DatabaseAdapter {
  initialize(): Promise<void>;
  getAll<T extends EntityWithId>(store: StoreName): Promise<T[]>;
  get<T extends EntityWithId>(store: StoreName, id: string): Promise<T | undefined>;
  put<T extends EntityWithId>(store: StoreName, value: T): Promise<void>;
  delete(store: StoreName, id: string): Promise<void>;
  batch(mutations: StorageMutation[]): Promise<void>;
  clear(stores: StoreName[]): Promise<void>;
}

export interface PeopleRepository {
  list(): Promise<Person[]>;
  get(id: string): Promise<Person | undefined>;
  save(person: Person): Promise<void>;
  delete(id: string): Promise<void>;
}

export interface OccasionsRepository {
  list(): Promise<Occasion[]>;
  forPerson(personId: string): Promise<Occasion[]>;
  get(id: string): Promise<Occasion | undefined>;
  save(occasion: Occasion): Promise<void>;
  delete(id: string): Promise<void>;
}

export interface ReminderRepository {
  list(): Promise<OccasionReminder[]>;
  forOccasion(occasionId: string): Promise<OccasionReminder[]>;
  save(reminder: OccasionReminder): Promise<void>;
  delete(id: string): Promise<void>;
}

export interface SettingsRepository {
  get(): Promise<AppSettings | undefined>;
  save(settings: AppSettings): Promise<void>;
}

export interface ContactSyncRepository {
  listIgnores(): Promise<ContactSyncIgnore[]>;
  saveIgnore(ignore: ContactSyncIgnore): Promise<void>;
  deleteIgnore(id: string): Promise<void>;
}

export interface NotificationScheduleRepository {
  list(): Promise<NotificationSchedule[]>;
  forOccasion(occasionId: string): Promise<NotificationSchedule[]>;
  replaceForOccasion(occasionId: string, schedules: NotificationSchedule[]): Promise<void>;
}
