import { Service, inject } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { LocalNotifications, LocalNotificationSchema } from '@capacitor/local-notifications';
import { NotificationPrivacy, OCCASION_LABELS, Occasion, OccasionReminder, Person } from '../models/domain.models';
import { createId, stableNotificationId } from '../utils/id';
import { BirthdayStoreService } from './birthday-store.service';
import { OccasionDateService } from './occasion-date.service';
import { RepositoryProviderService } from './repository-provider.service';

@Service()
export class ReminderSchedulerService {
  private readonly store = inject(BirthdayStoreService);
  private readonly dates = inject(OccasionDateService);
  private readonly repositories = inject(RepositoryProviderService);

  async reconcileAll(requestPermission = false): Promise<'scheduled' | 'denied' | 'web'> {
    if (!Capacitor.isNativePlatform()) return 'web';
    const active = this.store
      .enabledOccasions()
      .filter(occasion => this.store.remindersFor(occasion.id).some(reminder => reminder.enabled));
    if (active.length === 0) return 'scheduled';
    const permission = requestPermission
      ? await LocalNotifications.requestPermissions()
      : await LocalNotifications.checkPermissions();
    if (permission.display !== 'granted') return 'denied';
    for (const occasion of active) await this.rescheduleOccasion(occasion.id, false);
    return 'scheduled';
  }

  async rescheduleOccasion(occasionId: string, requestPermission = true): Promise<'scheduled' | 'denied' | 'web'> {
    if (!Capacitor.isNativePlatform()) return 'web';
    const occasion = this.store.occasion(occasionId);
    const person = occasion ? this.store.person(occasion.personId) : undefined;
    if (!occasion || !person) return 'scheduled';
    const reminders = this.store.remindersFor(occasionId).filter(reminder => reminder.enabled);
    const existing = await this.repositories.notificationSchedules.forOccasion(occasionId);
    if (existing.length)
      await LocalNotifications.cancel({ notifications: existing.map(item => ({ id: item.notificationId })) });
    if (!occasion.enabled || reminders.length === 0) {
      await this.repositories.notificationSchedules.replaceForOccasion(occasionId, []);
      return 'scheduled';
    }
    const permission = requestPermission
      ? await LocalNotifications.requestPermissions()
      : await LocalNotifications.checkPermissions();
    if (permission.display !== 'granted') return 'denied';
    const occurrence = this.dates.nextOccurrence(occasion, this.store.settings().feb29Policy);
    if (!occurrence) return 'scheduled';
    const notifications: LocalNotificationSchema[] = [];
    const schedules = [];
    for (const reminder of reminders) {
      const scheduledAt = this.subtractOffset(occurrence, reminder);
      scheduledAt.setHours(reminder.hour, reminder.minute, 0, 0);
      if (scheduledAt.getTime() <= Date.now()) continue;
      const notificationId = stableNotificationId(reminder.id);
      const message = this.notificationText(person, occasion, reminder, this.store.settings().notificationPrivacy);
      notifications.push({
        id: notificationId,
        title: message.title,
        body: message.body,
        schedule: { at: scheduledAt, allowWhileIdle: true },
        extra: { occasionId },
      });
      schedules.push({
        id: createId(),
        occasionId,
        reminderId: reminder.id,
        notificationId,
        scheduledAt: scheduledAt.toISOString(),
        createdAt: new Date().toISOString(),
      });
    }
    if (notifications.length) await LocalNotifications.schedule({ notifications });
    await this.repositories.notificationSchedules.replaceForOccasion(occasionId, schedules);
    return 'scheduled';
  }

  async cancelOccasion(occasionId: string): Promise<void> {
    if (!Capacitor.isNativePlatform()) return;
    const schedules = await this.repositories.notificationSchedules.forOccasion(occasionId);
    if (schedules.length)
      await LocalNotifications.cancel({ notifications: schedules.map(item => ({ id: item.notificationId })) });
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
}
