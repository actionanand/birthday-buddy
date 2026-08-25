import { Occasion } from '../models/domain.models';
import { OccasionDateService } from './occasion-date.service';

const occasion = (values: Partial<Occasion>): Occasion => ({
  id: 'occasion',
  personId: 'person',
  type: 'BIRTHDAY',
  day: 1,
  month: 1,
  source: 'MANUAL',
  userModified: false,
  enabled: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  ...values,
});

describe('OccasionDateService', () => {
  const service = new OccasionDateService();

  it('rolls a December occasion into the next year', () => {
    const next = service.nextOccurrence(occasion({ day: 2, month: 1 }), 'FEB_28', new Date(2026, 11, 31));
    expect(next).toEqual(new Date(2027, 0, 2));
  });

  it('treats today as the next occurrence', () => {
    expect(service.daysUntil(occasion({ day: 25, month: 8 }), 'FEB_28', new Date(2026, 7, 25, 20))).toBe(0);
  });

  it('applies each February 29 policy', () => {
    const leapDay = occasion({ day: 29, month: 2 });
    expect(service.nextOccurrence(leapDay, 'FEB_28', new Date(2025, 0, 1))).toEqual(new Date(2025, 1, 28));
    expect(service.nextOccurrence(leapDay, 'MAR_1', new Date(2025, 0, 1))).toEqual(new Date(2025, 2, 1));
    expect(service.nextOccurrence(leapDay, 'LEAP_ONLY', new Date(2025, 0, 1))).toEqual(new Date(2028, 1, 29));
  });

  it('calculates age only when a birth year exists', () => {
    expect(service.ageOnNextBirthday(occasion({ day: 25, month: 8, year: 1992 }), 'FEB_28', new Date(2026, 0, 1))).toBe(
      34,
    );
    expect(service.ageOnNextBirthday(occasion({ day: 25, month: 8 }), 'FEB_28', new Date(2026, 0, 1))).toBeUndefined();
  });

  it('formats ordinal suffixes correctly', () => {
    expect([1, 2, 3, 4, 11, 12, 13, 21, 22, 23, 31].map(value => service.ordinal(value))).toEqual([
      '1st',
      '2nd',
      '3rd',
      '4th',
      '11th',
      '12th',
      '13th',
      '21st',
      '22nd',
      '23rd',
      '31st',
    ]);
  });

  it('validates leap days without inventing a year', () => {
    expect(service.isValidDate(29, 2)).toBe(true);
    expect(service.isValidDate(29, 2, 2025)).toBe(false);
    expect(service.isValidDate(31, 4)).toBe(false);
  });
});
