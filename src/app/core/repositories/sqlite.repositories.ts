import { SQLiteAdapter } from '../database/sqlite/sqlite.adapter';
import {
  AdapterContactSyncRepository,
  AdapterNotificationScheduleRepository,
  AdapterOccasionsRepository,
  AdapterPeopleRepository,
  AdapterReminderRepository,
  AdapterSettingsRepository,
} from './base.repositories';

export class SQLitePeopleRepository extends AdapterPeopleRepository {
  constructor(adapter: SQLiteAdapter) {
    super(adapter);
  }
}
export class SQLiteOccasionsRepository extends AdapterOccasionsRepository {
  constructor(adapter: SQLiteAdapter) {
    super(adapter);
  }
}
export class SQLiteReminderRepository extends AdapterReminderRepository {
  constructor(adapter: SQLiteAdapter) {
    super(adapter);
  }
}
export class SQLiteSettingsRepository extends AdapterSettingsRepository {
  constructor(adapter: SQLiteAdapter) {
    super(adapter);
  }
}
export class SQLiteContactSyncRepository extends AdapterContactSyncRepository {
  constructor(adapter: SQLiteAdapter) {
    super(adapter);
  }
}
export class SQLiteNotificationScheduleRepository extends AdapterNotificationScheduleRepository {
  constructor(adapter: SQLiteAdapter) {
    super(adapter);
  }
}
