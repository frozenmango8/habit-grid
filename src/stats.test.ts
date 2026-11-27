import { describe, expect, it } from 'vitest';
import { addDays } from './dates';
import {
  activityLevel,
  dailyCompletion,
  dailyStreak,
  habitStart,
  summarize,
  weeklyCompletion,
  weeklyStreak,
  weekCount,
} from './stats';
import type { Habit } from './types';

function habit(overrides: Partial<Habit> = {}): Habit {
  return {
    id: 'h1',
    name: 'Read',
    color: 'moss',
    archived: false,
    createdOn: '2026-01-01',
    mode: 'daily',
    target: 1,
    log: {},
    ...overrides,
  };
}

function fill(from: string, to: string, count = 1): Record<string, number> {
  const log: Record<string, number> = {};
  for (let day = from; day <= to; day = addDays(day, 1)) log[day] = count;
  return log;
}

function logged(dates: string[], count = 1): Record<string, number> {
  return Object.fromEntries(dates.map((date) => [date, count]));
}

describe('daily streaks', () => {
  it('keeps the streak through an unfinished today', () => {
    const log = fill('2026-05-01', '2026-05-10');
    expect(dailyStreak(log, 1, '2026-05-11', '2026-05-01')).toEqual({ current: 10, longest: 10 });
  });

  it('breaks the streak when yesterday was missed', () => {
    const log = fill('2026-05-01', '2026-05-09');
    expect(dailyStreak(log, 1, '2026-05-11', '2026-05-01')).toEqual({ current: 0, longest: 9 });
    expect(dailyStreak({ ...log, '2026-05-11': 1 }, 1, '2026-05-11', '2026-05-01')).toEqual({
      current: 1,
      longest: 9,
    });
  });

  it('counts a day only when the count meets the target', () => {
    const log = { '2026-05-01': 2, '2026-05-02': 4, '2026-05-03': 4 };
    expect(dailyStreak(log, 4, '2026-05-03', '2026-05-01')).toEqual({ current: 2, longest: 2 });
  });

  it('includes February 29 in a streak', () => {
    const log = fill('2024-02-27', '2024-03-02');
    expect(dailyStreak(log, 1, '2024-03-02', '2024-01-01')).toEqual({ current: 5, longest: 5 });
  });

  it('crosses the US spring-forward night without skipping a day', () => {
    // 2026-03-08 is the second Sunday in March, when US clocks jump forward.
    const log = fill('2026-03-06', '2026-03-10');
    expect(Object.keys(log)).toEqual([
      '2026-03-06',
      '2026-03-07',
      '2026-03-08',
      '2026-03-09',
      '2026-03-10',
    ]);
    expect(dailyStreak(log, 1, '2026-03-10', '2026-01-01').current).toBe(5);
  });

  it('ignores days before the habit started and days after today', () => {
    const log = fill('2026-04-01', '2026-04-10');
    expect(dailyStreak(log, 1, '2026-04-08', '2026-04-05')).toEqual({ current: 4, longest: 4 });
  });

  it('is empty when the habit has not started', () => {
    expect(dailyStreak({}, 1, '2026-05-01', '2026-05-02')).toEqual({ current: 0, longest: 0 });
  });
});

describe('weekly streaks', () => {
  // 2026-01-01 is a Thursday, so 2026-01-04 is a Sunday.
  const first = ['2026-01-04', '2026-01-06', '2026-01-08'];
  const second = ['2026-01-11', '2026-01-12'];
  const third = ['2026-01-18', '2026-01-19', '2026-01-20'];

  it('counts weeks that reach the target, for example 3 times a week', () => {
    const log = logged([...first, ...second, ...third]);
    expect(weeklyStreak(log, 3, '2026-01-21', '2026-01-01', 0)).toEqual({ current: 1, longest: 1 });
  });

  it('leaves the current week open until it ends', () => {
    const log = logged([...first, ...second]);
    expect(weeklyStreak(log, 3, '2026-01-14', '2026-01-01', 0)).toEqual({ current: 1, longest: 1 });

    const twoGoodWeeks = logged([...first, '2026-01-11', '2026-01-13', '2026-01-14']);
    expect(weeklyStreak(twoGoodWeeks, 3, '2026-01-18', '2026-01-01', 0)).toEqual({
      current: 2,
      longest: 2,
    });
  });

  it('keeps the longest run when the open week is still short', () => {
    const log = logged([
      ...first,
      '2026-01-11',
      '2026-01-13',
      '2026-01-14',
      '2026-01-25',
      '2026-01-26',
      '2026-01-27',
    ]);
    expect(weeklyStreak(log, 3, '2026-02-01', '2026-01-01', 0)).toEqual({ current: 1, longest: 2 });
  });

  it('follows the week start', () => {
    const log = logged(['2026-01-04', '2026-01-05', '2026-01-06']);
    expect(weeklyStreak(log, 3, '2026-01-07', '2026-01-01', 0).current).toBe(1);
    expect(weeklyStreak(log, 3, '2026-01-07', '2026-01-01', 1).current).toBe(0);
  });

  it('does not count a future day toward this week', () => {
    const log = logged(['2026-01-04', '2026-01-05', '2026-01-10']);
    expect(weekCount(log, '2026-01-06', 0)).toBe(2);
    expect(weeklyStreak(log, 3, '2026-01-06', '2026-01-01', 0).current).toBe(0);
  });
});

