import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { describe, expect, it } from 'vitest';

type Edge = [string, string];

type ZoneReport = {
  tz: string;
  early: string;
  late: string;
  earlyUtc: string;
  lateUtc: string;
  edges: { from: string; to: string; stepped: string; offsetFrom: number; offsetTo: number }[];
  walks: { start: string; end: string; mismatches: string[]; transitions: number }[];
  weekOfMarch9: { sunday: string; monday: string };
};

const zones: { tz: string; edges: Edge[] }[] = [
  {
    tz: 'America/Los_Angeles',
    edges: [
      ['2026-03-08', '2026-03-09'],
      ['2026-11-01', '2026-11-02'],
      ['2024-03-10', '2024-03-11'],
      ['2024-11-03', '2024-11-04'],
    ],
  },
  {
    tz: 'Pacific/Auckland',
    edges: [
      ['2026-04-05', '2026-04-06'],
      ['2026-09-27', '2026-09-28'],
    ],
  },
  {
    tz: 'UTC',
    edges: [],
  },
];

function runZone(tz: string, edges: Edge[]): ZoneReport {
  const moduleUrl = pathToFileURL(fileURLToPath(new URL('./dates.ts', import.meta.url))).href;
  const script = `
    import { addDays, fromDate, startOfWeek, toDate } from ${JSON.stringify(moduleUrl)};

    function nextCalendar(iso) {
      const [year, month, day] = iso.split('-').map(Number);
      const leap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
      const lengths = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
      let nextDay = day + 1;
      let nextMonth = month;
      let nextYear = year;
      if (nextDay > lengths[month - 1]) {
        nextDay = 1;
        nextMonth += 1;
        if (nextMonth > 12) {
          nextMonth = 1;
          nextYear += 1;
        }
      }
      const pad = (value) => String(value).padStart(2, '0');
      return String(nextYear).padStart(4, '0') + '-' + pad(nextMonth) + '-' + pad(nextDay);
    }

    function walk(start, steps) {
      let day = start;
      let previousOffset = null;
      let transitions = 0;
      const mismatches = [];
      for (let index = 0; index < steps; index += 1) {
        const offset = toDate(day).getTimezoneOffset();
        if (previousOffset !== null && offset !== previousOffset) transitions += 1;
        previousOffset = offset;
        const next = addDays(day, 1);
        const expected = nextCalendar(day);
        if (next !== expected) mismatches.push(day + ' -> ' + next + ' (expected ' + expected + ')');
        day = next;
      }
      return { start, end: day, mismatches, transitions };
    }

    const edges = ${JSON.stringify(edges)}.map(([from, to]) => ({
      from,
      to,
      stepped: addDays(from, 1),
      offsetFrom: toDate(from).getTimezoneOffset(),
      offsetTo: toDate(to).getTimezoneOffset(),
    }));

    const early = new Date(2026, 0, 1, 0, 30);
    const late = new Date(2026, 0, 1, 23, 30);
    const report = {
      tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
      early: fromDate(early),
      late: fromDate(late),
      earlyUtc: early.toISOString().slice(0, 10),
      lateUtc: late.toISOString().slice(0, 10),
      edges,
      walks: [walk('2024-01-01', 366), walk('2026-01-01', 365)],
      weekOfMarch9: {
        sunday: startOfWeek('2026-03-09', 0),
        monday: startOfWeek('2026-03-09', 1),
      },
    };
    process.stdout.write(JSON.stringify(report));
  `;

  const result = spawnSync(
    process.execPath,
    ['--experimental-strip-types', '--input-type=module', '--eval', script],
    {
      env: { ...process.env, TZ: tz, NODE_NO_WARNINGS: '1' },
      encoding: 'utf8',
    },
  );

  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || `${tz} exited ${result.status}`);
  }

  return JSON.parse(result.stdout) as ZoneReport;
}

describe('local dates across time zones', () => {
  for (const zone of zones) {
    it(`keeps the calendar day in ${zone.tz}`, () => {
      const report = runZone(zone.tz, zone.edges);
      expect(report.tz).toBe(zone.tz);
      expect(report.early).toBe('2026-01-01');
      expect(report.late).toBe('2026-01-01');

      if (zone.tz === 'UTC') {
        expect(report.earlyUtc).toBe('2026-01-01');
        expect(report.lateUtc).toBe('2026-01-01');
      } else {
        const utcAgrees = report.earlyUtc === '2026-01-01' && report.lateUtc === '2026-01-01';
        expect(utcAgrees).toBe(false);
      }

      for (const edge of report.edges) {
        expect(edge.stepped).toBe(edge.to);
        expect(edge.offsetFrom).not.toBe(edge.offsetTo);
      }

      expect(report.walks[0]).toMatchObject({
        start: '2024-01-01',
        end: '2025-01-01',
        mismatches: [],
      });
      expect(report.walks[1]).toMatchObject({
        start: '2026-01-01',
        end: '2027-01-01',
        mismatches: [],
      });

      if (zone.tz === 'UTC') {
        expect(report.walks[0]?.transitions).toBe(0);
        expect(report.walks[1]?.transitions).toBe(0);
      } else {
        expect(report.walks[1]?.transitions).toBeGreaterThan(0);
      }

      expect(report.weekOfMarch9).toEqual({
        sunday: '2026-03-08',
        monday: '2026-03-09',
      });
    });
  }
});
