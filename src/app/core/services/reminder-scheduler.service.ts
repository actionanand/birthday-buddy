import { Service, inject } from '@angular/core';
import { Capacitor, registerPlugin } from '@capacitor/core';
import { LocalNotifications, LocalNotificationSchema } from '@capacitor/local-notifications';
import { NotificationPrivacy, OCCASION_LABELS, Occasion, OccasionReminder, Person } from '../models/domain.models';
import { createId, stableNotificationId } from '../utils/id';
import { BirthdayStoreService } from './birthday-store.service';
import { OccasionDateService } from './occasion-date.service';
import { RepositoryProviderService } from './repository-provider.service';

interface NativeNotificationPermissionPlugin {
  permissionStatus(): Promise<{ granted: boolean }>;
  requestPermission(): Promise<{ granted: boolean }>;
}

interface NativeReminderOptions {
  id: number;
  title: string;
  body: string;
  atMillis: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  occasionId: string;
  personId: string;
}

interface NativeReminderPlugin {
  scheduleReminder(options: NativeReminderOptions): Promise<void>;
  cancelReminders(options: { ids: number[] }): Promise<void>;
}

const NativeNotificationPermission = registerPlugin<NativeNotificationPermissionPlugin>(
  'BirthdayBuddyNotificationPermission',
);
const NativeReminder = registerPlugin<NativeReminderPlugin>('BirthdayBuddyReminder');

@Service()
export class ReminderSchedulerService {
  private readonly channelId = 'occasion-reminders';
  private readonly store = inject(BirthdayStoreService);
  private readonly dates = inject(OccasionDateService);
  private readonly repositories = inject(RepositoryProviderService);

  async notificationPermissionGranted(): Promise<boolean> {
    if (!Capacitor.isNativePlatform()) return true;
    return this.notificationPermission(false);
  }

  async requestNotificationPermission(): Promise<boolean> {
    if (!Capacitor.isNativePlatform()) return true;
    await this.ensureAndroidChannel();
    const granted = await this.notificationPermission(true);
    if (granted) await this.reconcileAll(false);
    return granted;
  }

  async reconcileAll(requestPermission = false): Promise<'scheduled' | 'denied' | 'web'> {
    if (!Capacitor.isNativePlatform()) return 'web';
    await this.ensureAndroidChannel();
    const active = this.store
      .enabledOccasions()
      .filter(
        occasion =>
          this.store.remindersFor(occasion.id).some(reminder => reminder.enabled) ||
          (occasion.type === 'BIRTHDAY' && Boolean(occasion.birthdayEveReminderTime)),
      );
    const activeIds = new Set(active.map(occasion => occasion.id));
    const staleSchedules = (await this.repositories.notificationSchedules.list()).filter(
      schedule => !activeIds.has(schedule.occasionId),
    );
    if (staleSchedules.length) {
      await this.cancelNotificationIds(staleSchedules.map(schedule => schedule.notificationId));
      for (const occasionId of new Set(staleSchedules.map(schedule => schedule.occasionId)))
        await this.repositories.notificationSchedules.replaceForOccasion(occasionId, []);
    }
    if (active.length === 0) return 'scheduled';
    if (!(await this.notificationPermission(requestPermission))) return 'denied';
    for (const occasion of active) await this.rescheduleOccasion(occasion.id, false);
    return 'scheduled';
  }