describe('completion', () => {
  it('measures the last 30 days and the year from when the habit starts', () => {
    const log = logged(['2026-05-01', '2026-05-02', '2026-05-04', '2026-05-08', '2026-05-10']);
    const recent = dailyCompletion(log, 1, '2026-04-16', '2026-05-15', '2026-05-15', '2026-05-01');
    expect(recent).toEqual({ met: 5, total: 15 });

    const year = dailyCompletion(log, 1, '2026-01-01', '2026-12-31', '2026-05-15', '2026-01-01');
    expect(year.total).toBe(135);
    expect(year.met).toBe(5);
  });

  it('uses a full leap year, including February 29', () => {
    const leap = dailyCompletion({ '2024-02-29': 1 }, 1, '2024-01-01', '2024-12-31', '2024-12-31', '2024-01-01');
    expect(leap).toEqual({ met: 1, total: 366 });
    const common = dailyCompletion({}, 1, '2025-01-01', '2025-12-31', '2025-12-31', '2025-01-01');
    expect(common.total).toBe(365);
  });

  it('skips an open week that has not hit the target yet', () => {
    const metWeek = ['2026-01-04', '2026-01-06', '2026-01-08'];
    const missed = ['2026-01-11', '2026-01-12'];
    const open = weeklyCompletion(logged([...metWeek, ...missed]), 3, '2026-01-01', '2026-01-14', '2026-01-14', '2026-01-01', 0);
    expect(open).toEqual({ met: 1, total: 2 });

    const closed = weeklyCompletion(
      logged([...metWeek, ...missed, '2026-01-18', '2026-01-19', '2026-01-20']),
      3,
      '2026-01-01',
      '2026-01-21',
      '2026-01-21',
      '2026-01-01',
      0,
    );
    // The Sunday week that contains January 1 was already over, and it was missed.
    expect(closed).toEqual({ met: 2, total: 4 });
  });

  it('has nothing to score before the habit exists', () => {
    expect(dailyCompletion({}, 1, '2020-01-01', '2020-12-31', '2026-05-01', '2026-01-01')).toEqual({
      met: 0,
      total: 0,
    });
  });
});

describe('summaries', () => {
  it('moves the start earlier when a past day is logged', () => {
    const item = habit({ createdOn: '2026-05-10', log: { '2026-05-01': 1 } });
    expect(habitStart(item)).toBe('2026-05-01');
  });

  it('counts missed days in the last 30 and in the year, even before the habit was added', () => {
    const item = habit({
      createdOn: '2026-11-27',
      log: { '2026-11-27': 1 },
    });
    const summary = summarize(item, '2026-11-27', 2026, 0);
    expect(summary.current).toBe(1);
    expect(summary.recent).toEqual({ met: 1, total: 30 });
    expect(summary.year).toEqual({ met: 1, total: 331 });
  });

  it('summarizes the open streak, the last 30 days, and the selected year', () => {
    const item = habit({
      createdOn: '2020-01-01',
      log: fill('2026-05-01', '2026-05-10'),
    });
    const summary = summarize(item, '2026-05-11', 2026, 0);
    expect(summary.current).toBe(10);
    expect(summary.longest).toBe(10);
    expect(summary.recent).toEqual({ met: 10, total: 30 });
    expect(summary.year).toEqual({ met: 10, total: 131 });

    const past = summarize(item, '2026-05-11', 2024, 0);
    expect(past.year.total).toBe(366);
    expect(past.year.met).toBe(0);
  });

  it('shades a cell by progress toward the daily target', () => {
    expect(activityLevel(0, 8)).toBe(0);
    expect(activityLevel(1, 8)).toBe(1);
    expect(activityLevel(4, 8)).toBe(2);
    expect(activityLevel(6, 8)).toBe(3);
    expect(activityLevel(8, 8)).toBe(4);
    expect(activityLevel(1, 1)).toBe(4);
    expect(activityLevel(9, 8)).toBe(4);
  });
});
