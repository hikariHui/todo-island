import { createDAVClient, type DAVCalendar } from "tsdav";
import {
  formatIcalDateOnly,
  isAllDayDue,
  nextDateOnly,
  splitDueAt,
} from "./due";
import { zonedLocalToUtc } from "./timezone";
import type { Todo } from "./types";

type CalDavClient = Awaited<ReturnType<typeof createDAVClient>>;

const APP_NAME = "Todo Island";
const PRODID = "-//Todo Island//todo-list//ZH";
const DEFAULT_DURATION_MS = 60 * 60 * 1000; // 1 hour
const MANAGED_FOOTER = [
  "——",
  `由 ${APP_NAME} 管理`,
  "请在本应用内编辑或删除；日历中的改动不会回写到应用。",
].join("\n");

type SyncResult = {
  calendarUid: string | null;
  calendarObjectUrl: string | null;
  calendarSequence: number;
  calendarSyncError: string | null;
};

function isIcloudConfigured(): boolean {
  return Boolean(
    process.env.ICLOUD_APPLE_ID && process.env.ICLOUD_APP_PASSWORD,
  );
}

export function icloudConfigured(): boolean {
  return isIcloudConfigured();
}

function escapeText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}

function formatIcalUtc(date: Date): string {
  return date
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}Z$/, "Z");
}