  async rescheduleOccasion(occasionId: string, requestPermission = true): Promise<'scheduled' | 'denied' | 'web'> {
    if (!Capacitor.isNativePlatform()) return 'web';
    await this.ensureAndroidChannel();
    const occasion = this.store.occasion(occasionId);
    const person = occasion ? this.store.person(occasion.personId) : undefined;
    if (!occasion || !person) return 'scheduled';
    const reminders = this.store.remindersFor(occasionId).filter(reminder => reminder.enabled);
    const birthdayEveTime = occasion.type === 'BIRTHDAY' ? occasion.birthdayEveReminderTime : undefined;
    const existing = await this.repositories.notificationSchedules.forOccasion(occasionId);
    if (existing.length) await this.cancelNotificationIds(existing.map(item => item.notificationId));
    if (!occasion.enabled || (reminders.length === 0 && !birthdayEveTime)) {
      await this.repositories.notificationSchedules.replaceForOccasion(occasionId, []);
      return 'scheduled';
    }
    if (!(await this.notificationPermission(requestPermission))) return 'denied';
    const occurrence = this.dates.nextOccurrence(occasion, this.store.settings().feb29Policy);
    if (!occurrence) return 'scheduled';
    const notifications: LocalNotificationSchema[] = [];
    const nativeReminders: NativeReminderOptions[] = [];
    const schedules = [];
    for (const reminder of reminders) {
      const scheduledAt = this.subtractOffset(occurrence, reminder);
      scheduledAt.setHours(reminder.hour, reminder.minute, 0, 0);
      const nextFire = this.nextAnnualFire(scheduledAt);
      const notificationId = stableNotificationId(reminder.id);
      const message = this.notificationText(person, occasion, reminder, this.store.settings().notificationPrivacy);
      notifications.push({
        id: notificationId,
        title: message.title,
        body: message.body,
        smallIcon: 'ic_stat_birthday_buddy',
        iconColor: '#397153',
        channelId: Capacitor.getPlatform() === 'android' ? this.channelId : undefined,
        autoCancel: true,
        foreground: true,
        isExactNotification: false,
        schedule: {
          on: {
            month: scheduledAt.getMonth() + 1,
            day: scheduledAt.getDate(),
            hour: reminder.hour,
            minute: reminder.minute,
            second: 0,
          },
          allowWhileIdle: true,
        },
        extra: { occasionId, personId: person.id },
      });
      nativeReminders.push({
        id: notificationId,
        title: message.title,
        body: message.body,
        atMillis: nextFire.getTime(),
        month: nextFire.getMonth() + 1,
        day: nextFire.getDate(),
        hour: nextFire.getHours(),
        minute: nextFire.getMinutes(),
        occasionId,
        personId: person.id,
      });
      schedules.push({
        id: createId(),
        occasionId,
        reminderId: reminder.id,
        notificationId,
        scheduledAt: nextFire.toISOString(),
        createdAt: new Date().toISOString(),
      });
    }
    if (birthdayEveTime) {
      const [hour, minute] = birthdayEveTime.split(':').map(Number);
      const scheduledAt = new Date(occurrence);
      scheduledAt.setDate(scheduledAt.getDate() - 1);
      scheduledAt.setHours(hour, minute, 0, 0);
      const reminderId = `birthday-eve:${occasion.id}`;
      const notificationId = stableNotificationId(reminderId);
      const nextFire = this.nextAnnualFire(scheduledAt);
      const message = this.birthdayEveNotificationText(
        person,
        birthdayEveTime,
        this.store.settings().notificationPrivacy,
      );
      notifications.push({
        id: notificationId,
        title: message.title,
        body: message.body,
        smallIcon: 'ic_stat_birthday_buddy',
        iconColor: '#397153',
        channelId: Capacitor.getPlatform() === 'android' ? this.channelId : undefined,
        autoCancel: true,
        foreground: true,
        isExactNotification: false,
        schedule: {
          on: {
            month: scheduledAt.getMonth() + 1,
            day: scheduledAt.getDate(),
            hour,
            minute,
            second: 0,
          },
          allowWhileIdle: true,
        },
        extra: { occasionId, personId: person.id, birthdayEve: true },
      });
      nativeReminders.push({
        id: notificationId,
        title: message.title,
        body: message.body,
        atMillis: nextFire.getTime(),
        month: nextFire.getMonth() + 1,
        day: nextFire.getDate(),
        hour: nextFire.getHours(),
        minute: nextFire.getMinutes(),
        occasionId,
        personId: person.id,
      });
      schedules.push({
        id: createId(),
        occasionId,
        reminderId,
        notificationId,
        scheduledAt: nextFire.toISOString(),
        createdAt: new Date().toISOString(),
      });
    }
    if (Capacitor.getPlatform() === 'android') {
      for (const reminder of nativeReminders) await NativeReminder.scheduleReminder(reminder);
    } else if (notifications.length) {
      await LocalNotifications.schedule({ notifications });
    }
    await this.repositories.notificationSchedules.replaceForOccasion(occasionId, schedules);
    return 'scheduled';
  }

  async cancelOccasion(occasionId: string): Promise<void> {
    if (!Capacitor.isNativePlatform()) return;
    const schedules = await this.repositories.notificationSchedules.forOccasion(occasionId);
    if (schedules.length) await this.cancelNotificationIds(schedules.map(item => item.notificationId));
    await this.repositories.notificationSchedules.replaceForOccasion(occasionId, []);
  }

  private subtractOffset(occurrence: Date, reminder: OccasionReminder): Date {
    const result = new Date(occurrence);
    if (reminder.offsetUnit === 'DAY') result.setDate(result.getDate() - reminder.offsetValue);
    if (reminder.offsetUnit === 'WEEK') result.setDate(result.getDate() - reminder.offsetValue * 7);
    if (reminder.offsetUnit === 'MONTH') {
      const day = result.getDate();
      result.setDate(1);
      result.setMonth(result.getMonth() - reminder.offsetValue);
      result.setDate(Math.min(day, new Date(result.getFullYear(), result.getMonth() + 1, 0).getDate()));
    }
    return result;
  }

