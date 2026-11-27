import { addDays, isoDate, isValidIso, startOfWeek, type IsoDate, type WeekStartsOn } from './dates';
import type { Habit } from './types';

export type Ratio = {
  met: number;
  total: number;
};

export type HabitSummary = {
  current: number;
  longest: number;
  recent: Ratio;
  year: Ratio;
};

type Streak = {
  current: number;
  longest: number;
};

// Today, and the current week of a weekly habit, stay open until they end.
// Missing that open day or week does not wipe a streak that is otherwise intact.

export function habitStart(habit: Habit): IsoDate {
  let start = habit.createdOn;
  for (const [date, count] of Object.entries(habit.log)) {
    if (count > 0 && isValidIso(date) && date < start) start = date;
  }
  return start;
}

function goalOf(target: number): number {
  if (!Number.isFinite(target)) return 1;
  return Math.max(1, Math.round(target));
}

export function dailyStreak(
  log: Record<string, number>,
  target: number,
  today: IsoDate,
  start: IsoDate,
): Streak {
  if (start > today) return { current: 0, longest: 0 };
  const goal = goalOf(target);
  const done = (day: IsoDate) => day >= start && day <= today && (log[day] ?? 0) >= goal;

  let current = 0;
  let cursor = done(today) ? today : addDays(today, -1);
  while (cursor >= start && done(cursor)) {
    current += 1;
    cursor = addDays(cursor, -1);
  }

  let longest = 0;
  let run = 0;
  for (let day = start; day <= today; day = addDays(day, 1)) {
    if (done(day)) {
      run += 1;
      if (run > longest) longest = run;
    } else {
      run = 0;
    }
  }

  return { current, longest };
}

function daysLoggedInWeek(log: Record<string, number>, week: IsoDate, today: IsoDate): number {
  let count = 0;
  for (let index = 0; index < 7; index += 1) {
    const day = addDays(week, index);
    if (day > today) continue;
    if ((log[day] ?? 0) > 0) count += 1;
  }
  return count;
}

function weekOverlaps(week: IsoDate, start: IsoDate, today: IsoDate): boolean {
  const weekEnd = addDays(week, 6);
  return weekEnd >= start && week <= today;
}

export function weeklyStreak(
  log: Record<string, number>,
  target: number,
  today: IsoDate,
  start: IsoDate,
  weekStartsOn: WeekStartsOn,
): Streak {
  if (start > today) return { current: 0, longest: 0 };
  const goal = goalOf(target);
  const thisWeek = startOfWeek(today, weekStartsOn);
  const firstWeek = startOfWeek(start, weekStartsOn);
  const met = (week: IsoDate) => daysLoggedInWeek(log, week, today) >= goal;

  let current = 0;
  let week = met(thisWeek) ? thisWeek : addDays(thisWeek, -7);
  while (weekOverlaps(week, start, today) && met(week)) {
    current += 1;
    week = addDays(week, -7);
  }

  let longest = 0;
  let run = 0;
  for (let cursor = firstWeek; cursor <= thisWeek; cursor = addDays(cursor, 7)) {
    if (!weekOverlaps(cursor, start, today)) continue;
    if (met(cursor)) {
      run += 1;
      if (run > longest) longest = run;
    } else if (cursor !== thisWeek) {
      run = 0;
    }
  }

  return { current, longest };
}

export function dailyCompletion(
  log: Record<string, number>,
  target: number,
  from: IsoDate,
  to: IsoDate,
  today: IsoDate,
  start: IsoDate,
): Ratio {
  const begin = from > start ? from : start;
  const end = to < today ? to : today;
  if (begin > end) return { met: 0, total: 0 };
  const goal = goalOf(target);

  let met = 0;
  let total = 0;
  for (let day = begin; day <= end; day = addDays(day, 1)) {
    total += 1;
    if ((log[day] ?? 0) >= goal) met += 1;
  }
  return { met, total };
}

export function weeklyCompletion(
  log: Record<string, number>,
  target: number,
  from: IsoDate,
  to: IsoDate,
  today: IsoDate,
  start: IsoDate,
  weekStartsOn: WeekStartsOn,
): Ratio {
  const begin = from > start ? from : start;
  const end = to < today ? to : today;
  if (begin > end) return { met: 0, total: 0 };
  const goal = goalOf(target);

  const first = startOfWeek(begin, weekStartsOn);
  const last = startOfWeek(end, weekStartsOn);
  let met = 0;
  let total = 0;
  for (let week = first; week <= last; week = addDays(week, 7)) {
    const open = addDays(week, 6) >= today;
    const success = daysLoggedInWeek(log, week, today) >= goal;
    if (open && !success) continue;
    total += 1;
    if (success) met += 1;
  }
  return { met, total };
}

export function activityLevel(count: number, goal: number): 0 | 1 | 2 | 3 | 4 {
  if (count <= 0 || goal <= 0) return 0;
  const steps = Math.ceil((Math.min(count, goal) / goal) * 4);
  if (steps <= 1) return 1;
  if (steps === 2) return 2;
  if (steps === 3) return 3;
  return 4;
}

export function weekCount(
  log: Record<string, number>,
  today: IsoDate,
  weekStartsOn: WeekStartsOn,
): number {
  return daysLoggedInWeek(log, startOfWeek(today, weekStartsOn), today);
}

export function summarize(
  habit: Habit,
  today: IsoDate,
  year: number,
  weekStartsOn: WeekStartsOn,
): HabitSummary {
  const start = habitStart(habit);
  const streaks =
    habit.mode === 'weekly'
      ? weeklyStreak(habit.log, habit.target, today, start, weekStartsOn)
      : dailyStreak(habit.log, habit.target, today, start);

  const recentFrom = addDays(today, -29);
  const yearFrom = isoDate(year, 1, 1);
  const yearTo = isoDate(year, 12, 31);
  const recent =
    habit.mode === 'weekly'
      ? weeklyCompletion(habit.log, habit.target, recentFrom, today, today, start, weekStartsOn)
      : dailyCompletion(habit.log, habit.target, recentFrom, today, today, start);
  const yearRatio =
    habit.mode === 'weekly'
      ? weeklyCompletion(habit.log, habit.target, yearFrom, yearTo, today, start, weekStartsOn)
      : dailyCompletion(habit.log, habit.target, yearFrom, yearTo, today, start);

  return { current: streaks.current, longest: streaks.longest, recent, year: yearRatio };
}
