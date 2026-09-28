import { promises as fs } from "fs";
import path from "path";
import { dueSortKey } from "./due";
import { collectAllTags, normalizeTagName, normalizeTags } from "./tags";
import type { CreateTodoInput, Todo, TodoStore, UpdateTodoInput } from "./types";

const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), "data");
const DATA_FILE = path.join(DATA_DIR, "todos.json");

let writeChain: Promise<unknown> = Promise.resolve();

async function ensureStore(): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    await fs.access(DATA_FILE);
  } catch {
    const initial: TodoStore = { tags: [], todos: [] };
    await fs.writeFile(DATA_FILE, JSON.stringify(initial, null, 2), "utf8");
  }
}

function migrateTodo(raw: Record<string, unknown>): Todo {
  const tags = normalizeTags(raw.tags);
  const completed = Boolean(raw.completed);
  const completedAtRaw = raw.completedAt;
  const completedAt =
    completed && typeof completedAtRaw === "string" && completedAtRaw
      ? completedAtRaw
      : completed
        ? String(raw.updatedAt ?? raw.createdAt ?? new Date().toISOString())
        : null;
  return {
    id: String(raw.id ?? crypto.randomUUID()),
    title: String(raw.title ?? "").trim(),
    tags,
    completed,
    completedAt,
    dueAt: (raw.dueAt as string | null | undefined) ?? null,
    calendarUid: (raw.calendarUid as string | null | undefined) ?? null,
    calendarObjectUrl:
      (raw.calendarObjectUrl as string | null | undefined) ?? null,
    calendarSequence:
      typeof raw.calendarSequence === "number" &&
      Number.isFinite(raw.calendarSequence)
        ? Math.max(0, Math.floor(raw.calendarSequence))
        : 0,
    calendarSyncError:
      (raw.calendarSyncError as string | null | undefined) ?? null,
    calendarSyncPending: Boolean(raw.calendarSyncPending),
    createdAt: String(raw.createdAt ?? new Date().toISOString()),
    updatedAt: String(raw.updatedAt ?? new Date().toISOString()),
  };
}

function mergeTagCatalog(existing: string[], extra: string[]): string[] {
  return normalizeTags([...existing, ...extra]);
}

async function readStore(): Promise<TodoStore> {
  await ensureStore();
  const raw = await fs.readFile(DATA_FILE, "utf8");
  const parsed = JSON.parse(raw) as { tags?: unknown; todos?: unknown[] };
  const todos = Array.isArray(parsed.todos)
    ? parsed.todos.map((item) =>
        migrateTodo((item ?? {}) as Record<string, unknown>),
      )
    : [];
  const fromFile = normalizeTags(parsed.tags);
  const fromTodos = collectAllTags(todos);
  return {
    tags: mergeTagCatalog(fromFile, fromTodos),
    todos,
  };
}

