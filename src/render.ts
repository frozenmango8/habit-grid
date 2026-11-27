import { formatFull, parts, type IsoDate } from './dates';
import { el } from './dom';
import { renderGraph } from './graph';
import { dayCap } from './habits';
import { colorById, COLORS } from './palette';
import { summarize, weekCount, type HabitSummary, type Ratio } from './stats';
import type { Habit, HabitMode, State } from './types';

export type View = {
  year: number;
  editId: string | null;
  deleteId: string | null;
  archivedOpen: boolean;
  message: { text: string; tone: 'ok' | 'error' } | null;
  focus: string | null;
};

const MIN_YEAR = 1970;

function percent(ratio: Ratio): string {
  if (ratio.total === 0) return '—';
  const value = (ratio.met / ratio.total) * 100;
  if (value > 0 && value < 1) return '<1%';
  return `${Math.round(value)}%`;
}

function statsLine(summary: HabitSummary, mode: HabitMode, year: number): string {
  const word = mode === 'weekly' ? 'week' : 'day';
  const plural = summary.longest === 1 ? word : `${word}s`;
  const current = summary.current === 0 ? 'No streak' : `${summary.current}-${word} streak`;
  const partsOfLine = [current];
  if (summary.longest > 0) partsOfLine.push(`best ${summary.longest} ${plural}`);
  partsOfLine.push(`30 days ${percent(summary.recent)}`);
  partsOfLine.push(`${year} ${percent(summary.year)}`);
  return partsOfLine.join(' · ');
}

function statsTitle(summary: HabitSummary, year: number): string | undefined {
  if (summary.recent.total === 0 && summary.year.total === 0) return undefined;
  const recent =
    summary.recent.total === 0
      ? 'Last 30 days not started'
      : `${summary.recent.met} of ${summary.recent.total} in the last 30 days`;
  const whole =
    summary.year.total === 0 ? `${year} not started` : `${summary.year.met} of ${summary.year.total} in ${year}`;
  return `${recent}. ${whole}.`;
}

function swatches(name: string, selected: string, habitId?: string): HTMLFieldSetElement {
  return el(
    'fieldset',
    { class: 'swatches' },
    el('legend', {}, 'Color'),
    el(
      'div',
      { class: 'swatch-row' },
      ...COLORS.map((color) =>
        el(
          'label',
          { class: 'swatch', style: `--habit-base:${color.value}` },
          el('input', {
            type: 'radio',
            name,
            value: color.id,
            ...(color.id === selected ? { checked: true } : {}),
            ...(habitId
              ? {
                  'data-action': 'set-color',
                  'data-habit': habitId,
                  'data-focus': `color:${habitId}:${color.id}`,
                }
              : {}),
          }),
          el('span', { 'aria-hidden': 'true' }),
          el('span', { class: 'sr' }, color.label),
        ),
      ),
    ),
  );
}

function todayItem(habit: Habit, today: IsoDate, weekStartsOn: State['settings']['weekStartsOn']): HTMLLIElement {
  const cap = dayCap(habit);
  const count = habit.log[today] ?? 0;
  const color = colorById(habit.color);
  const extra =
    habit.mode === 'weekly'
      ? el('span', { class: 'week-count' }, `${weekCount(habit.log, today, weekStartsOn)} of ${habit.target} this week`)
      : cap > 1
        ? el(
            'span',
            { class: 'stepper' },
            el(
              'button',
              {
                type: 'button',
                'data-action': 'step',
                'data-dir': '-1',
                'data-habit': habit.id,
                'data-focus': `step-down:${habit.id}`,
                'aria-label': `Decrease ${habit.name}`,
                ...(count <= 0 ? { disabled: true } : {}),
              },
              '−',
            ),
            el('span', { class: 'count' }, `${count}/${cap}`),
            el(
              'button',
              {
                type: 'button',
                'data-action': 'step',
                'data-dir': '1',
                'data-habit': habit.id,
                'data-focus': `step-up:${habit.id}`,
                'aria-label': `Increase ${habit.name}`,
                ...(count >= cap ? { disabled: true } : {}),
              },
              '+',
            ),
          )
        : null;

  return el(
    'li',
    { class: 'today-item', style: `--habit-base:${color.value}` },
    el('span', { class: 'dot', 'aria-hidden': 'true' }),
    el(
      'label',
      { class: 'check' },
      el('input', {
        type: 'checkbox',
        'data-action': 'check',
        'data-habit': habit.id,
        'data-focus': `check:${habit.id}`,
        ...(count >= cap ? { checked: true } : {}),
      }),
      el('span', { class: 'habit-name', 'data-name-for': habit.id }, habit.name),
    ),
    extra,
  );
}

function actionButton(
  action: string,
  habit: Habit,
  label: string,
  accessibleName: string,
  options: { disabled?: boolean; focus?: string } = {},
): HTMLButtonElement {
  return el(
    'button',
    {
      type: 'button',
      'data-action': action,
      'data-habit': habit.id,
      'data-focus': `${options.focus ?? action}:${habit.id}`,
      'aria-label': accessibleName,
      ...(options.disabled ? { disabled: true } : {}),
    },
    label,
  );
}

