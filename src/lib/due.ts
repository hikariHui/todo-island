/** dueAt: null=待定；YYYY-MM-DD=全天；YYYY-MM-DDTHH:mm:ss=定点（按 APP_TIMEZONE 解释） */

import { zonedLocalToUtc } from "./timezone";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const DATETIME_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/;

export function isAllDayDue(dueAt: string | null | undefined): boolean {
  return Boolean(dueAt && DATE_RE.test(dueAt));
}

export function isTimedDue(dueAt: string | null | undefined): boolean {
  return Boolean(dueAt && DATETIME_RE.test(dueAt));
}

export function splitDueAt(dueAt: string | null | undefined): {
  date: string | null;
  time: string | null;
  allDay: boolean;
} {
  if (!dueAt) return { date: null, time: null, allDay: true };
  if (DATE_RE.test(dueAt)) {
    return { date: dueAt, time: null, allDay: true };
  }
  const [date, timePart] = dueAt.split("T");
  if (!date || !DATE_RE.test(date)) {
    return { date: null, time: null, allDay: true };
  }
  let time = (timePart || "").slice(0, 8);
  if (time.length === 5) time = `${time}:00`;
  if (!/^\d{2}:\d{2}:\d{2}$/.test(time)) {
    return { date, time: null, allDay: true };
  }
  return { date, time, allDay: false };
}

/**
 * @param date YYYY-MM-DD or null
 * @param timed whether user expanded precise time
 * @param time HH:mm or HH:mm:ss when timed
 */
export function joinDueAt(
  date: string | null,
  timed: boolean,
  time: string | null,
): string | null {
  if (!date || !DATE_RE.test(date)) return null;
  if (!timed || !time) return date;
  let t = time.slice(0, 8);
  if (t.length === 5) t = `${t}:00`;
  if (!/^\d{2}:\d{2}:\d{2}$/.test(t)) return date;
  return `${date}T${t}`;
}

export function formatDueLabel(dueAt: string | null | undefined): string {
  if (!dueAt) return "待定";
  const { date, time, allDay } = splitDueAt(dueAt);
  if (!date) return "待定";

  const [y, m, d] = date.split("-").map(Number);
  const dateText = `${m}月${d}日`;
  if (allDay || !time) return `${dateText} · 全天`;

  const [hh, mm] = time.split(":");
  return `${dateText} ${hh}:${mm}`;
}

/** For sorting: all-day / timed use APP_TIMEZONE wall clock */
export function dueSortKey(dueAt: string | null | undefined): number {
  if (!dueAt) return Number.POSITIVE_INFINITY;
  if (DATE_RE.test(dueAt)) {
    return zonedLocalToUtc(dueAt, "00:00:00").getTime();
  }
  const { date, time } = splitDueAt(dueAt);
  if (!date || !time) return Number.POSITIVE_INFINITY;
  return zonedLocalToUtc(date, time).getTime();
}

export function formatIcalDateOnly(date: string): string {
  return date.replace(/-/g, "");
}

/** Exclusive end date for all-day events (next calendar day, date-only math) */
export function nextDateOnly(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  const utc = new Date(Date.UTC(y, m - 1, d));
  utc.setUTCDate(utc.getUTCDate() + 1);
  const yy = utc.getUTCFullYear();
  const mm = String(utc.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(utc.getUTCDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}