async function writeStore(store: TodoStore): Promise<void> {
  await ensureStore();
  const payload: TodoStore = {
    tags: normalizeTags(store.tags),
    todos: store.todos.map((todo) => ({
      ...todo,
      tags: normalizeTags(todo.tags),
    })),
  };
  const tmp = `${DATA_FILE}.${process.pid}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(payload, null, 2), "utf8");
  await fs.rename(tmp, DATA_FILE);
}

function withLock<T>(fn: () => Promise<T>): Promise<T> {
  const run = writeChain.then(fn, fn);
  writeChain = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

function sortTodos(todos: Todo[]): Todo[] {
  return [...todos].sort((a, b) => {
    if (a.completed !== b.completed) return a.completed ? 1 : -1;
    const aDue = dueSortKey(a.dueAt);
    const bDue = dueSortKey(b.dueAt);
    if (aDue !== bDue) return aDue - bDue;
    return Date.parse(b.updatedAt) - Date.parse(a.updatedAt);
  });
}

function sortTagCatalog(tags: string[]): string[] {
  return [...tags].sort((a, b) => a.localeCompare(b, "zh-CN"));
}

export async function listTodos(): Promise<Todo[]> {
  const store = await readStore();
  return sortTodos(store.todos);
}

export async function listTags(): Promise<string[]> {
  const store = await readStore();
  return sortTagCatalog(store.tags);
}

/** Single read for list endpoints that need both. */
export async function listTodosAndTags(): Promise<{
  todos: Todo[];
  tags: string[];
}> {
  const store = await readStore();
  return {
    todos: sortTodos(store.todos),
    tags: sortTagCatalog(store.tags),
  };
}

export async function getTodo(id: string): Promise<Todo | null> {
  const store = await readStore();
  return store.todos.find((t) => t.id === id) ?? null;
}

export async function createTodo(input: CreateTodoInput): Promise<Todo> {
  return withLock(async () => {
    const store = await readStore();
    const now = new Date().toISOString();
    const tags = normalizeTags(input.tags);
    const todo: Todo = {
      id: crypto.randomUUID(),
      title: input.title.trim(),
      tags,
      completed: false,
      completedAt: null,
      dueAt: input.dueAt ?? null,
      calendarUid: null,
      calendarObjectUrl: null,
      calendarSequence: 0,
      calendarSyncError: null,
      calendarSyncPending: false,
      createdAt: now,
      updatedAt: now,
    };
    store.todos.push(todo);
    store.tags = mergeTagCatalog(store.tags, tags);
    await writeStore(store);
    return todo;
  });
}

export async function updateTodo(
  id: string,
  input: UpdateTodoInput,
): Promise<Todo | null> {
  return withLock(async () => {
    const store = await readStore();
    const index = store.todos.findIndex((t) => t.id === id);
    if (index < 0) return null;

    const current = store.todos[index];
    const now = new Date().toISOString();
    const completed =
      input.completed !== undefined ? input.completed : current.completed;

    let completedAt = current.completedAt;
    if (input.completed !== undefined) {
      if (input.completed && !current.completed) {
        completedAt = now;
      } else if (!input.completed) {
        completedAt = null;
      }
    } else if (!completed) {
      completedAt = null;
    } else if (completed && !completedAt) {
      completedAt = now;
    }

    const tags =
      input.tags !== undefined ? normalizeTags(input.tags) : current.tags;

    const next: Todo = {
      ...current,
      title:
        input.title !== undefined ? input.title.trim() : current.title,
      tags,
      completed,
      completedAt,
      dueAt: input.dueAt !== undefined ? input.dueAt : current.dueAt,
      updatedAt: now,
    };
    store.todos[index] = next;
    if (input.tags !== undefined) {
      store.tags = mergeTagCatalog(store.tags, tags);
    }
    await writeStore(store);
    return next;
  });
}

/** Update existing todo only — never resurrect a deleted id. */
export async function saveTodo(todo: Todo): Promise<Todo | null> {
  return withLock(async () => {
    const store = await readStore();
    const index = store.todos.findIndex((t) => t.id === todo.id);
    if (index < 0) return null;
    const normalized: Todo = {
      ...todo,
      tags: normalizeTags(todo.tags),
      completedAt: todo.completed
        ? todo.completedAt || new Date().toISOString()
        : null,
      calendarSequence: Math.max(0, Math.floor(todo.calendarSequence || 0)),
      calendarSyncPending: Boolean(todo.calendarSyncPending),
    };
    store.todos[index] = normalized;
    store.tags = mergeTagCatalog(store.tags, normalized.tags);
    await writeStore(store);
    return normalized;
  });
}

export async function updateTodoSyncMeta(
  id: string,
  meta: {
    calendarSyncPending?: boolean;
    calendarSyncError?: string | null;
    calendarUid?: string | null;
    calendarObjectUrl?: string | null;
    calendarSequence?: number;
  },
): Promise<Todo | null> {
  return withLock(async () => {
    const store = await readStore();
    const index = store.todos.findIndex((t) => t.id === id);
    if (index < 0) return null;
    const current = store.todos[index];
    const next: Todo = {
      ...current,
      calendarSyncPending:
        meta.calendarSyncPending !== undefined
          ? meta.calendarSyncPending
          : current.calendarSyncPending,
      calendarSyncError:
        meta.calendarSyncError !== undefined
          ? meta.calendarSyncError
          : current.calendarSyncError,
      calendarUid:
        meta.calendarUid !== undefined ? meta.calendarUid : current.calendarUid,
      calendarObjectUrl:
        meta.calendarObjectUrl !== undefined
          ? meta.calendarObjectUrl
          : current.calendarObjectUrl,
      calendarSequence:
        meta.calendarSequence !== undefined
          ? Math.max(0, Math.floor(meta.calendarSequence))
          : current.calendarSequence,
      // sync meta must not reshuffle list order
    };
    store.todos[index] = next;
    await writeStore(store);
    return next;
  });
}

export async function deleteTodo(id: string): Promise<Todo | null> {
  return withLock(async () => {
    const store = await readStore();
    const index = store.todos.findIndex((t) => t.id === id);
    if (index < 0) return null;
    const [removed] = store.todos.splice(index, 1);
    await writeStore(store);
    return removed;
  });
}

/**
 * 删除完成时间早于 cutoffIso 的已完成事项（仅本地，不触达 iCloud）。
 * 以 completedAt 为准；缺失时回退 updatedAt。
 */
export async function purgeCompletedBefore(
  cutoffIso: string,
): Promise<Todo[]> {
  return withLock(async () => {
    const store = await readStore();
    const cutoff = Date.parse(cutoffIso);
    if (Number.isNaN(cutoff)) return [];

    const kept: Todo[] = [];
    const removed: Todo[] = [];
    for (const todo of store.todos) {
      if (!todo.completed) {
        kept.push(todo);
        continue;
      }
      const stamp = Date.parse(todo.completedAt || todo.updatedAt);
      if (Number.isNaN(stamp) || stamp >= cutoff) {
        kept.push(todo);
        continue;
      }
      removed.push(todo);
    }

    if (removed.length === 0) return [];
    store.todos = kept;
    await writeStore(store);
    return removed;
  });
}

export async function createTag(name: string): Promise<string> {
  return withLock(async () => {
    const tag = normalizeTagName(name);
    if (!tag) throw new Error("标签名不能为空");
    const store = await readStore();
    const exists = store.tags.some(
      (item) => item.toLowerCase() === tag.toLowerCase(),
    );
    if (exists) throw new Error("标签已存在");
    store.tags = mergeTagCatalog(store.tags, [tag]);
    await writeStore(store);
    return tag;
  });
}

export async function renameTag(
  from: string,
  to: string,
): Promise<{ from: string; to: string }> {
  return withLock(async () => {
    const oldName = normalizeTagName(from);
    const newName = normalizeTagName(to);
    if (!oldName || !newName) throw new Error("标签名不能为空");

    const store = await readStore();
    const oldIndex = store.tags.findIndex(
      (item) => item.toLowerCase() === oldName.toLowerCase(),
    );
    if (oldIndex < 0) throw new Error("标签不存在");

    const conflict = store.tags.some(
      (item, index) =>
        index !== oldIndex && item.toLowerCase() === newName.toLowerCase(),
    );
    if (conflict) throw new Error("目标标签名已存在");

    const canonicalOld = store.tags[oldIndex];
    store.tags[oldIndex] = newName;
    store.tags = normalizeTags(store.tags);
    store.todos = store.todos.map((todo) => ({
      ...todo,
      tags: normalizeTags(
        todo.tags.map((tag) =>
          tag.toLowerCase() === canonicalOld.toLowerCase() ? newName : tag,
        ),
      ),
      // keep updatedAt — tag rename must not reshuffle todo list order
    }));
    await writeStore(store);
    return { from: canonicalOld, to: newName };
  });
}

export async function deleteTag(name: string): Promise<string> {
  return withLock(async () => {
    const target = normalizeTagName(name);
    if (!target) throw new Error("标签名不能为空");
    const store = await readStore();
    const existing = store.tags.find(
      (item) => item.toLowerCase() === target.toLowerCase(),
    );
    if (!existing) throw new Error("标签不存在");

    store.tags = store.tags.filter(
      (item) => item.toLowerCase() !== existing.toLowerCase(),
    );
    store.todos = store.todos.map((todo) => ({
      ...todo,
      tags: todo.tags.filter(
        (tag) => tag.toLowerCase() !== existing.toLowerCase(),
      ),
      // keep updatedAt — tag delete must not reshuffle todo list order
    }));
    await writeStore(store);
    return existing;
  });
}