function editor(habit: Habit): HTMLFormElement {
  const schedule = el(
    'select',
    { 'data-action': 'set-mode', 'data-habit': habit.id, 'data-focus': `mode:${habit.id}` },
    el('option', { value: 'daily' }, 'Every day'),
    el('option', { value: 'weekly' }, 'Times a week'),
  );
  schedule.value = habit.mode;

  return el(
    'form',
    { class: 'editor', 'data-form': 'edit', 'data-habit': habit.id },
    el(
      'label',
      { class: 'field grow' },
      el('span', {}, 'Name'),
      el('input', {
        type: 'text',
        value: habit.name,
        maxlength: '80',
        autocomplete: 'off',
        'data-action': 'rename',
        'data-habit': habit.id,
        'data-focus': `rename:${habit.id}`,
      }),
    ),
    swatches(`color-${habit.id}`, habit.color, habit.id),
    el('label', { class: 'field' }, el('span', {}, 'Schedule'), schedule),
    el(
      'label',
      { class: 'field' },
      el('span', {}, 'Goal'),
      el(
        'span',
        { class: 'goal' },
        el('input', {
          type: 'number',
          min: '1',
          max: habit.mode === 'weekly' ? '7' : '99',
          step: '1',
          inputmode: 'numeric',
          value: String(habit.target),
          'data-action': 'goal',
          'data-habit': habit.id,
          'data-focus': `goal:${habit.id}`,
        }),
        el('span', {}, habit.mode === 'weekly' ? 'per week' : 'per day'),
      ),
    ),
  );
}

function habitArticle(
  state: State,
  habit: Habit,
  view: View,
  today: IsoDate,
  focusKey: string | null,
): HTMLElement {
  const summary = summarize(habit, today, view.year, state.settings.weekStartsOn);
  const editing = view.editId === habit.id;
  const peers = state.habits.filter((item) => item.archived === habit.archived);
  const index = peers.findIndex((item) => item.id === habit.id);
  const color = colorById(habit.color);

  const actions =
    view.deleteId === habit.id
      ? el(
          'div',
          { class: 'actions' },
          el('span', { class: 'confirm-copy' }, `Delete "${habit.name}" and its log?`),
          el(
            'button',
            {
              type: 'button',
              class: 'danger',
              'data-action': 'delete-yes',
              'data-habit': habit.id,
              'data-focus': `delete-yes:${habit.id}`,
            },
            'Delete',
          ),
          el(
            'button',
            {
              type: 'button',
              'data-action': 'delete-no',
              'data-habit': habit.id,
              'data-focus': `delete-no:${habit.id}`,
            },
            'Cancel',
          ),
        )
      : el(
          'div',
          { class: 'actions' },
          el(
            'button',
            {
              type: 'button',
              'data-action': 'edit',
              'data-habit': habit.id,
              'data-focus': `edit:${habit.id}`,
              'aria-expanded': editing ? 'true' : 'false',
              'aria-label': `${editing ? 'Close' : 'Edit'} ${habit.name}`,
            },
            editing ? 'Close' : 'Edit',
          ),
          peers.length > 1 ? actionButton('up', habit, 'Up', `Move ${habit.name} up`, { disabled: index <= 0 }) : null,
          peers.length > 1
            ? actionButton('down', habit, 'Down', `Move ${habit.name} down`, { disabled: index === peers.length - 1 })
            : null,
          actionButton(
            habit.archived ? 'unarchive' : 'archive',
            habit,
            habit.archived ? 'Unarchive' : 'Archive',
            `${habit.archived ? 'Unarchive' : 'Archive'} ${habit.name}`,
            { focus: 'archive' },
          ),
          actionButton('delete', habit, 'Delete', `Delete ${habit.name}`),
        );

  const detail = statsTitle(summary, view.year);

  return el(
    'article',
    { class: habit.archived ? 'habit is-archived' : 'habit', style: `--habit-base:${color.value}` },
    el(
      'div',
      { class: 'habit-head' },
      editing ? editor(habit) : el('h3', {}, habit.name),
      el('p', { class: 'stats', ...(detail ? { title: detail } : {}) }, statsLine(summary, habit.mode, view.year)),
      actions,
    ),
    renderGraph(habit, view.year, state.settings.weekStartsOn, today, focusKey),
  );
}

function addForm(): HTMLFormElement {
  const schedule = el(
    'select',
    { name: 'mode', 'data-focus': 'add-mode' },
    el('option', { value: 'daily' }, 'Every day'),
    el('option', { value: 'weekly' }, 'Times a week'),
  );

  return el(
    'form',
    { class: 'add', 'data-form': 'add' },
    el('h2', {}, 'Add a habit'),
    el(
      'label',
      { class: 'field grow' },
      el('span', {}, 'Name'),
      el('input', {
        type: 'text',
        name: 'name',
        required: true,
        maxlength: '80',
        autocomplete: 'off',
        'data-focus': 'add-name',
      }),
    ),
    swatches('color', COLORS[0].id),
    el('label', { class: 'field' }, el('span', {}, 'Schedule'), schedule),
    el(
      'label',
      { class: 'field' },
      el('span', {}, 'Goal'),
      el(
        'span',
        { class: 'goal' },
        el('input', {
          type: 'number',
          name: 'target',
          required: true,
          min: '1',
          max: '99',
          step: '1',
          value: '1',
          inputmode: 'numeric',
          'data-focus': 'add-goal',
        }),
        el('span', { 'data-goal-suffix': 'true' }, 'per day'),
      ),
    ),
    el('button', { type: 'submit' }, 'Add'),
  );
}

