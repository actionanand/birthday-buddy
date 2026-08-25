import { Service } from '@angular/core';
import { Feb29Policy, Occasion, OccasionType } from '../models/domain.models';

export interface UpcomingOccasion {
  occasion: Occasion;
  occurrence: Date;
  daysUntil: number;
}

@Service()
export class OccasionDateService {
  nextOccurrence(occasion: Pick<Occasion, 'day' | 'month'>, policy: Feb29Policy, from = new Date()): Date | undefined {
    const today = this.startOfDay(from);
    for (let year = today.getFullYear(); year <= today.getFullYear() + 8; year += 1) {
      const occurrence = this.resolveDate(year, occasion.month, occasion.day, policy);
      if (occurrence && occurrence >= today) return occurrence;
    }
    return undefined;
  }

  daysUntil(occasion: Pick<Occasion, 'day' | 'month'>, policy: Feb29Policy, from = new Date()): number {
    const occurrence = this.nextOccurrence(occasion, policy, from);
    if (!occurrence) return Number.POSITIVE_INFINITY;
    return Math.round((occurrence.getTime() - this.startOfDay(from).getTime()) / 86_400_000);
  }

  ageOnNextBirthday(occasion: Occasion, policy: Feb29Policy, from = new Date()): number | undefined {
    if (occasion.type !== 'BIRTHDAY' || occasion.year === undefined) return undefined;
    const occurrence = this.nextOccurrence(occasion, policy, from);
    return occurrence ? occurrence.getFullYear() - occasion.year : undefined;
  }

  anniversaryNumber(occasion: Occasion, policy: Feb29Policy, from = new Date()): number | undefined {
    if (occasion.type === 'BIRTHDAY' || occasion.year === undefined) return undefined;
    const occurrence = this.nextOccurrence(occasion, policy, from);
    return occurrence ? occurrence.getFullYear() - occasion.year : undefined;
  }

  ordinal(value: number): string {
    const remainder = value % 100;
    if (remainder >= 11 && remainder <= 13) return `${value}th`;
    return `${value}${value % 10 === 1 ? 'st' : value % 10 === 2 ? 'nd' : value % 10 === 3 ? 'rd' : 'th'}`;
  }

  formatDate(occasion: Pick<Occasion, 'day' | 'month' | 'year'>): string {
    const month = new Intl.DateTimeFormat(undefined, { month: 'long' }).format(new Date(2024, occasion.month - 1, 1));
    return `${occasion.day} ${month}${occasion.year === undefined ? '' : ` ${occasion.year}`}`;
  }

  labelForCountdown(days: number): string {
    if (days === 0) return 'Today';
    if (days === 1) return 'Tomorrow';
    return `In ${days} days`;
  }

  isValidDate(day: number, month: number, year?: number): boolean {
    const testYear = year ?? (month === 2 && day === 29 ? 2024 : 2000);
    const date = new Date(testYear, month - 1, day);
    return date.getFullYear() === testYear && date.getMonth() === month - 1 && date.getDate() === day;
  }

  isAnniversary(type: OccasionType): boolean {
    return type !== 'BIRTHDAY' && type !== 'REMEMBRANCE';
  }

  private resolveDate(year: number, month: number, day: number, policy: Feb29Policy): Date | undefined {
    if (month === 2 && day === 29 && !this.isLeapYear(year)) {
      if (policy === 'LEAP_ONLY') return undefined;
      return policy === 'FEB_28' ? new Date(year, 1, 28) : new Date(year, 2, 1);
    }
    return new Date(year, month - 1, day);
  }

  private isLeapYear(year: number): boolean {
    return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  }

  private startOfDay(value: Date): Date {
    return new Date(value.getFullYear(), value.getMonth(), value.getDate());
  }
}
