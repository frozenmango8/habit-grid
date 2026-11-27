import { formatFull, formatShort, gutterMarks, monthLabels, yearWeeks, type IsoDate, type WeekStartsOn } from './dates';
import { el } from './dom';
import { dayCap } from './habits';
import { activityLevel } from './stats';
import type { Habit } from './types';

function cellLabel(date: IsoDate, count: number, today: IsoDate, cap: number): string {
  const when = formatFull(date);
  if (date > today) return `${when}, upcoming`;
  if (cap === 1) return count > 0 ? `${when}, done` : `${when}, not done`;
  return `${when}, ${count} of ${cap}, ${count >= cap ? 'done' : 'not done'}`;
}

function cellTitle(date: IsoDate, count: number, cap: number, weekly: boolean): string {
  const when = formatShort(date);
  if (weekly || cap === 1) return count > 0 ? `${when} · done` : when;
  return `${when} · ${count}/${cap}`;
}

export function renderGraph(
  habit: Habit,
  year: number,
  weekStartsOn: WeekStartsOn,
  today: IsoDate,
  focusKey: string | null,
): HTMLElement {
  const weeks = yearWeeks(year, weekStartsOn);
  const labels = new Map(monthLabels(weeks).map((label) => [label.column, label.label]));
  const cap = dayCap(habit);
  const focusInGrid = focusKey?.startsWith(`cell:${habit.id}:`) ?? false;
  let tabbed = false;

  const columns = weeks.map((week) => {
    const days = week.map((day) => {
      const count = habit.log[day.date] ?? 0;
      const upcoming = day.date > today;
      let tabIndex = -1;
      if (!upcoming) {
        if (focusKey === `cell:${habit.id}:${day.date}` || (!focusInGrid && !tabbed)) {
          tabIndex = 0;
          tabbed = true;
        }
      }
      return el('button', {
        type: 'button',
        class: day.inYear ? 'cell' : 'cell outside',
        'data-action': 'cycle',
        'data-habit': habit.id,
        'data-date': day.date,
        'data-level': String(activityLevel(count, cap)),
        'data-focus': `cell:${habit.id}:${day.date}`,
        'aria-label': cellLabel(day.date, count, today, cap),
        title: cellTitle(day.date, count, cap, habit.mode === 'weekly'),
        tabindex: String(tabIndex),
        ...(upcoming ? { disabled: true } : {}),
      });
    });
    return el('div', { class: 'week' }, ...days);
  });

  const months = weeks.map((_, column) => {
    const label = labels.get(column);
    return el('div', { class: 'month-cell' }, label ? el('span', { class: 'month-label' }, label) : null);
  });

  return el(
    'div',
    { class: 'graph' },
    el(
      'div',
      { class: 'gutter', 'aria-hidden': 'true' },
      el('span', { class: 'gutter-month' }),
      ...gutterMarks(weekStartsOn).map((mark) => el('span', {}, mark)),
    ),
    el(
      'div',
      { class: 'graph-scroll', 'data-scroll': habit.id },
      el('div', { class: 'months' }, ...months),
      el('div', { class: 'weeks', role: 'group', 'aria-label': `${habit.name}, ${year}` }, ...columns),
    ),
  );
}
