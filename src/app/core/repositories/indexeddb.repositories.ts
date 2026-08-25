import { IndexedDbAdapter } from '../database/indexeddb/indexed-db.adapter';
import {
  AdapterContactSyncRepository,
  AdapterNotificationScheduleRepository,
  AdapterOccasionsRepository,
  AdapterPeopleRepository,
  AdapterReminderRepository,
  AdapterSettingsRepository,
} from './base.repositories';

export class IndexedDbPeopleRepository extends AdapterPeopleRepository {
  constructor(adapter: IndexedDbAdapter) {
    super(adapter);
  }
}
export class IndexedDbOccasionsRepository extends AdapterOccasionsRepository {
  constructor(adapter: IndexedDbAdapter) {
    super(adapter);
  }
}
export class IndexedDbReminderRepository extends AdapterReminderRepository {
  constructor(adapter: IndexedDbAdapter) {
    super(adapter);
  }
}
export class IndexedDbSettingsRepository extends AdapterSettingsRepository {
  constructor(adapter: IndexedDbAdapter) {
    super(adapter);
  }
}
export class IndexedDbContactSyncRepository extends AdapterContactSyncRepository {
  constructor(adapter: IndexedDbAdapter) {
    super(adapter);
  }
}
export class IndexedDbNotificationScheduleRepository extends AdapterNotificationScheduleRepository {
  constructor(adapter: IndexedDbAdapter) {
    super(adapter);
  }
}
