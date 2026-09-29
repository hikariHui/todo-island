import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { createTodo, getTodo, listTodosAndTags } from "@/lib/store";
import { icloudStatus } from "@/lib/icloud";
import { enqueueIcloudUpsert, startIcloudQueueWorker } from "@/lib/icloud-queue";
import { normalizeTags } from "@/lib/tags";
import { isCalendarSyncable } from "@/lib/due";
import { normalizeDueAt, normalizeTitle } from "@/lib/validate";

startIcloudQueueWorker();

export async function GET() {
  const denied = await requireAuth();
  if (denied) return denied;

  const { todos, tags } = await listTodosAndTags();
  return NextResponse.json({ todos, tags, icloud: icloudStatus() });
}

export async function POST(request: Request) {
  const denied = await requireAuth();
  if (denied) return denied;

  let body: { title?: unknown; tags?: unknown; dueAt?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "请求体无效" }, { status: 400 });
  }

  const titleResult = normalizeTitle(body.title);
  if (!titleResult.ok) {
    return NextResponse.json({ error: titleResult.error }, { status: 400 });
  }

  const dueResult = normalizeDueAt(body.dueAt, false);
  if (!dueResult.ok) {
    return NextResponse.json({ error: dueResult.error }, { status: 400 });
  }

  const todo = await createTodo({
    title: titleResult.title,
    tags: normalizeTags(body.tags),
    dueAt: dueResult.dueAt ?? null,
  });

  if (
    isCalendarSyncable(todo.dueAt) ||
    todo.calendarUid ||
    todo.calendarObjectUrl
  ) {
    await enqueueIcloudUpsert(todo.id);
  }

  const latest = (await getTodo(todo.id)) ?? todo;
  return NextResponse.json({ todo: latest }, { status: 201 });
}
