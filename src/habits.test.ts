import { describe, expect, it } from 'vitest';
import {
  addHabit,
  blankState,
  cycleHabitDay,
  dayCap,
  moveHabit,
  renameHabit,
  setHabitArchived,
  setHabitDone,
  setHabitSchedule,
} from './habits';
import type { State } from './types';

function withHabits(state: State = blankState()): State {
  return addHabit(
    addHabit(state, { name: ' Read ', color: 'moss', mode: 'daily', target: 1 }, '2026-05-01'),
    { name: 'Run', color: 'rust', mode: 'weekly', target: 9 },
    '2026-05-01',
  );
}

describe('habit edits', () => {
  it('trims the name and clamps a weekly target to 7', () => {
    const state = withHabits();
    expect(state.habits.map((habit) => habit.name)).toEqual(['Read', 'Run']);
    expect(state.habits[1]?.target).toBe(7);
    expect(state.habits[1]?.mode).toBe('weekly');
    expect(addHabit(state, { name: '   ', color: 'moss', mode: 'daily', target: 1 }, '2026-05-01')).toBe(state);
  });

  it('steps a daily count up to the target and then clears it', () => {
    let state = addHabit(blankState(), { name: 'Water', color: 'teal', mode: 'daily', target: 3 }, '2026-05-01');
    const id = state.habits[0]?.id ?? '';
    const counts: number[] = [];
    for (let index = 0; index < 4; index += 1) {
      state = cycleHabitDay(state, id, '2026-05-01', '2026-05-01');
      counts.push(state.habits[0]?.log['2026-05-01'] ?? 0);
    }
    expect(counts).toEqual([1, 2, 3, 0]);
    expect(cycleHabitDay(state, id, '2026-05-02', '2026-05-01')).toBe(state);
  });

  it('marks today done at the daily target, and weekly days only toggle', () => {
    let state = withHabits();
    const daily = state.habits[0];
    const weekly = state.habits[1];
    if (!daily || !weekly) throw new Error('missing habits');
    state = setHabitSchedule(state, daily.id, 'daily', 8);
    state = setHabitDone(state, daily.id, '2026-05-01', true, '2026-05-01');
    expect(state.habits[0]?.log['2026-05-01']).toBe(8);
    expect(dayCap(state.habits[1]!)).toBe(1);
    state = cycleHabitDay(state, weekly.id, '2026-05-01', '2026-05-01');
    state = cycleHabitDay(state, weekly.id, '2026-05-01', '2026-05-01');
    expect(state.habits[1]?.log['2026-05-01']).toBeUndefined();
  });

  it('reorders active habits without pulling archived ones along', () => {
    let state = withHabits();
    const second = state.habits[1];
    if (!second) throw new Error('missing habit');
    state = setHabitArchived(state, second.id, true);
    state = addHabit(state, { name: 'Stretch', color: 'amber', mode: 'daily', target: 1 }, '2026-05-02');
    const stretch = state.habits[2];
    if (!stretch) throw new Error('missing habit');
    state = moveHabit(state, stretch.id, -1);
    expect(state.habits.map((habit) => habit.name)).toEqual(['Stretch', 'Run', 'Read']);
    expect(moveHabit(state, stretch.id, -1).habits.map((habit) => habit.name)).toEqual([
      'Stretch',
      'Run',
      'Read',
    ]);
  });

  it('ignores a blank rename', () => {
    const state = withHabits();
    const id = state.habits[0]?.id ?? '';
    expect(renameHabit(state, id, '   ')).toBe(state);
    expect(renameHabit(state, id, 'Pages').habits[0]?.name).toBe('Pages');
  });
});
