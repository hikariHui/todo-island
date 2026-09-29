/**
 * dueAt 编码（与排期状态对应）：
 * - null：未排期（不同步日历）
 * - YYYY：待确定（仅年）
 * - YYYY-MM：待确定（仅月）
 * - YYYY-MM-DD：已排期 · 全天（同步日历）
 * - YYYY-MM-DDTHH:mm:ss：已排期 · 定点（同步日历，按 APP_TIMEZONE）
 */

import { getAppTimeZone, zonedLocalToUtc } from "./timezone";

const YEAR_RE = /^\d{4}$/;
const MONTH_RE = /^\d{4}-\d{2}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const DATETIME_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/;

export type ScheduleState = "unscheduled" | "tentative" | "scheduled";

/** 0=年 1=月 2=日 3=定点（越模糊越靠前） */
export type DuePrecision = 0 | 1 | 2 | 3;

export type DueDraft = {
  kind: "none" | "year" | "month" | "day";
  /** YYYY */
  year: string | null;
  /** MM */
  month: string | null;
  /** YYYY-MM-DD */
  date: string | null;
  timed: boolean;
  time: string | null;
};

export function emptyDueDraft(): DueDraft {
  return {
    kind: "none",
    year: null,
    month: null,
    date: null,
    timed: false,
    time: null,
  };
}

export function getScheduleState(
  dueAt: string | null | undefined,
): ScheduleState {
  if (!dueAt) return "unscheduled";
  if (YEAR_RE.test(dueAt) || MONTH_RE.test(dueAt)) return "tentative";
  return "scheduled";
}

export function isCalendarSyncable(
  dueAt: string | null | undefined,
): boolean {
  return getScheduleState(dueAt) === "scheduled";
}

export function isYearDue(dueAt: string | null | undefined): boolean {
  return Boolean(dueAt && YEAR_RE.test(dueAt));
}

export function isMonthDue(dueAt: string | null | undefined): boolean {
  return Boolean(dueAt && MONTH_RE.test(dueAt));
}

export function isAllDayDue(dueAt: string | null | undefined): boolean {
  return Boolean(dueAt && DATE_RE.test(dueAt));
}

export function isTimedDue(dueAt: string | null | undefined): boolean {
  return Boolean(dueAt && DATETIME_RE.test(dueAt));
}

export function duePrecision(dueAt: string | null | undefined): DuePrecision {
  if (!dueAt) return 0;
  if (YEAR_RE.test(dueAt)) return 0;
  if (MONTH_RE.test(dueAt)) return 1;
  if (DATE_RE.test(dueAt)) return 2;
  if (DATETIME_RE.test(dueAt)) return 3;
  return 2;
}

