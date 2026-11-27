import { describe, expect, it } from 'vitest';
import { blankState } from './habits';
import { loadState, parseBackup, saveState, serialize, STORAGE_KEY } from './storage';
import type { State } from './types';

function sample(): State {
  return {
    version: 1,
    settings: { weekStartsOn: 1, theme: 'dark' },
    habits: [
      {
        id: 'read',
        name: 'Read',
        color: 'moss',
        archived: false,
        createdOn: '2024-02-01',
        mode: 'daily',
        target: 2,
        log: { '2024-03-01': 2, '2024-02-29': 1 },
      },
    ],
  };
}

function memory() {
  const values = new Map<string, string>();
  return {
    values,
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
  };
}

describe('backups', () => {
  it('round-trips a backup and sorts the log', () => {
    const parsed = parseBackup(serialize(sample()));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.state).toEqual(sample());
    expect(Object.keys(parsed.state.habits[0]?.log ?? [])).toEqual(['2024-02-29', '2024-03-01']);
  });

  it('rejects a file that is not a backup', () => {
    expect(parseBackup('{').ok).toBe(false);
    expect(parseBackup('[]').ok).toBe(false);
    expect(parseBackup(JSON.stringify({ ...sample(), version: 2 })).ok).toBe(false);
    const broken = sample();
    broken.habits[0] = { ...broken.habits[0], log: { '2023-02-29': 1 } };
    expect(parseBackup(JSON.stringify(broken)).ok).toBe(false);
    const duplicate = sample();
    duplicate.habits.push({ ...duplicate.habits[0] });
    expect(parseBackup(JSON.stringify(duplicate)).ok).toBe(false);
    const weekly = sample();
    weekly.habits[0] = { ...weekly.habits[0], mode: 'weekly', target: 8 };
    expect(parseBackup(JSON.stringify(weekly)).ok).toBe(false);
  });

  it('loads an empty store and keeps a warning instead of a bad save', () => {
    const empty = memory();
    expect(loadState(empty).state).toEqual(blankState());

    const bad = memory();
    bad.setItem(STORAGE_KEY, '{');
    const loaded = loadState(bad);
    expect(loaded.state).toEqual(blankState());
    expect(loaded.warning).toBe('Saved data could not be read.');

    const store = memory();
    expect(saveState(store, sample())).toBeNull();
    expect(loadState(store).state).toEqual(sample());
  });
});
