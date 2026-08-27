#!/usr/bin/env node
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const password = process.argv[2];
if (!password || password.length < 8) {
  console.error('Usage: node scripts/create-notification-test-backup.mjs <password-with-at-least-8-characters>');
  process.exit(1);
}

const createdAt = new Date().toISOString();
const now = new Date();
const dates = [1, 2, 3].map(offset => {
  const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset);
  return { day: date.getDate(), month: date.getMonth() + 1, year: date.getFullYear() };
});
const labels = ['Tomorrow Notification Test', 'Day After Tomorrow Test', 'Third Day Notification Test'];
const people = labels.map((name, index) => ({
  id: `notification-test-person-${index + 1}`,
  name,
  source: 'MANUAL',
  favorite: false,
  nameUserModified: false,
  photoSource: 'INITIALS',
  photoUserModified: false,
  contactAvailable: true,
  createdAt,
  updatedAt: createdAt,
}));
const occasions = people.map((person, index) => ({
  id: `notification-test-occasion-${index + 1}`,
  personId: person.id,
  type: 'BIRTHDAY',
  day: dates[index].day,
  month: dates[index].month,
  year: dates[index].year,
  source: 'MANUAL',
  userModified: false,
  reminderMode: 'CUSTOM',
  enabled: true,
  createdAt,
  updatedAt: createdAt,
}));
const reminders = occasions.map((occasion, index) => ({
  id: `notification-test-reminder-${index + 1}`,
  occasionId: occasion.id,
  offsetUnit: 'ON_DAY',
  offsetValue: 0,
  hour: 8,
  minute: 0,
  enabled: true,
  createdAt,
  updatedAt: createdAt,
}));
const payload = {
  format: 'birthday-buddy-backup',
  version: 1,
  createdAt,
  people,
  occasions,
  reminders,
  ignores: [],
  settings: {
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
    updatedAt: createdAt,
  },
};

const iterations = 250_000;
const salt = crypto.getRandomValues(new Uint8Array(16));
const iv = crypto.getRandomValues(new Uint8Array(12));
const material = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, [
  'deriveKey',
]);
const key = await crypto.subtle.deriveKey(
  { name: 'PBKDF2', hash: 'SHA-256', salt, iterations },
  material,
  { name: 'AES-GCM', length: 256 },
  false,
  ['encrypt', 'decrypt'],
);
const ciphertext = await crypto.subtle.encrypt(
  { name: 'AES-GCM', iv },
  key,
  new TextEncoder().encode(JSON.stringify(payload)),
);
const toBase64 = value => Buffer.from(value).toString('base64');
const backup = {
  format: 'birthday-buddy-encrypted-backup',
  version: 1,
  createdAt,
  iterations,
  salt: toBase64(salt),
  iv: toBase64(iv),
  ciphertext: toBase64(new Uint8Array(ciphertext)),
};
const range = dates.map(
  date => `${date.year}-${String(date.month).padStart(2, '0')}-${String(date.day).padStart(2, '0')}`,
);
const filename = `BirthdayBuddy-notification-test-${range[0]}-to-${range[2]}.ocbackup`;
const outputDirectory = path.join(process.cwd(), 'releases');
await mkdir(outputDirectory, { recursive: true });
await writeFile(path.join(outputDirectory, filename), JSON.stringify(backup), 'utf8');
const verifiedPayload = JSON.parse(
  new TextDecoder().decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext)),
);
if (
  verifiedPayload.format !== 'birthday-buddy-backup' ||
  verifiedPayload.people.length !== 3 ||
  verifiedPayload.occasions.length !== 3 ||
  verifiedPayload.reminders.some(reminder => reminder.offsetUnit !== 'ON_DAY')
)
  throw new Error('Generated backup verification failed.');
console.log(`Created ${filename} with on-day reminders at 08:00 for ${range.join(', ')}.`);