  private async ensureAndroidChannel(): Promise<void> {
    if (Capacitor.getPlatform() !== 'android') return;
    await LocalNotifications.createChannel({
      id: this.channelId,
      name: 'Occasion reminders',
      description: 'Birthday, anniversary, and occasion reminders',
      importance: 3,
      visibility: 0,
      lights: true,
      lightColor: '#397153',
      vibration: true,
    });
  }

  private async cancelNotificationIds(ids: number[]): Promise<void> {
    if (ids.length === 0) return;
    if (Capacitor.getPlatform() === 'android') {
      await NativeReminder.cancelReminders({ ids });
      // Remove alarms created by releases that used Capacitor Local Notifications.
      // This can be removed after all supported installs have migrated.
      try {
        await LocalNotifications.cancel({ notifications: ids.map(id => ({ id })) });
      } catch {
        // The native AlarmManager cancellation above is the authoritative path.
      }
      return;
    }
    await LocalNotifications.cancel({ notifications: ids.map(id => ({ id })) });
  }

  private async notificationPermission(request: boolean): Promise<boolean> {
    if (Capacitor.getPlatform() === 'android') {
      const result = request
        ? await NativeNotificationPermission.requestPermission()
        : await NativeNotificationPermission.permissionStatus();
      return result.granted;
    }
    const result = request
      ? await LocalNotifications.requestPermissions()
      : await LocalNotifications.checkPermissions();
    return result.display === 'granted';
  }

  private nextAnnualFire(scheduledAt: Date): Date {
    const next = new Date(scheduledAt);
    while (next.getTime() <= Date.now()) {
      const month = next.getMonth();
      const day = next.getDate();
      let year = next.getFullYear() + 1;
      let candidate = new Date(year, month, day, next.getHours(), next.getMinutes(), 0, 0);
      while (candidate.getMonth() !== month || candidate.getDate() !== day) {
        year += 1;
        candidate = new Date(year, month, day, next.getHours(), next.getMinutes(), 0, 0);
      }
      next.setTime(candidate.getTime());
    }
    return next;
  }

  private notificationText(
    person: Person,
    occasion: Occasion,
    reminder: OccasionReminder,
    privacy: NotificationPrivacy,
  ): { title: string; body: string } {
    const onDay = reminder.offsetUnit === 'ON_DAY';
    const totalDays =
      reminder.offsetUnit === 'WEEK'
        ? reminder.offsetValue * 7
        : reminder.offsetUnit === 'DAY'
          ? reminder.offsetValue
          : undefined;
    const relation = onDay
      ? 'today'
      : totalDays === 1
        ? 'tomorrow'
        : totalDays
          ? `in ${totalDays} days`
          : `in ${reminder.offsetValue} month${reminder.offsetValue === 1 ? '' : 's'}`;
    if (privacy === 'PRIVATE')
      return {
        title: onDay ? 'Important occasion today' : 'Upcoming occasion',
        body: `You have an important occasion ${relation}.`,
      };
    if (privacy === 'PERSON_ONLY')
      return {
        title: onDay ? 'Reminder today' : 'Upcoming reminder',
        body: `Reminder for ${person.name} ${relation}.`,
      };
    const label = OCCASION_LABELS[occasion.type].toLocaleLowerCase();
    return {
      title: onDay
        ? `${OCCASION_LABELS[occasion.type]} Today`
        : totalDays === 1
          ? 'Tomorrow'
          : `Upcoming ${OCCASION_LABELS[occasion.type]}`,
      body: `It's ${person.name}'s ${label} ${relation}.`,
    };
  }

  private birthdayEveNotificationText(
    person: Person,
    time: NonNullable<Occasion['birthdayEveReminderTime']>,
    privacy: NotificationPrivacy,
  ): { title: string; body: string } {
    const timing = time === '23:50' ? 'in 10 minutes' : 'at midnight';
    if (privacy === 'PRIVATE')
      return {
        title: 'Birthday reminder',
        body: `An important birthday begins ${timing}.`,
      };
    if (privacy === 'PERSON_ONLY')
      return {
        title: 'Birthday reminder',
        body: `${person.name}'s birthday begins ${timing}.`,
      };
    return {
      title: time === '23:50' ? 'Birthday in 10 minutes' : 'Birthday at midnight',
      body: `${person.name}'s birthday begins ${timing}.`,
    };
  }
}
