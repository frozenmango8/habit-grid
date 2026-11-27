import type { IsoDate, WeekStartsOn } from './dates';

export type { WeekStartsOn };

export type Theme = 'system' | 'light' | 'dark';

export type HabitMode = 'daily' | 'weekly';

export type Habit = {
  id: string;
  name: string;
  color: string;
  archived: boolean;
  createdOn: IsoDate;
  mode: HabitMode;
  target: number;
  log: Record<string, number>;
};

export type Settings = {
  weekStartsOn: WeekStartsOn;
  theme: Theme;
};

export type State = {
  version: 1;
  settings: Settings;
  habits: Habit[];
};
