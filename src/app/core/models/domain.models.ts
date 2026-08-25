export type PersonSource = 'MANUAL' | 'ANDROID_CONTACT';
export type PhotoSource = 'ANDROID_CONTACT' | 'MANUAL' | 'INITIALS';
export type OccasionSource = 'MANUAL' | 'ANDROID_CONTACT';
export type OccasionType =
  | 'BIRTHDAY'
  | 'WEDDING_ANNIVERSARY'
  | 'ENGAGEMENT_ANNIVERSARY'
  | 'WORK_ANNIVERSARY'
  | 'FRIENDSHIP_ANNIVERSARY'
  | 'RELATIONSHIP_ANNIVERSARY'
  | 'REMEMBRANCE'
  | 'CUSTOM';

export interface Person {
  id: string;
  name: string;
  photoPath?: string;
  source: PersonSource;
  androidContactLookupKey?: string;
  favorite: boolean;
  nameUserModified: boolean;
  photoSource: PhotoSource;
  photoUserModified: boolean;
  contactAvailable: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Occasion {
  id: string;
  personId: string;
  type: OccasionType;
  customTypeName?: string;
  day: number;
  month: number;
  year?: number;
  source: OccasionSource;
  androidEventReference?: string;
  userModified: boolean;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export type ReminderOffsetUnit = 'DAY' | 'WEEK' | 'MONTH' | 'ON_DAY';

export interface OccasionReminder {
  id: string;
  occasionId: string;
  offsetUnit: ReminderOffsetUnit;
  offsetValue: number;
  hour: number;
  minute: number;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface NotificationSchedule {
  id: string;
  occasionId: string;
  reminderId: string;
  notificationId: number;
  scheduledAt: string;
  createdAt: string;
}

export type ContactSyncMode = 'MANUAL' | 'APP_OPEN' | 'DAILY';
export type NotificationPrivacy = 'FULL' | 'PERSON_ONLY' | 'PRIVATE';
export type Feb29Policy = 'FEB_28' | 'MAR_1' | 'LEAP_ONLY';
export type ThemePreference = 'SYSTEM' | 'LIGHT' | 'DARK';

export interface AppSettings {
  id: 'settings';
  defaultReminderOffsets: ReminderChoice[];
  defaultReminderHour: number;
  defaultReminderMinute: number;
  notificationPrivacy: NotificationPrivacy;
  feb29Policy: Feb29Policy;
  showAge: boolean;
  contactSyncMode: ContactSyncMode;
  lastContactSyncAt?: string;
  theme: ThemePreference;
  autoLockMinutes: number | null;
  lockOnBackground: boolean;
  updatedAt: string;
}

export interface ReminderChoice {
  unit: ReminderOffsetUnit;
  value: number;
}

export interface ContactSyncIgnore {
  id: string;
  androidContactLookupKey: string;
  androidEventReference?: string;
  eventType?: OccasionType;
  day?: number;
  month?: number;
  year?: number;
  ignoreType: 'CONTACT' | 'OCCASION';
  ignoredAt: string;
}

export interface AndroidContactEvent {
  reference: string;
  type: 'BIRTHDAY' | 'WEDDING_ANNIVERSARY';
  day: number;
  month: number;
  year?: number;
}

export interface AndroidContactSummary {
  lookupKey: string;
  displayName: string;
  photoData?: string;
  events: AndroidContactEvent[];
}

export type SyncCandidateKind = 'NEW_PERSON' | 'NEW_OCCASION' | 'NAME_CHANGE' | 'PHOTO_CHANGE' | 'DATE_CONFLICT';

export interface ContactSyncCandidate {
  id: string;
  kind: SyncCandidateKind;
  contact: AndroidContactSummary;
  personId?: string;
  occasionId?: string;
  event?: AndroidContactEvent;
  selected: boolean;
  resolution: 'KEEP_APP' | 'USE_CONTACT';
}

export const OCCASION_LABELS: Record<OccasionType, string> = {
  BIRTHDAY: 'Birthday',
  WEDDING_ANNIVERSARY: 'Wedding Anniversary',
  ENGAGEMENT_ANNIVERSARY: 'Engagement Anniversary',
  WORK_ANNIVERSARY: 'Work Anniversary',
  FRIENDSHIP_ANNIVERSARY: 'Friendship Anniversary',
  RELATIONSHIP_ANNIVERSARY: 'Relationship Anniversary',
  REMEMBRANCE: 'Memorial / Remembrance Day',
  CUSTOM: 'Custom Occasion',
};

export const REMINDER_PRESETS: ReadonlyArray<{ label: string; choice: ReminderChoice }> = [
  { label: '1 month before', choice: { unit: 'MONTH', value: 1 } },
  { label: '2 weeks before', choice: { unit: 'WEEK', value: 2 } },
  { label: '1 week before', choice: { unit: 'WEEK', value: 1 } },
  { label: '5 days before', choice: { unit: 'DAY', value: 5 } },
  { label: '3 days before', choice: { unit: 'DAY', value: 3 } },
  { label: '2 days before', choice: { unit: 'DAY', value: 2 } },
  { label: '1 day before', choice: { unit: 'DAY', value: 1 } },
  { label: 'On the day', choice: { unit: 'ON_DAY', value: 0 } },
];

export const DEFAULT_SETTINGS: AppSettings = {
  id: 'settings',
  defaultReminderOffsets: [
    { unit: 'WEEK', value: 1 },
    { unit: 'DAY', value: 3 },
    { unit: 'DAY', value: 1 },
    { unit: 'ON_DAY', value: 0 },
  ],
  defaultReminderHour: 8,
  defaultReminderMinute: 0,
  notificationPrivacy: 'FULL',
  feb29Policy: 'FEB_28',
  showAge: true,
  contactSyncMode: 'MANUAL',
  theme: 'SYSTEM',
  autoLockMinutes: 5,
  lockOnBackground: true,
  updatedAt: new Date(0).toISOString(),
};
