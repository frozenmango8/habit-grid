import type { IsoDate } from './dates';
import type { Habit, HabitMode, Settings, State } from './types';

export function blankState(): State {
  return {
    version: 1,
    settings: { weekStartsOn: 0, theme: 'system' },
    habits: [],
  };
}

export function clampTarget(mode: HabitMode, target: number): number {
  const max = mode === 'weekly' ? 7 : 99;
  if (!Number.isFinite(target)) return 1;
  return Math.min(max, Math.max(1, Math.round(target)));
}

export function dayCap(habit: Habit): number {
  return habit.mode === 'weekly' ? 1 : clampTarget('daily', habit.target);
}

function mapHabit(state: State, id: string, update: (habit: Habit) => Habit): State {
  let changed = false;
  const habits = state.habits.map((habit) => {
    if (habit.id !== id) return habit;
    const next = update(habit);
    if (next !== habit) changed = true;
    return next;
  });
  return changed ? { ...state, habits } : state;
}

export function addHabit(
  state: State,
  input: { name: string; color: string; mode: HabitMode; target: number },
  today: IsoDate,
): State {
  const name = input.name.trim().slice(0, 80);
  if (!name) return state;
  const habit: Habit = {
    id: crypto.randomUUID(),
    name,
    color: input.color,
    archived: false,
    createdOn: today,
    mode: input.mode,
    target: clampTarget(input.mode, input.target),
    log: {},
  };
  return { ...state, habits: [...state.habits, habit] };
}

export function renameHabit(state: State, id: string, name: string): State {
  const trimmed = name.trim().slice(0, 80);
  if (!trimmed) return state;
  return mapHabit(state, id, (habit) => (habit.name === trimmed ? habit : { ...habit, name: trimmed }));
}

export function setHabitColor(state: State, id: string, color: string): State {
  return mapHabit(state, id, (habit) => (habit.color === color ? habit : { ...habit, color }));
}

export function setHabitSchedule(state: State, id: string, mode: HabitMode, target: number): State {
  const nextTarget = clampTarget(mode, target);
  return mapHabit(state, id, (habit) => {
    if (habit.mode === mode && habit.target === nextTarget) return habit;
    return { ...habit, mode, target: nextTarget };
  });
}

export function setHabitArchived(state: State, id: string, archived: boolean): State {
  return mapHabit(state, id, (habit) => (habit.archived === archived ? habit : { ...habit, archived }));
}

export function deleteHabit(state: State, id: string): State {
  const habits = state.habits.filter((habit) => habit.id !== id);
  if (habits.length === state.habits.length) return state;
  return { ...state, habits };
}

export function moveHabit(state: State, id: string, direction: -1 | 1): State {
  const habit = state.habits.find((item) => item.id === id);
  if (!habit) return state;
  const group = state.habits.filter((item) => item.archived === habit.archived);
  const position = group.findIndex((item) => item.id === id);
  const target = position + direction;
  if (target < 0 || target >= group.length) return state;

  const reordered = group.slice();
  const [moved] = reordered.splice(position, 1);
  reordered.splice(target, 0, moved);

  let index = 0;
  const habits = state.habits.map((item) => {
    if (item.archived !== habit.archived) return item;
    const next = reordered[index];
    index += 1;
    return next;
  });
  return { ...state, habits };
}

function withCount(habit: Habit, date: IsoDate, count: number): Habit {
  const current = habit.log[date] ?? 0;
  if (current === count) return habit;
  const log = { ...habit.log };
  if (count <= 0) delete log[date];
  else log[date] = count;
  return { ...habit, log };
}

export function setHabitCount(state: State, id: string, date: IsoDate, count: number, today: IsoDate): State {
  if (date > today) return state;
  const safe = Math.max(0, Math.min(999, Math.round(count)));
  if (!Number.isFinite(safe)) return state;
  return mapHabit(state, id, (habit) => withCount(habit, date, safe));
}

export function cycleHabitDay(state: State, id: string, date: IsoDate, today: IsoDate): State {
  const habit = state.habits.find((item) => item.id === id);
  if (!habit || date > today) return state;
  const cap = dayCap(habit);
  const current = habit.log[date] ?? 0;
  const next = current >= cap ? 0 : current + 1;
  return setHabitCount(state, id, date, next, today);
}

export function setHabitDone(state: State, id: string, date: IsoDate, done: boolean, today: IsoDate): State {
  const habit = state.habits.find((item) => item.id === id);
  if (!habit) return state;
  return setHabitCount(state, id, date, done ? dayCap(habit) : 0, today);
}

export function updateSettings(state: State, patch: Partial<Settings>): State {
  return { ...state, settings: { ...state.settings, ...patch } };
}
