import { describe, expect, it } from 'vitest';
import {
  addDays,
  daysInMonth,
  daysInYear,
  formatFull,
  gutterMarks,
  isLeapYear,
  isValidIso,
  monthLabels,
  startOfWeek,
  weekday,
  yearWeeks,
} from './dates';

describe('leap years', () => {
  it('follows the Gregorian rule', () => {
    expect(isLeapYear(2024)).toBe(true);
    expect(isLeapYear(2025)).toBe(false);
    expect(isLeapYear(1900)).toBe(false);
    expect(isLeapYear(2000)).toBe(true);
  });

  it('gives February 29 only in a leap year', () => {
    expect(daysInMonth(2024, 2)).toBe(29);
    expect(daysInMonth(1900, 2)).toBe(28);
    expect(daysInMonth(2000, 2)).toBe(29);
    expect(daysInYear(2024)).toBe(366);
    expect(daysInYear(2025)).toBe(365);
    expect(isValidIso('2024-02-29')).toBe(true);
    expect(isValidIso('2023-02-29')).toBe(false);
    expect(isValidIso('2025-02-29')).toBe(false);
    expect(isValidIso('2024-04-31')).toBe(false);
    expect(isValidIso('2024-13-01')).toBe(false);
    expect(isValidIso('24-02-29')).toBe(false);
  });

  it('steps onto and off of February 29', () => {
    expect(addDays('2024-02-28', 1)).toBe('2024-02-29');
    expect(addDays('2024-02-29', 1)).toBe('2024-03-01');
    expect(addDays('2024-03-01', -1)).toBe('2024-02-29');
    expect(addDays('2023-02-28', 1)).toBe('2023-03-01');
    expect(addDays('1900-02-28', 1)).toBe('1900-03-01');
    expect(addDays('2000-02-28', 1)).toBe('2000-02-29');
  });
});

describe('week boundaries', () => {
  it('knows a few fixed weekdays', () => {
    expect(weekday('2024-01-01')).toBe(1);
    expect(weekday('2024-02-29')).toBe(4);
    expect(weekday('2026-01-01')).toBe(4);
    expect(weekday('2026-03-08')).toBe(0);
    expect(weekday('2026-11-01')).toBe(0);
  });

  it('starts the week on Sunday or Monday', () => {
    expect(startOfWeek('2024-01-01', 1)).toBe('2024-01-01');
    expect(startOfWeek('2024-01-01', 0)).toBe('2023-12-31');
    expect(startOfWeek('2024-01-03', 1)).toBe('2024-01-01');
    expect(startOfWeek('2026-03-09', 0)).toBe('2026-03-08');
    expect(startOfWeek('2026-03-09', 1)).toBe('2026-03-09');
    expect(startOfWeek('2026-11-02', 0)).toBe('2026-11-01');
    expect(startOfWeek('2024-02-29', 1)).toBe('2024-02-26');
    expect(startOfWeek('2024-02-29', 0)).toBe('2024-02-25');
  });

  it('covers each day of the year once', () => {
    for (const year of [2024, 2025, 2026]) {
      for (const weekStartsOn of [0, 1] as const) {
        const weeks = yearWeeks(year, weekStartsOn);
        const inYear = weeks.flat().filter((day) => day.inYear);
        expect(inYear).toHaveLength(daysInYear(year));
        expect(inYear[0]?.date).toBe(`${year}-01-01`);
        expect(inYear[inYear.length - 1]?.date).toBe(`${year}-12-31`);
        inYear.forEach((day, index) => {
          if (index === 0) return;
          expect(day.date).toBe(addDays(inYear[index - 1].date, 1));
        });
        expect(weeks.every((week) => week.length === 7)).toBe(true);
      }
    }
  });

  it('pads the first week when the year does not start on the week boundary', () => {
    const monday = yearWeeks(2024, 1);
    expect(monday[0]?.[0]?.date).toBe('2024-01-01');
    expect(monday[0]?.every((day) => day.inYear)).toBe(true);

    const sunday = yearWeeks(2024, 0);
    expect(sunday[0]?.[0]).toEqual({ date: '2023-12-31', inYear: false });
    expect(sunday[0]?.[1]).toEqual({ date: '2024-01-01', inYear: true });
  });

  it('labels each month once, on the week that contains its first day', () => {
    const labels = monthLabels(yearWeeks(2026, 1));
    expect(labels.map((label) => label.label)).toEqual([
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Oct',
      'Nov',
      'Dec',
    ]);
    expect(labels[0]?.column).toBe(0);
    const february = labels.find((label) => label.label === 'Feb');
    const week = yearWeeks(2026, 1)[february?.column ?? -1];
    expect(week?.some((day) => day.date === '2026-02-01')).toBe(true);
  });
});

describe('labels', () => {
  it('formats a full date from the calendar fields', () => {
    expect(formatFull('2024-02-29')).toBe('Thursday, February 29, 2024');
    expect(formatFull('2026-01-01')).toBe('Thursday, January 1, 2026');
  });

  it('marks Monday, Wednesday, and Friday on the gutter', () => {
    expect(gutterMarks(1)).toEqual(['M', '', 'W', '', 'F', '', '']);
    expect(gutterMarks(0)).toEqual(['', 'M', '', 'W', '', 'F', '']);
  });
});
