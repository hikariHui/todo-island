import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { icloudConfigured } from "@/lib/icloud";
import { enqueueIcloudUpsert, startIcloudQueueWorker } from "@/lib/icloud-queue";
import { isCalendarSyncable } from "@/lib/due";
import { getTodo } from "@/lib/store";

startIcloudQueueWorker();

type Ctx = { params: Promise<{ id: string }> };

/** Re-enqueue calendar sync after a previous failure. */
export async function POST(_request: Request, context: Ctx) {
  const denied = await requireAuth();
  if (denied) return denied;

  if (!icloudConfigured()) {
    return NextResponse.json({ error: "未配置 iCloud" }, { status: 400 });
  }

  const { id } = await context.params;
  const todo = await getTodo(id);
  if (!todo) {
    return NextResponse.json({ error: "未找到" }, { status: 404 });
  }

  const canSync =
    isCalendarSyncable(todo.dueAt) ||
    Boolean(todo.calendarUid) ||
    Boolean(todo.calendarObjectUrl);
  if (!canSync) {
    return NextResponse.json(
      { error: "该待办无需同步日历" },
      { status: 400 },
    );
  }

  await enqueueIcloudUpsert(id);
  const latest = (await getTodo(id)) ?? todo;
  return NextResponse.json({ todo: latest });
}