function formatCompletedAt(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("zh-CN", {
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function objectUrlFor(calendar: DAVCalendar, uid: string): string {
  const base = calendar.url.endsWith("/") ? calendar.url : `${calendar.url}/`;
  return new URL(`${uid}.ics`, base).href;
}

function buildIcal(todo: Todo, uid: string, sequence: number): string {
  if (!todo.dueAt) {
    throw new Error("缺少 dueAt，无法同步到日历");
  }

  const stamp = formatIcalUtc(new Date());
  const lastModified = formatIcalUtc(new Date(todo.updatedAt || Date.now()));
  const summary = escapeText(todo.title);
  const tagLine =
    todo.tags.length > 0 ? `标签: ${todo.tags.join("、")}` : null;
  const statusLine = todo.completed
    ? `状态: 已完成${todo.completedAt ? `（${formatCompletedAt(todo.completedAt)}）` : ""}`
    : "状态: 未完成";
  const description = escapeText(
    [tagLine, statusLine, "", MANAGED_FOOTER]
      .filter((line) => line !== null)
      .join("\n"),
  );
  const categories = [APP_NAME, ...todo.tags]
    .map((item) => escapeText(item))
    .join(",");

  let dtStart: string;
  let dtEnd: string;

  if (isAllDayDue(todo.dueAt)) {
    const start = formatIcalDateOnly(todo.dueAt);
    const end = formatIcalDateOnly(nextDateOnly(todo.dueAt));
    dtStart = `DTSTART;VALUE=DATE:${start}`;
    dtEnd = `DTEND;VALUE=DATE:${end}`;
  } else {
    const { date, time } = splitDueAt(todo.dueAt);
    if (!date || !time) {
      throw new Error(`无效的 dueAt: ${todo.dueAt}`);
    }
    const start = zonedLocalToUtc(date, time);
    if (Number.isNaN(start.getTime())) {
      throw new Error(`无效的 dueAt: ${todo.dueAt}`);
    }
    const end = new Date(start.getTime() + DEFAULT_DURATION_MS);
    dtStart = `DTSTART:${formatIcalUtc(start)}`;
    dtEnd = `DTEND:${formatIcalUtc(end)}`;
  }

  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    `PRODID:${PRODID}`,
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${stamp}`,
    `LAST-MODIFIED:${lastModified}`,
    `SEQUENCE:${sequence}`,
    dtStart,
    dtEnd,
    `SUMMARY:${summary}`,
    `DESCRIPTION:${description}`,
    `CATEGORIES:${categories}`,
    `X-TODO-ISLAND-MANAGED:TRUE`,
    `X-TODO-ISLAND-ID:${todo.id}`,
    `URL:todo-island://todo/${todo.id}`,
    `STATUS:${todo.completed ? "COMPLETED" : "CONFIRMED"}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
}

async function getClient(): Promise<CalDavClient> {
  const username = process.env.ICLOUD_APPLE_ID!;
  const password = process.env.ICLOUD_APP_PASSWORD!;
  return createDAVClient({
    serverUrl: "https://caldav.icloud.com",
    credentials: { username, password },
    authMethod: "Basic",
    defaultAccountType: "caldav",
  });
}

async function resolveCalendar(client: CalDavClient): Promise<DAVCalendar> {
  const calendars = await client.fetchCalendars();
  if (!calendars.length) {
    throw new Error("未找到可用的 iCloud 日历");
  }

  const preferredName = process.env.ICLOUD_CALENDAR_NAME?.trim();
  if (preferredName) {
    const matched = calendars.find(
      (c) => (c.displayName || "").toString() === preferredName,
    );
    if (!matched) {
      const names = calendars
        .map((c) => (c.displayName || "").toString())
        .filter(Boolean)
        .join(", ");
      throw new Error(
        `未找到名为「${preferredName}」的日历。可用日历: ${names || "(无名称)"}`,
      );
    }
    return matched;
  }

  return calendars[0];
}

async function deleteRemoteEvent(
  client: CalDavClient,
  calendarObjectUrl: string | null,
): Promise<void> {
  if (!calendarObjectUrl) return;
  const response = await client.deleteCalendarObject({
    calendarObject: {
      url: calendarObjectUrl,
      data: "",
      etag: "",
    },
  });
  // 404 = already gone, treat as success
  if (!response.ok && response.status !== 404) {
    const body = await response.text().catch(() => "");
    throw new Error(
      `删除日历事件失败 (${response.status}): ${body.slice(0, 200)}`,
    );
  }
}

async function createRemoteEvent(
  client: CalDavClient,
  calendar: DAVCalendar,
  todo: Todo,
  uid: string,
  iCalString: string,
): Promise<string> {
  const filename = `${uid}.ics`;
  const response = await client.createCalendarObject({
    calendar,
    filename,
    iCalString,
  });

  if (!response.ok) {
    // 412: already exists — fall back to update
    if (response.status === 412) {
      const url = objectUrlFor(calendar, uid);
      const update = await client.updateCalendarObject({
        calendarObject: {
          url,
          data: iCalString,
          etag: "",
        },
      });
      if (!update.ok) {
        const body = await update.text().catch(() => "");
        throw new Error(
          `更新日历事件失败 (${update.status}): ${body.slice(0, 200)}`,
        );
      }
      return url;
    }
    const body = await response.text().catch(() => "");
    throw new Error(
      `创建日历事件失败 (${response.status}): ${body.slice(0, 200)}`,
    );
  }

  return objectUrlFor(calendar, uid);
}

/**
 * Sync a todo that has dueAt to iCloud Calendar.
 * - no dueAt / not configured: clear remote event if any
 * - has dueAt: create or update VEVENT
 */
export async function syncTodoToIcloud(todo: Todo): Promise<SyncResult> {
  if (!isIcloudConfigured()) {
    return {
      calendarUid: todo.calendarUid,
      calendarObjectUrl: todo.calendarObjectUrl,
      calendarSequence: todo.calendarSequence ?? 0,
      calendarSyncError: null,
    };
  }

  try {
    const client = await getClient();

    if (!todo.dueAt) {
      if (todo.calendarObjectUrl || todo.calendarUid) {
        const calendar = await resolveCalendar(client);
        const url =
          todo.calendarObjectUrl ||
          (todo.calendarUid
            ? objectUrlFor(calendar, todo.calendarUid)
            : null);
        await deleteRemoteEvent(client, url);
      }
      return {
        calendarUid: null,
        calendarObjectUrl: null,
        calendarSequence: 0,
        calendarSyncError: null,
      };
    }

    const calendar = await resolveCalendar(client);
    const uid = todo.calendarUid || crypto.randomUUID();
    const sequence = todo.calendarUid
      ? Math.max(1, (todo.calendarSequence ?? 0) + 1)
      : 0;
    const iCalString = buildIcal(todo, uid, sequence);
    const existingUrl =
      todo.calendarObjectUrl || objectUrlFor(calendar, uid);

    if (todo.calendarObjectUrl || todo.calendarUid) {
      const update = await client.updateCalendarObject({
        calendarObject: {
          url: existingUrl,
          data: iCalString,
          etag: "",
        },
      });

      if (update.ok || update.status === 204) {
        return {
          calendarUid: uid,
          calendarObjectUrl: existingUrl,
          calendarSequence: sequence,
          calendarSyncError: null,
        };
      }

      // Missing remotely — recreate
      if (update.status === 404) {
        const createdUrl = await createRemoteEvent(
          client,
          calendar,
          todo,
          uid,
          iCalString,
        );
        return {
          calendarUid: uid,
          calendarObjectUrl: createdUrl,
          calendarSequence: sequence,
          calendarSyncError: null,
        };
      }

      const body = await update.text().catch(() => "");
      throw new Error(
        `更新日历事件失败 (${update.status}): ${body.slice(0, 200)}`,
      );
    }

    const createdUrl = await createRemoteEvent(
      client,
      calendar,
      todo,
      uid,
      iCalString,
    );
    return {
      calendarUid: uid,
      calendarObjectUrl: createdUrl,
      calendarSequence: sequence,
      calendarSyncError: null,
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "iCloud 同步失败";
    console.error("[icloud]", message, error);
    return {
      calendarUid: todo.calendarUid,
      calendarObjectUrl: todo.calendarObjectUrl,
      calendarSequence: todo.calendarSequence ?? 0,
      calendarSyncError: message,
    };
  }
}

export async function removeTodoFromIcloud(todo: {
  calendarUid?: string | null;
  calendarObjectUrl?: string | null;
}): Promise<{ calendarSyncError: string | null }> {
  if (!isIcloudConfigured()) {
    return { calendarSyncError: null };
  }
  if (!todo.calendarObjectUrl && !todo.calendarUid) {
    return { calendarSyncError: null };
  }

  try {
    const client = await getClient();
    const calendar = await resolveCalendar(client);
    const url =
      todo.calendarObjectUrl ||
      (todo.calendarUid ? objectUrlFor(calendar, todo.calendarUid) : null);
    await deleteRemoteEvent(client, url);
    return { calendarSyncError: null };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "iCloud 删除失败";
    console.error("[icloud] delete failed", message, error);
    return { calendarSyncError: message };
  }
}

export function icloudStatus(): {
  configured: boolean;
  calendarName: string | null;
} {
  return {
    configured: isIcloudConfigured(),
    calendarName: process.env.ICLOUD_CALENDAR_NAME?.trim() || null,
  };
}
