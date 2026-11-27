// Calendar days in the local timezone, stored as YYYY-MM-DD.
// Stepping uses local Date setters, so a day stays a calendar day across DST
// instead of sliding when 24 hours is not the length of the local day.

export type IsoDate = string;

export type WeekStartsOn = 0 | 1;

const WEEKDAYS = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
] as const;

const WEEKDAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;

export const MONTHS_SHORT = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const;

function pad(value: number, width: number): string {
  return String(value).padStart(width, '0');
}

export function isoDate(year: number, month: number, day: number): IsoDate {
  return `${pad(year, 4)}-${pad(month, 2)}-${pad(day, 2)}`;
}

export function parts(iso: IsoDate): { year: number; month: number; day: number } {
  const [year, month, day] = iso.split('-').map(Number);
  return { year, month, day };
}

export function isValidIso(value: string): value is IsoDate {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const { year, month, day } = parts(value);
  if (month < 1 || month > 12 || day < 1 || day > 31) return false;
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

export function fromDate(date: Date): IsoDate {
  return isoDate(date.getFullYear(), date.getMonth() + 1, date.getDate());
}

export function todayIso(now: Date = new Date()): IsoDate {
  return fromDate(now);
}

export function toDate(iso: IsoDate): Date {
  const { year, month, day } = parts(iso);
  return new Date(year, month - 1, day);
}

export function addDays(iso: IsoDate, days: number): IsoDate {
  const date = toDate(iso);
  date.setDate(date.getDate() + days);
  return fromDate(date);
}

export function weekday(iso: IsoDate): number {
  return toDate(iso).getDay();
}

export function startOfWeek(iso: IsoDate, weekStartsOn: WeekStartsOn): IsoDate {
  const delta = (weekday(iso) - weekStartsOn + 7) % 7;
  return addDays(iso, -delta);
}

export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

export function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

export function daysInYear(year: number): number {
  return isLeapYear(year) ? 366 : 365;
}

export type GridDay = {
  date: IsoDate;
  inYear: boolean;
};

export function yearWeeks(year: number, weekStartsOn: WeekStartsOn): GridDay[][] {
  const first = startOfWeek(isoDate(year, 1, 1), weekStartsOn);
  const last = startOfWeek(isoDate(year, 12, 31), weekStartsOn);
  const weeks: GridDay[][] = [];
  for (let week = first; week <= last; week = addDays(week, 7)) {
    const days: GridDay[] = [];
    for (let index = 0; index < 7; index += 1) {
      const date = addDays(week, index);
      days.push({ date, inYear: parts(date).year === year });
    }
    weeks.push(days);
  }
  return weeks;
}

export function monthLabels(weeks: GridDay[][]): { column: number; label: string }[] {
  const labels: { column: number; label: string }[] = [];
  weeks.forEach((week, column) => {
    const firstOfMonth = week.find((day) => day.inYear && parts(day.date).day === 1);
    if (!firstOfMonth) return;
    labels.push({ column, label: MONTHS_SHORT[parts(firstOfMonth.date).month - 1] });
  });
  return labels;
}

export function formatFull(iso: IsoDate): string {
  const { year, month, day } = parts(iso);
  return `${WEEKDAYS[weekday(iso)]}, ${MONTHS[month - 1]} ${day}, ${year}`;
}

export function formatShort(iso: IsoDate): string {
  const { month, day } = parts(iso);
  return `${WEEKDAYS_SHORT[weekday(iso)]} ${MONTHS_SHORT[month - 1]} ${day}`;
}

export function gutterMarks(weekStartsOn: WeekStartsOn): string[] {
  return Array.from({ length: 7 }, (_, index) => {
    const day = (weekStartsOn + index) % 7;
    if (day === 1 || day === 3 || day === 5) return WEEKDAYS[day].slice(0, 1);
    return '';
  });
}
