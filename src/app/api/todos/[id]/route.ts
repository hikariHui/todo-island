import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { deleteTodo, getTodo, updateTodo } from "@/lib/store";
import {
  enqueueIcloudDelete,
  enqueueIcloudUpsert,
  startIcloudQueueWorker,
} from "@/lib/icloud-queue";
import { normalizeTags } from "@/lib/tags";
import { isCalendarSyncable } from "@/lib/due";
import { normalizeDueAt, normalizeTitle } from "@/lib/validate";

startIcloudQueueWorker();

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: Ctx) {
  const denied = await requireAuth();
  if (denied) return denied;

  const { id } = await context.params;
  const todo = await getTodo(id);
  if (!todo) {
    return NextResponse.json({ error: "未找到" }, { status: 404 });
  }
  return NextResponse.json({ todo });
}

export async function PATCH(request: Request, context: Ctx) {
  const denied = await requireAuth();
  if (denied) return denied;

  const { id } = await context.params;
  let body: {
    title?: unknown;
    tags?: unknown;
    completed?: unknown;
    dueAt?: unknown;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "请求体无效" }, { status: 400 });
  }

  let title: string | undefined;
  if (body.title !== undefined) {
    const titleResult = normalizeTitle(body.title);
    if (!titleResult.ok) {
      return NextResponse.json({ error: titleResult.error }, { status: 400 });
    }
    title = titleResult.title;
  }

  const dueResult = normalizeDueAt(body.dueAt, true);
  if (!dueResult.ok) {
    return NextResponse.json({ error: dueResult.error }, { status: 400 });
  }

  if (body.completed !== undefined && typeof body.completed !== "boolean") {
    return NextResponse.json({ error: "completed 无效" }, { status: 400 });
  }

  const before = await getTodo(id);
  const todo = await updateTodo(id, {
    title,
    tags: body.tags !== undefined ? normalizeTags(body.tags) : undefined,
    completed:
      typeof body.completed === "boolean" ? body.completed : undefined,
    dueAt: dueResult.dueAt,
  });
  if (!todo) {
    return NextResponse.json({ error: "未找到" }, { status: 404 });
  }

  const shouldSync =
    isCalendarSyncable(todo.dueAt) ||
    isCalendarSyncable(before?.dueAt) ||
    Boolean(todo.calendarObjectUrl) ||
    Boolean(todo.calendarUid) ||
    Boolean(before?.calendarObjectUrl) ||
    Boolean(before?.calendarUid);

  if (shouldSync) {
    await enqueueIcloudUpsert(todo.id);
  }

  const latest = (await getTodo(id)) ?? todo;
  return NextResponse.json({ todo: latest });
}

export async function DELETE(_request: Request, context: Ctx) {
  const denied = await requireAuth();
  if (denied) return denied;

  const { id } = await context.params;
  const removed = await deleteTodo(id);
  if (!removed) {
    return NextResponse.json({ error: "未找到" }, { status: 404 });
  }

  await enqueueIcloudDelete({
    id: removed.id,
    calendarUid: removed.calendarUid,
    calendarObjectUrl: removed.calendarObjectUrl,
  });

  return NextResponse.json({ ok: true });
}