export function splitDueAt(dueAt: string | null | undefined): {
  date: string | null;
  time: string | null;
  allDay: boolean;
} {
  if (!dueAt) return { date: null, time: null, allDay: true };
  if (YEAR_RE.test(dueAt) || MONTH_RE.test(dueAt)) {
    return { date: null, time: null, allDay: true };
  }
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

export function dueDraftFromDueAt(dueAt: string | null | undefined): DueDraft {
  if (!dueAt) return emptyDueDraft();
  if (YEAR_RE.test(dueAt)) {
    return {
      kind: "year",
      year: dueAt,
      month: null,
      date: null,
      timed: false,
      time: null,
    };
  }
  if (MONTH_RE.test(dueAt)) {
    const [y, m] = dueAt.split("-");
    return {
      kind: "month",
      year: y,
      month: m,
      date: null,
      timed: false,
      time: null,
    };
  }
  const parts = splitDueAt(dueAt);
  return {
    kind: "day",
    year: parts.date?.slice(0, 4) ?? null,
    month: parts.date?.slice(5, 7) ?? null,
    date: parts.date,
    timed: !parts.allDay,
    time: parts.time,
  };
}

export function joinDueFromDraft(draft: DueDraft): string | null {
  if (draft.kind === "none") return null;
  if (draft.kind === "year") {
    return draft.year && YEAR_RE.test(draft.year) ? draft.year : null;
  }
  if (draft.kind === "month") {
    if (!draft.year || !draft.month) return null;
    const key = `${draft.year}-${draft.month}`;
    return MONTH_RE.test(key) ? key : null;
  }
  return joinDueAt(draft.date, draft.timed, draft.time);
}

/** 提交前校验排期草稿是否完整（避免 kind≠none 却写入 null 清空 dueAt）。 */
export function validateDueDraftForSubmit(
  draft: DueDraft,
):
  | { ok: true; dueAt: string | null }
  | { ok: false; message: string } {
  if (draft.kind === "none") {
    return { ok: true, dueAt: null };
  }
  const dueAt = joinDueFromDraft(draft);
  if (dueAt !== null) {
    return { ok: true, dueAt };
  }
  if (draft.kind === "year") {
    return { ok: false, message: "请选择年份" };
  }
  if (draft.kind === "month") {
    return { ok: false, message: "请选择月份" };
  }
  return { ok: false, message: "请选择具体日期" };
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
  if (!dueAt) return "未排期";
  if (YEAR_RE.test(dueAt)) return `${dueAt}年`;
  if (MONTH_RE.test(dueAt)) {
    const [y, m] = dueAt.split("-").map(Number);
    return `${y}年${m}月`;
  }
  const { date, time, allDay } = splitDueAt(dueAt);
  if (!date) return "未排期";

  const [, m, d] = date.split("-").map(Number);
  const dateText = `${m}月${d}日`;
  if (allDay || !time) return `${dateText} · 全天`;

  const [hh, mm] = time.split(":");
  return `${dateText} ${hh}:${mm}`;
}

export function scheduleStateLabel(state: ScheduleState): string {
  if (state === "unscheduled") return "未排期";
  if (state === "tentative") return "待确定";
  return "已排期";
}

export function startOfTodayUtcMs(
  timeZone: string = getAppTimeZone(),
): number {
  const now = new Date();
  const dtf = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const dateKey = dtf.format(now);
  return zonedLocalToUtc(dateKey, "00:00:00", timeZone).getTime();
}

export type DueInterval = {
  startMs: number;
  endMs: number;
  precision: DuePrecision;
};

function endOfDayUtcMs(date: string, timeZone: string): number {
  return zonedLocalToUtc(date, "23:59:59", timeZone).getTime();
}

function lastDayOfMonth(year: number, month1: number): number {
  return new Date(Date.UTC(year, month1, 0)).getUTCDate();
}

/** 将 dueAt 解析为业务时区下的时间区间（用于排序）。 */
export function parseDueInterval(
  dueAt: string,
  timeZone: string = getAppTimeZone(),
): DueInterval {
  if (YEAR_RE.test(dueAt)) {
    const y = Number(dueAt);
    const start = zonedLocalToUtc(`${y}-01-01`, "00:00:00", timeZone).getTime();
    const end = endOfDayUtcMs(
      `${y}-12-${String(lastDayOfMonth(y, 12)).padStart(2, "0")}`,
      timeZone,
    );
    return { startMs: start, endMs: end, precision: 0 };
  }
  if (MONTH_RE.test(dueAt)) {
    const [ys, ms] = dueAt.split("-");
    const y = Number(ys);
    const m = Number(ms);
    const last = lastDayOfMonth(y, m);
    const mm = String(m).padStart(2, "0");
    const start = zonedLocalToUtc(`${y}-${mm}-01`, "00:00:00", timeZone).getTime();
    const end = endOfDayUtcMs(
      `${y}-${mm}-${String(last).padStart(2, "0")}`,
      timeZone,
    );
    return { startMs: start, endMs: end, precision: 1 };
  }
  if (DATE_RE.test(dueAt)) {
    const start = zonedLocalToUtc(dueAt, "00:00:00", timeZone).getTime();
    const end = endOfDayUtcMs(dueAt, timeZone);
    return { startMs: start, endMs: end, precision: 2 };
  }
  const { date, time } = splitDueAt(dueAt);
  if (date && time) {
    const instant = zonedLocalToUtc(date, time, timeZone).getTime();
    return { startMs: instant, endMs: instant, precision: 3 };
  }
  const start = zonedLocalToUtc(dueAt.slice(0, 10), "00:00:00", timeZone).getTime();
  return { startMs: start, endMs: start, precision: 2 };
}

function compareDatedIncomplete(
  dueA: string,
  dueB: string,
  timeZone: string,
): number {
  const todayStart = startOfTodayUtcMs(timeZone);
  const intA = parseDueInterval(dueA, timeZone);
  const intB = parseDueInterval(dueB, timeZone);

  const aExpired = intA.endMs < todayStart;
  const bExpired = intB.endMs < todayStart;

  // 已过期：越早过期越靠前（2025 在 2026-08 之前）
  if (aExpired && bExpired) {
    if (intA.startMs !== intB.startMs) return intA.startMs - intB.startMs;
    if (intA.precision !== intB.precision) return intA.precision - intB.precision;
    if (intA.endMs !== intB.endMs) return intA.endMs - intB.endMs;
    return dueA.localeCompare(dueB);
  }
  if (aExpired !== bExpired) return aExpired ? -1 : 1;

  if (intA.startMs !== intB.startMs) return intA.startMs - intB.startMs;
  if (intA.precision !== intB.precision) return intA.precision - intB.precision;
  if (intA.endMs !== intB.endMs) return intA.endMs - intB.endMs;
  return dueA.localeCompare(dueB);
}

export type TodoOrderFields = {
  dueAt: string | null;
  completed: boolean;
  completedAt: string | null;
  updatedAt: string;
};

/** 列表持久化顺序的比较器（与 readStore 迁移、插入时排序一致）。 */
export function compareTodoOrder(
  a: TodoOrderFields,
  b: TodoOrderFields,
  timeZone: string = getAppTimeZone(),
): number {
  if (a.completed !== b.completed) return a.completed ? 1 : -1;

  if (!a.completed) {
    const aState = getScheduleState(a.dueAt);
    const bState = getScheduleState(b.dueAt);

    if (aState === "unscheduled" && bState !== "unscheduled") return -1;
    if (bState === "unscheduled" && aState !== "unscheduled") return 1;
    if (aState === "unscheduled" && bState === "unscheduled") {
      return Date.parse(b.updatedAt) - Date.parse(a.updatedAt);
    }

    const dueA = a.dueAt!;
    const dueB = b.dueAt!;
    const dated = compareDatedIncomplete(dueA, dueB, timeZone);
    if (dated !== 0) return dated;
    return Date.parse(b.updatedAt) - Date.parse(a.updatedAt);
  }

  const ac = Date.parse(a.completedAt || a.updatedAt);
  const bc = Date.parse(b.completedAt || b.updatedAt);
  return bc - ac;
}

export function findTodoInsertIndex<T extends TodoOrderFields>(
  todos: T[],
  todo: T,
  timeZone?: string,
): number {
  for (let i = 0; i < todos.length; i += 1) {
    if (compareTodoOrder(todo, todos[i], timeZone) < 0) return i;
  }
  return todos.length;
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
