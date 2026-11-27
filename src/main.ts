import '@fontsource/newsreader/latin-500-italic.css';
import '@fontsource/newsreader/latin-500.css';
import '@fontsource/public-sans/latin-400.css';
import '@fontsource/public-sans/latin-600.css';
import { addDays, parts, todayIso, type IsoDate } from './dates';
import {
  addHabit,
  cycleHabitDay,
  dayCap,
  deleteHabit,
  moveHabit,
  renameHabit,
  setHabitArchived,
  setHabitColor,
  setHabitCount,
  setHabitDone,
  setHabitSchedule,
  updateSettings,
} from './habits';
import { render, type View } from './render';
import { loadState, parseBackup, saveState, serialize } from './storage';
import './style.css';
import type { HabitMode, Theme } from './types';

const appElement = document.querySelector('#app');
if (!(appElement instanceof HTMLElement)) throw new Error('Missing #app');
const app: HTMLElement = appElement;

const loaded = loadState(localStorage);
let state = loaded.state;
const view: View = {
  year: parts(todayIso()).year,
  editId: null,
  deleteId: null,
  archivedOpen: false,
  message: loaded.warning ? { text: loaded.warning, tone: 'error' } : null,
  focus: null,
};

let frame = 0;

function applyTheme(theme: Theme) {
  const dark =
    theme === 'dark' ||
    (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
}

function persist() {
  const error = saveState(localStorage, state);
  if (error) view.message = { text: error, tone: 'error' };
}

function draw() {
  const scrolls = new Map<string, number>();
  document.querySelectorAll<HTMLElement>('[data-scroll]').forEach((node) => {
    if (node.dataset.scroll) scrolls.set(node.dataset.scroll, node.scrollLeft);
  });
  const y = window.scrollY;
  const active = document.activeElement;
  const prior = active instanceof HTMLElement ? (active.dataset.focus ?? null) : null;
  const key = view.focus ?? prior;
  const explicit = view.focus !== null;
  view.focus = null;

  app.replaceChildren(render(state, view, todayIso(), key));
  applyTheme(state.settings.theme);

  document.querySelectorAll<HTMLElement>('[data-scroll]').forEach((node) => {
    const saved = node.dataset.scroll ? scrolls.get(node.dataset.scroll) : undefined;
    if (saved !== undefined) {
      node.scrollLeft = saved;
      return;
    }
    const today = todayIso();
    const exact = node.querySelector<HTMLElement>(`[data-date="${today}"]`);
    const cells = node.querySelectorAll<HTMLElement>('.cell:not(:disabled)');
    const cell = exact ?? (cells.length > 0 ? cells[cells.length - 1] : null);
    if (!cell) return;
    const delta = cell.getBoundingClientRect().right - node.getBoundingClientRect().right + 12;
    if (delta > 0) node.scrollLeft += delta;
  });
  window.scrollTo(0, y);

  if (!key) return;
  const next = app.querySelector<HTMLElement>(`[data-focus="${key}"]`);
  if (!next) return;
  next.focus({ preventScroll: !explicit });
  if (explicit && next instanceof HTMLInputElement && next.dataset.action === 'rename') next.select();
}

function drawNow() {
  cancelAnimationFrame(frame);
  draw();
}

function requestDraw() {
  cancelAnimationFrame(frame);
  frame = requestAnimationFrame(draw);
}

function habitById(id: string) {
  return state.habits.find((habit) => habit.id === id);
}

function exportBackup() {
  const blob = new Blob([serialize(state)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `habit-grid-${todayIso()}.json`;
  link.click();
  URL.revokeObjectURL(url);
  view.message = { text: `Exported ${link.download}.`, tone: 'ok' };
  drawNow();
}

function readImport(file: File) {
  const reader = new FileReader();
  reader.onload = () => {
    const text = typeof reader.result === 'string' ? reader.result : '';
    const parsed = parseBackup(text);
    if (!parsed.ok) {
      view.message = { text: parsed.error, tone: 'error' };
      drawNow();
      return;
    }
    const count = parsed.state.habits.length;
    const noun = count === 1 ? 'habit' : 'habits';
    if (
      state.habits.length > 0 &&
      !window.confirm(`Replace the habits in this browser with ${count} ${noun} from the file?`)
    ) {
      return;
    }
    state = parsed.state;
    const error = saveState(localStorage, state);
    view.message = { text: error ?? `Imported ${count} ${noun}.`, tone: error ? 'error' : 'ok' };
    view.editId = null;
    view.deleteId = null;
    const year = parts(todayIso()).year;
    if (view.year > year) view.year = year;
    drawNow();
  };
  reader.readAsText(file);
}

function submitAdd(form: HTMLFormElement) {
  const data = new FormData(form);
  const name = String(data.get('name') ?? '');
  const nameInput = form.elements.namedItem('name');
  if (!name.trim()) {
    if (nameInput instanceof HTMLInputElement) {
      nameInput.setCustomValidity('Name the habit first.');
      nameInput.reportValidity();
      nameInput.addEventListener('input', () => nameInput.setCustomValidity(''), { once: true });
    }
    return;
  }
  const mode: HabitMode = data.get('mode') === 'weekly' ? 'weekly' : 'daily';
  const color = String(data.get('color') ?? 'moss');
  const target = Number(data.get('target'));
  const next = addHabit(state, { name, color, mode, target }, todayIso());
  if (next === state) return;
  state = next;
  persist();
  const created = state.habits[state.habits.length - 1];
  view.message = null;
  view.focus = created ? `check:${created.id}` : 'add-name';
  drawNow();
}

function moveCell(current: HTMLButtonElement, delta: number) {
  const date = current.dataset.date;
  const root = current.closest('.graph');
  if (!date || !root) return;
  let nextDate = addDays(date, delta);
  for (let hop = 0; hop < 400; hop += 1) {
    const candidate = root.querySelector<HTMLButtonElement>(`[data-date="${nextDate}"]`);
    if (!candidate) return;
    if (!candidate.disabled) {
      current.tabIndex = -1;
      candidate.tabIndex = 0;
      candidate.focus({ preventScroll: true });
      const scroller = candidate.closest('.graph-scroll');
      if (scroller instanceof HTMLElement) {
        const cellBox = candidate.getBoundingClientRect();
        const box = scroller.getBoundingClientRect();
        if (cellBox.left < box.left) scroller.scrollLeft -= box.left - cellBox.left;
        else if (cellBox.right > box.right) scroller.scrollLeft += cellBox.right - box.right;
      }
      return;
    }
    nextDate = addDays(nextDate as IsoDate, delta);
  }
}

function onClick(event: Event) {
  const target = event.target;
  if (!(target instanceof Element)) return;
  const control = target.closest<HTMLElement>('[data-action]');
  if (!control) return;
  const action = control.dataset.action;
  const id = control.dataset.habit ?? '';
  const today = todayIso();

  if (action === 'import') {
    app.querySelector<HTMLInputElement>('#import-file')?.click();
    return;
  }
  if (action === 'export') {
    exportBackup();
    return;
  }
  if (action === 'set-color' || action === 'import-file') return;

  view.message = null;

  if (action === 'cycle') {
    const date = control.dataset.date;
    if (!date) return;
    state = cycleHabitDay(state, id, date, today);
    persist();
    drawNow();
    return;
  }
  if (action === 'step') {
    const habit = habitById(id);
    if (!habit) return;
    const dir = control.dataset.dir === '-1' ? -1 : 1;
    const next = Math.min(dayCap(habit), Math.max(0, (habit.log[today] ?? 0) + dir));
    state = setHabitCount(state, id, today, next, today);
    persist();
    drawNow();
    return;
  }
  if (action === 'year') {
    const dir = control.dataset.dir === '-1' ? -1 : 1;
    const next = view.year + dir;
    if (next < 1970 || next > parts(today).year) return;
    view.year = next;
    view.focus = dir < 0 ? 'year-prev' : 'year-next';
    drawNow();
    return;
  }
  if (action === 'edit') {
    const opening = view.editId !== id;
    view.editId = opening ? id : null;
    view.deleteId = null;
    view.focus = opening ? `rename:${id}` : `edit:${id}`;
    drawNow();
    return;
  }
  if (action === 'up' || action === 'down') {
    state = moveHabit(state, id, action === 'up' ? -1 : 1);
    persist();
    view.focus = `${action}:${id}`;
    drawNow();
    return;
  }
  if (action === 'archive' || action === 'unarchive') {
    state = setHabitArchived(state, id, action === 'archive');
    persist();
    view.focus = `archive:${id}`;
    if (action === 'archive') view.archivedOpen = true;
    drawNow();
    return;
  }
  if (action === 'delete') {
    view.deleteId = id;
    view.editId = null;
    view.focus = `delete-no:${id}`;
    drawNow();
    return;
  }
  if (action === 'delete-yes') {
    state = deleteHabit(state, id);
    persist();
    view.deleteId = null;
    drawNow();
    return;
  }
  if (action === 'delete-no') {
    view.deleteId = null;
    view.focus = `delete:${id}`;
    drawNow();
    return;
  }
  if (action === 'toggle-archived') {
    view.archivedOpen = !view.archivedOpen;
    view.focus = 'archived-toggle';
    drawNow();
  }
}

function onChange(event: Event) {
  const target = event.target;
  if (target instanceof HTMLInputElement && target.dataset.action === 'check' && target.dataset.habit) {
    view.message = null;
    state = setHabitDone(state, target.dataset.habit, todayIso(), target.checked, todayIso());
    persist();
    drawNow();
    return;
  }
  if (target instanceof HTMLSelectElement && target.dataset.action === 'week-start') {
    view.message = null;
    state = updateSettings(state, { weekStartsOn: target.value === '1' ? 1 : 0 });
    persist();
    drawNow();
    return;
  }
  if (target instanceof HTMLSelectElement && target.dataset.action === 'theme') {
    const theme: Theme = target.value === 'light' || target.value === 'dark' ? target.value : 'system';
    view.message = null;
    state = updateSettings(state, { theme });
    persist();
    applyTheme(theme);
    drawNow();
    return;
  }
  if (target instanceof HTMLSelectElement && target.dataset.action === 'set-mode' && target.dataset.habit) {
    const habit = habitById(target.dataset.habit);
    if (!habit) return;
    const mode: HabitMode = target.value === 'weekly' ? 'weekly' : 'daily';
    view.message = null;
    state = setHabitSchedule(state, habit.id, mode, habit.target);
    persist();
    view.focus = `mode:${habit.id}`;
    drawNow();
    return;
  }
  if (target instanceof HTMLInputElement && target.dataset.action === 'set-color' && target.dataset.habit) {
    view.message = null;
    state = setHabitColor(state, target.dataset.habit, target.value);
    persist();
    drawNow();
    return;
  }
  if (target instanceof HTMLSelectElement && target.name === 'mode' && target.form?.dataset.form === 'add') {
    const form = target.form;
    const weekly = target.value === 'weekly';
    const goal = form.elements.namedItem('target');
    const suffix = form.querySelector('[data-goal-suffix]');
    if (goal instanceof HTMLInputElement) {
      goal.max = weekly ? '7' : '99';
      if (Number(goal.value) > Number(goal.max)) goal.value = goal.max;
    }
    if (suffix) suffix.textContent = weekly ? 'per week' : 'per day';
    return;
  }
  if (target instanceof HTMLInputElement && target.dataset.action === 'import-file') {
    const file = target.files?.[0];
    target.value = '';
    if (file) readImport(file);
  }
}

function onInput(event: Event) {
  const target = event.target;
  if (!(target instanceof HTMLInputElement) || !target.dataset.habit) return;
  if (target.dataset.action === 'rename') {
    const next = renameHabit(state, target.dataset.habit, target.value);
    if (next !== state) {
      state = next;
      persist();
    }
    const trimmed = target.value.trim();
    const label = app.querySelector(`[data-name-for="${target.dataset.habit}"]`);
    if (label && trimmed) label.textContent = trimmed;
    return;
  }
  if (target.dataset.action === 'goal') {
    const habit = habitById(target.dataset.habit);
    if (!habit) return;
    const value = Number(target.value);
    if (!Number.isInteger(value) || value < 1) return;
    const next = setHabitSchedule(state, habit.id, habit.mode, value);
    if (next !== state) {
      state = next;
      persist();
    }
  }
}

function onFocusOut(event: Event) {
  const target = event.target;
  if (!(target instanceof HTMLInputElement) || target.dataset.action !== 'goal' || !target.dataset.habit) return;
  const habit = habitById(target.dataset.habit);
  if (!habit) return;
  const next = setHabitSchedule(state, habit.id, habit.mode, Number(target.value));
  if (next === state) return;
  state = next;
  persist();
  requestDraw();
}

function onSubmit(event: Event) {
  const form = event.target;
  if (!(form instanceof HTMLFormElement)) return;
  event.preventDefault();
  if (form.dataset.form === 'add') submitAdd(form);
  if (form.dataset.form === 'edit') {
    view.editId = null;
    view.focus = form.dataset.habit ? `edit:${form.dataset.habit}` : null;
    drawNow();
  }
}

function onKeyDown(event: KeyboardEvent) {
  if (
    event.key === 'Enter' &&
    event.target instanceof HTMLInputElement &&
    event.target.dataset.action === 'rename'
  ) {
    event.preventDefault();
    const id = event.target.dataset.habit ?? '';
    view.editId = null;
    view.focus = id ? `edit:${id}` : null;
    drawNow();
    return;
  }
  if (event.key === 'Escape') {
    if (view.deleteId) {
      const id = view.deleteId;
      view.deleteId = null;
      view.focus = `delete:${id}`;
      event.preventDefault();
      drawNow();
      return;
    }
    if (view.editId) {
      const id = view.editId;
      view.editId = null;
      view.focus = `edit:${id}`;
      event.preventDefault();
      drawNow();
    }
    return;
  }

  if (!(event.target instanceof HTMLButtonElement) || !event.target.classList.contains('cell')) return;
  const delta = { ArrowLeft: -7, ArrowRight: 7, ArrowUp: -1, ArrowDown: 1 }[event.key];
  if (!delta) return;
  event.preventDefault();
  moveCell(event.target, delta);
}

app.addEventListener('click', onClick);
app.addEventListener('change', onChange);
app.addEventListener('input', onInput);
app.addEventListener('focusout', onFocusOut);
app.addEventListener('submit', onSubmit);
app.addEventListener('keydown', onKeyDown);

window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
  if (state.settings.theme === 'system') applyTheme('system');
});

draw();