export function render(state: State, view: View, today: IsoDate, focusKey: string | null): HTMLElement {
  const active = state.habits.filter((habit) => !habit.archived);
  const archived = state.habits.filter((habit) => habit.archived);
  const year = parts(today).year;
  const week = el(
    'select',
    { 'data-action': 'week-start', 'data-focus': 'week-start', 'aria-label': 'Week starts on' },
    el('option', { value: '0' }, 'Sunday'),
    el('option', { value: '1' }, 'Monday'),
  );
  week.value = String(state.settings.weekStartsOn);
  const theme = el(
    'select',
    { 'data-action': 'theme', 'data-focus': 'theme', 'aria-label': 'Theme' },
    el('option', { value: 'system' }, 'System'),
    el('option', { value: 'light' }, 'Light'),
    el('option', { value: 'dark' }, 'Dark'),
  );
  theme.value = state.settings.theme;

  const todayList =
    active.length === 0
      ? el('p', { class: 'empty' }, state.habits.length === 0 ? 'No habits yet.' : 'No active habits.')
      : el(
          'ul',
          { class: 'today-list' },
          ...active.map((habit) => todayItem(habit, today, state.settings.weekStartsOn)),
        );

  const yearSection =
    state.habits.length === 0
      ? null
      : el(
          'section',
          { class: 'year-section', 'aria-labelledby': 'year-heading' },
          el(
            'div',
            { class: 'year-bar' },
            el('h2', { id: 'year-heading' }, String(view.year)),
            el(
              'div',
              { class: 'year-nav' },
              el(
                'button',
                {
                  type: 'button',
                  'data-action': 'year',
                  'data-dir': '-1',
                  'data-focus': 'year-prev',
                  ...(view.year <= MIN_YEAR ? { disabled: true } : {}),
                },
                'Previous year',
              ),
              el(
                'button',
                {
                  type: 'button',
                  'data-action': 'year',
                  'data-dir': '1',
                  'data-focus': 'year-next',
                  ...(view.year >= year ? { disabled: true } : {}),
                },
                'Next year',
              ),
            ),
          ),
          el(
            'p',
            { class: 'hint' },
            'Click a day to mark it. Click it again to clear it. A daily goal above one steps the count, and the square darkens as it fills.',
          ),
          active.length === 0 ? el('p', { class: 'empty' }, 'No active habits.') : null,
          ...active.map((habit) => habitArticle(state, habit, view, today, focusKey)),
          archived.length === 0
            ? null
            : el(
                'div',
                { class: 'archived' },
                el(
                  'button',
                  {
                    type: 'button',
                    'data-action': 'toggle-archived',
                    'data-focus': 'archived-toggle',
                    'aria-expanded': view.archivedOpen ? 'true' : 'false',
                  },
                  view.archivedOpen ? `Hide archived · ${archived.length}` : `Archived · ${archived.length}`,
                ),
                view.archivedOpen
                  ? el(
                      'div',
                      { class: 'archived-list' },
                      ...archived.map((habit) => habitArticle(state, habit, view, today, focusKey)),
                    )
                  : null,
              ),
        );

  return el(
    'div',
    { class: 'wrap' },
    el('a', { class: 'skip', href: '#today' }, 'Skip to today'),
    el(
      'header',
      { class: 'top' },
      el('h1', {}, 'Habit grid'),
      el(
        'div',
        { class: 'tools' },
        el('label', { class: 'tool' }, el('span', {}, 'Week starts'), week),
        el('label', { class: 'tool' }, el('span', {}, 'Theme'), theme),
        el('button', { type: 'button', 'data-action': 'export', 'data-focus': 'export' }, 'Export'),
        el('button', { type: 'button', 'data-action': 'import', 'data-focus': 'import' }, 'Import'),
        el('input', {
          id: 'import-file',
          class: 'sr',
          type: 'file',
          accept: 'application/json,.json',
          tabindex: '-1',
          'data-action': 'import-file',
          'aria-label': 'Import backup',
        }),
      ),
    ),
    view.message ? el('p', { class: `status ${view.message.tone}`, role: 'status' }, view.message.text) : null,
    el(
      'main',
      {},
      el(
        'section',
        { class: 'today-section', id: 'today', 'aria-labelledby': 'today-heading' },
        el(
          'div',
          { class: 'section-head' },
          el('h2', { id: 'today-heading' }, 'Today'),
          el('p', { class: 'when' }, formatFull(today)),
        ),
        todayList,
      ),
      addForm(),
      yearSection,
    ),
  );
}
