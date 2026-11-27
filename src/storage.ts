import { isValidIso } from './dates';
import { blankState } from './habits';
import { COLORS } from './palette';
import type { Habit, Settings, State } from './types';

export const STORAGE_KEY = 'habit-grid';

const COLOR_IDS = new Set<string>(COLORS.map((color) => color.id));

export type ParseResult = { ok: true; state: State } | { ok: false; error: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function sortedLog(log: Record<string, number>): Record<string, number> {
  return Object.fromEntries(Object.entries(log).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
}

export function serialize(state: State): string {
  return JSON.stringify(
    {
      version: 1,
      settings: state.settings,
      habits: state.habits.map((habit) => ({
        id: habit.id,
        name: habit.name,
        color: habit.color,
        archived: habit.archived,
        createdOn: habit.createdOn,
        mode: habit.mode,
        target: habit.target,
        log: sortedLog(habit.log),
      })),
    },
    null,
    2,
  );
}

function parseSettings(value: unknown): Settings | null {
  if (!isRecord(value)) return null;
  const { weekStartsOn, theme } = value;
  if (weekStartsOn !== 0 && weekStartsOn !== 1) return null;
  if (theme !== 'system' && theme !== 'light' && theme !== 'dark') return null;
  return { weekStartsOn, theme };
}

function parseLog(value: unknown): Record<string, number> | null {
  if (!isRecord(value)) return null;
  const log: Record<string, number> = {};
  for (const [date, count] of Object.entries(value)) {
    if (!isValidIso(date)) return null;
    if (typeof count !== 'number' || !Number.isInteger(count) || count < 0 || count > 999) return null;
    if (count > 0) log[date] = count;
  }
  return log;
}

function parseHabit(value: unknown): Habit | null {
  if (!isRecord(value)) return null;
  if (typeof value.id !== 'string' || !/^[A-Za-z0-9-]{1,80}$/.test(value.id)) return null;
  if (typeof value.name !== 'string') return null;
  const name = value.name.trim();
  if (!name || name.length > 80) return null;
  if (typeof value.color !== 'string' || !COLOR_IDS.has(value.color)) return null;
  if (typeof value.archived !== 'boolean') return null;
  if (typeof value.createdOn !== 'string' || !isValidIso(value.createdOn)) return null;
  if (value.mode !== 'daily' && value.mode !== 'weekly') return null;
  if (typeof value.target !== 'number' || !Number.isInteger(value.target)) return null;
  const max = value.mode === 'weekly' ? 7 : 99;
  if (value.target < 1 || value.target > max) return null;
  const log = parseLog(value.log);
  if (!log) return null;
  return {
    id: value.id,
    name,
    color: value.color,
    archived: value.archived,
    createdOn: value.createdOn,
    mode: value.mode,
    target: value.target,
    log,
  };
}

export function parseBackup(raw: string): ParseResult {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return { ok: false, error: 'That file is not valid JSON.' };
  }
  if (!isRecord(data)) return { ok: false, error: 'That file is not a habit grid backup.' };
  if (data.version !== 1) return { ok: false, error: 'That backup is from a different version.' };
  const settings = parseSettings(data.settings);
  if (!settings) return { ok: false, error: 'The backup settings are not valid.' };
  if (!Array.isArray(data.habits)) return { ok: false, error: 'The backup is missing habits.' };

  const habits: Habit[] = [];
  const ids = new Set<string>();
  for (const entry of data.habits) {
    const habit = parseHabit(entry);
    if (!habit) return { ok: false, error: 'A habit in the backup is not valid.' };
    if (ids.has(habit.id)) return { ok: false, error: 'The backup has two habits with the same id.' };
    ids.add(habit.id);
    habits.push(habit);
  }
  return { ok: true, state: { version: 1, settings, habits } };
}

export function loadState(storage: Pick<Storage, 'getItem'>): { state: State; warning: string | null } {
  const raw = storage.getItem(STORAGE_KEY);
  if (!raw) return { state: blankState(), warning: null };
  const parsed = parseBackup(raw);
  if (!parsed.ok) return { state: blankState(), warning: 'Saved data could not be read.' };
  return { state: parsed.state, warning: null };
}

export function saveState(storage: Pick<Storage, 'setItem'>, state: State): string | null {
  try {
    storage.setItem(STORAGE_KEY, serialize(state));
    return null;
  } catch {
    return 'Could not save in this browser.';
  }
}
