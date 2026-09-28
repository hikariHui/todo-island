"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Button,
  Card,
  DatePicker,
  Input,
  Modal,
  Switch,
  Tag,
  TimePicker,
  Title,
} from "animal-island-ui";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MultiSelectTags, tagColor } from "@/components/MultiSelectTags";
import {
  IslandDuePicker,
  type DueDraft,
} from "@/components/IslandDuePicker";
import { toast } from "@/components/Toast";
import { formatDueLabel, joinDueAt, splitDueAt } from "@/lib/due";
import type { Todo } from "@/lib/types";

type IcloudInfo = {
  configured: boolean;
  calendarName: string | null;
};

type StatusFilter = "all" | "active" | "done";

const FILTERS_STORAGE_KEY = "todo-island:filters";

function isStatusFilter(value: unknown): value is StatusFilter {
  return value === "all" || value === "active" || value === "done";
}

function readStoredFilters(): {
  filter: StatusFilter;
  tagFilter: string | null;
} {
  try {
    const raw = window.localStorage.getItem(FILTERS_STORAGE_KEY);
    if (!raw) return { filter: "all", tagFilter: null };
    const parsed = JSON.parse(raw) as {
      filter?: unknown;
      tagFilter?: unknown;
    };
    return {
      filter: isStatusFilter(parsed.filter) ? parsed.filter : "all",
      tagFilter:
        typeof parsed.tagFilter === "string" && parsed.tagFilter.trim()
          ? parsed.tagFilter
          : null,
    };
  } catch {
    return { filter: "all", tagFilter: null };
  }
}

function emptyDue(): DueDraft {
  return { date: null, timed: false, time: null };
}

function dueFromTodo(todo: Todo): DueDraft {
  const parts = splitDueAt(todo.dueAt);
  return {
    date: parts.date,
    timed: !parts.allDay,
    time: parts.time,
  };
}

function formatCompletedLabel(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return `完成于 ${d.toLocaleString("zh-CN", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })}`;
}

function DueFields({
  value,
  onChange,
  hint,
}: {
  value: DueDraft;
  onChange: (next: DueDraft) => void;
  hint?: boolean;
}) {
  return (
    <div className="flex w-full flex-col gap-2">
      <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center">
        <div className="min-w-0 flex-1">
          <DatePicker
            value={value.date}
            onChange={(v) => {
              const date = typeof v === "string" ? v : null;
              onChange(
                date
                  ? { ...value, date }
                  : { date: null, timed: false, time: null },
              );
            }}
            placeholder="日期（可空=待定）"
            allowClear
            showToday
            size="middle"
          />
        </div>
        {value.date ? (
          <Button
            type={value.timed ? "primary" : "default"}
            size="middle"
            onClick={() => {
              if (value.timed) {
                onChange({ ...value, timed: false, time: null });
              } else {
                onChange({
                  ...value,
                  timed: true,
                  time: value.time || "09:00:00",
                });
              }
            }}
          >
            {value.timed ? "改为全天" : "设定具体时间"}
          </Button>
        ) : null}
      </div>

      {value.date && value.timed ? (
        <TimePicker
          value={value.time ?? undefined}
          onChange={(v) => onChange({ ...value, time: v })}
          placeholder="具体时间"
          allowClear
          format="HH:mm"
          minuteStep={5}
          size="middle"
        />
      ) : null}

      {hint ? (
        <p className="text-xs text-[#7a6552]">
          {!value.date
            ? "不选日期表示待定，不同步日历"
            : value.timed
              ? "将同步为 iCloud 定点事件（默认 1 小时）"
              : "默认全天，将同步为 iCloud 全天事件"}
        </p>
      ) : null}
    </div>
  );
}

export function TodoApp() {
  const router = useRouter();
  const [todos, setTodos] = useState<Todo[]>([]);
  const [catalogTags, setCatalogTags] = useState<string[]>([]);
  const [icloud, setIcloud] = useState<IcloudInfo>({
    configured: false,
    calendarName: null,
  });
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [due, setDue] = useState<DueDraft>(emptyDue);
  const [submitting, setSubmitting] = useState(false);
  const [filter, setFilter] = useState<StatusFilter>("all");
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [filtersHydrated, setFiltersHydrated] = useState(false);
  const [editing, setEditing] = useState<Todo | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editTags, setEditTags] = useState<string[]>([]);
  const [editDue, setEditDue] = useState<DueDraft>(emptyDue);
  const [editSaving, setEditSaving] = useState(false);
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());
  const [retryingIds, setRetryingIds] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/todos");
      if (res.status === 401) {
        router.replace("/login");
        return;
      }
      const data = (await res.json()) as {
        todos: Todo[];
        tags?: string[];
        icloud: IcloudInfo;
      };
      setTodos(data.todos);
      setCatalogTags(data.tags ?? []);
      setIcloud(data.icloud);
    } catch {
      toast.error({ message: "加载失败" });
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const stored = readStoredFilters();
    setFilter(stored.filter);
    setTagFilter(stored.tagFilter);
    setFiltersHydrated(true);
  }, []);

  useEffect(() => {
    if (!filtersHydrated) return;
    try {
      window.localStorage.setItem(
        FILTERS_STORAGE_KEY,
        JSON.stringify({ filter, tagFilter }),
      );
    } catch {
      // ignore quota / private mode
    }
  }, [filter, tagFilter, filtersHydrated]);

  useEffect(() => {
    const hasPending = todos.some((todo) => todo.calendarSyncPending);
    if (!hasPending) return;
    const timer = window.setInterval(() => {
      void load();
    }, 2000);
    return () => window.clearInterval(timer);
  }, [todos, load]);

  const allTags = useMemo(
    () =>
      [...catalogTags].sort((a, b) => a.localeCompare(b, "zh-CN")),
    [catalogTags],
  );

  useEffect(() => {
    if (!tagFilter) return;
    const exists = allTags.some(
      (tag) => tag.toLowerCase() === tagFilter.toLowerCase(),
    );
    if (!exists) setTagFilter(null);
  }, [allTags, tagFilter]);

  const visible = useMemo(() => {
    return todos.filter((todo) => {
      if (filter === "active" && todo.completed) return false;
      if (filter === "done" && !todo.completed) return false;
      if (
        tagFilter &&
        !todo.tags.some((tag) => tag.toLowerCase() === tagFilter.toLowerCase())
      ) {
        return false;
      }
      return true;
    });
  }, [todos, filter, tagFilter]);

  async function createTodo() {
    const trimmed = title.trim();
    if (!trimmed) {
      toast.warning({ message: "先写一下要做什么吧" });
      return;
    }
    setSubmitting(true);
    try {
      const dueAt = joinDueAt(due.date, due.timed, due.time);
      const res = await fetch("/api/todos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: trimmed,
          tags,
          dueAt,
        }),
      });
      const data = (await res.json()) as { todo?: Todo; error?: string };
      if (!res.ok || !data.todo) {
        toast.error({ message: data.error || "创建失败" });
        return;
      }
      setTodos((prev) => [data.todo!, ...prev]);
      if (data.todo.tags.length > 0) {
        setCatalogTags((prev) => {
          const seen = new Set(prev.map((t) => t.toLowerCase()));
          const next = [...prev];
          for (const tag of data.todo!.tags) {
            if (!seen.has(tag.toLowerCase())) {
              seen.add(tag.toLowerCase());
              next.push(tag);
            }
          }
          return next;
        });
      }
      setTitle("");
      setTags([]);
      setDue(emptyDue());
      if (data.todo.dueAt && icloud.configured) {
        toast.success({ message: "已添加，日历同步中" });
      } else {
        toast.success({ message: "已添加" });
      }
    } catch {
      toast.error({ message: "网络错误" });
    } finally {
      setSubmitting(false);
    }
  }

  async function patchTodo(
    id: string,
    payload: Partial<Todo>,
    options?: { quietSuccess?: boolean },
  ) {
    const res = await fetch(`/api/todos/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = (await res.json()) as { todo?: Todo; error?: string };
    if (!res.ok || !data.todo) {
      toast.error({ message: data.error || "更新失败" });
      return null;
    }
    if (!options?.quietSuccess && icloud.configured && payload.dueAt !== undefined) {
      toast.success({
        message: data.todo.calendarSyncPending
          ? "已保存，日历同步中"
          : "已保存",
      });
    }
    setTodos((prev) => prev.map((t) => (t.id === id ? data.todo! : t)));
    return data.todo;
  }

  async function retrySync(id: string) {
    if (retryingIds.has(id)) return;
    setRetryingIds((prev) => new Set(prev).add(id));
    try {
      const res = await fetch(`/api/todos/${id}/sync`, { method: "POST" });
      const data = (await res.json()) as { todo?: Todo; error?: string };
      if (!res.ok || !data.todo) {
        toast.error({ message: data.error || "重试同步失败" });
        return;
      }
      setTodos((prev) => prev.map((t) => (t.id === id ? data.todo! : t)));
      toast.success({ message: "已重新排队同步" });
    } catch {
      toast.error({ message: "网络错误" });
    } finally {
      setRetryingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  }

  async function removeTodo(id: string) {
    if (deletingIds.has(id)) return;
    setDeletingIds((prev) => new Set(prev).add(id));
    try {
      const res = await fetch(`/api/todos/${id}`, { method: "DELETE" });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
      };
      if (!res.ok) {
        toast.error({ message: data.error || "删除失败" });
        return;
      }
      setTodos((prev) => prev.filter((t) => t.id !== id));
      toast.success({
        message: icloud.configured ? "已删除，日历同步中" : "已删除",
      });
    } finally {
      setDeletingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    if ("caches" in window) {
      try {
        const keys = await caches.keys();
        await Promise.all(
          keys
            .filter((key) => key === "apis" || key.includes("api"))
            .map((key) => caches.delete(key)),
        );
      } catch {
        // ignore cache cleanup failures
      }
    }
    router.replace("/login");
  }

  function openEdit(todo: Todo) {
    setEditing(todo);
    setEditTitle(todo.title);
    setEditTags([...todo.tags]);
    setEditDue(dueFromTodo(todo));
  }

  async function saveEdit() {
    if (!editing || editSaving) return;
    const trimmed = editTitle.trim();
    if (!trimmed) {
      toast.warning({ message: "标题不能为空" });
      return;
    }
    setEditSaving(true);
    try {
      const updated = await patchTodo(
        editing.id,
        {
          title: trimmed,
          tags: editTags,
          dueAt: joinDueAt(editDue.date, editDue.timed, editDue.time),
        },
        { quietSuccess: true },
      );
      if (updated) {
        setEditing(null);
        if (updated.tags.length > 0) {
          setCatalogTags((prev) => {
            const seen = new Set(prev.map((t) => t.toLowerCase()));
            const next = [...prev];
            for (const tag of updated.tags) {
              if (!seen.has(tag.toLowerCase())) {
                seen.add(tag.toLowerCase());
                next.push(tag);
              }
            }
            return next;
          });
        }
        if (icloud.configured && updated.calendarSyncPending) {
          toast.success({ message: "已保存，日历同步中" });
        } else {
          toast.success({ message: "已保存" });
        }
      }
    } finally {
      setEditSaving(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 py-6 sm:gap-6 sm:px-6 sm:py-10">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Title color="app-orange" size="large" variant="ribbon">
            Todo Island
          </Title>
        </div>
        <div className="flex gap-2">
          <Link href="/tags">
            <Button type="default">标签管理</Button>
          </Link>
          <Button type="default" onClick={() => void logout()}>
            退出
          </Button>
        </div>
      </header>

      <Card color="app-yellow" pattern="app-yellow" className="p-4 sm:p-6">
        <div className="flex flex-col gap-3">
          <Input
            size="large"
            placeholder="今天要做什么？"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void createTodo();
              }
            }}
          />
          <MultiSelectTags
            options={allTags}
            value={tags}
            onChange={setTags}
            emptyHint="还没有标签，先去「标签管理」创建"
          />
          <DueFields value={due} onChange={setDue} hint />
          <Button
            type="primary"
            size="large"
            loading={submitting}
            onClick={() => void createTodo()}
            block
          >
            添加
          </Button>
        </div>
      </Card>

      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {(
            [
              ["all", "全部"],
              ["active", "待办"],
              ["done", "已完成"],
            ] as const
          ).map(([key, label]) => (
            <Button
              key={key}
              type={filter === key ? "primary" : "default"}
              size="small"
              onClick={() => setFilter(key)}
            >
              {label}
            </Button>
          ))}
          <span className="ml-auto text-xs text-[#7a6552] sm:text-sm">
            {visible.length} 项
          </span>
        </div>

        {allTags.length > 0 ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-[#7a6552]">标签：</span>
            <Tag
              size="small"
              color="default"
              variant={tagFilter === null ? "solid" : "outlined"}
              onClick={() => setTagFilter(null)}
            >
              全部
            </Tag>
            {allTags.map((tag) => {
              const active =
                tagFilter?.toLowerCase() === tag.toLowerCase();
              return (
                <Tag
                  key={tag}
                  size="small"
                  color={tagColor(tag)}
                  variant={active ? "solid" : "outlined"}
                  onClick={() =>
                    setTagFilter(active ? null : tag)
                  }
                >
                  {tag}
                </Tag>
              );
            })}
          </div>
        ) : null}
      </div>

      {loading ? (
        <Card className="p-8 text-center text-[#7a6552]">加载中…</Card>
      ) : visible.length === 0 ? (
        <Card color="app-blue" pattern="app-blue" className="p-8 text-center text-[#5c4a3a]">
          {todos.length === 0
            ? "小岛上还没有待办，先加一条吧"
            : "当前筛选下没有待办"}
        </Card>
      ) : (
        <ul className="flex flex-col gap-3">
          {visible.map((todo) => (
            <li key={todo.id}>
              <Card
                hoverable
                color={todo.completed ? "default" : "app-green"}
                pattern={todo.completed ? "none" : "app-green"}
                className="p-4"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
                  <div className="pt-1">
                    <Switch
                      checked={todo.completed}
                      size="small"
                      aria-label="完成状态"
                      onChange={(checked) => {
                        void patchTodo(
                          todo.id,
                          { completed: checked },
                          { quietSuccess: true },
                        );
                      }}
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div
                      className={`text-base font-semibold sm:text-lg ${
                        todo.completed
                          ? "text-[#9a8b7a] line-through"
                          : "text-[#3d2f24]"
                      }`}
                    >
                      {todo.title}
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      {todo.dueAt ? (
                        <Tag size="small" color="app-orange" variant="soft">
                          {formatDueLabel(todo.dueAt)}
                        </Tag>
                      ) : null}
                      {todo.completed && todo.completedAt ? (
                        <Tag
                          size="small"
                          color="app-green"
                          variant="outlined"
                        >
                          {formatCompletedLabel(todo.completedAt)}
                        </Tag>
                      ) : null}
                      {todo.tags.map((tag) => (
                        <Tag
                          key={tag}
                          size="small"
                          color={tagColor(tag)}
                          variant="soft"
                          onClick={() => setTagFilter(tag)}
                        >
                          {tag}
                        </Tag>
                      ))}
                      {todo.calendarSyncPending ? (
                        <Tag
                          size="small"
                          color="app-yellow"
                          variant="outlined"
                        >
                          同步中
                        </Tag>
                      ) : null}
                      {todo.dueAt &&
                      todo.calendarObjectUrl &&
                      !todo.calendarSyncPending ? (
                        <Tag size="small" color="app-teal" variant="outlined">
                          已同步日历
                        </Tag>
                      ) : null}
                      {todo.calendarSyncError && !todo.calendarSyncPending ? (
                        <span title={todo.calendarSyncError}>
                          <Tag size="small" color="app-red" variant="solid">
                            同步失败
                          </Tag>
                        </span>
                      ) : null}
                      {todo.calendarSyncError && !todo.calendarSyncPending ? (
                        <Button
                          type="default"
                          size="small"
                          loading={retryingIds.has(todo.id)}
                          disabled={retryingIds.has(todo.id)}
                          onClick={() => void retrySync(todo.id)}
                        >
                          重试同步
                        </Button>
                      ) : null}
                    </div>
                  </div>
                  <div className="flex gap-2 self-end sm:self-start">
                    <Button
                      type="default"
                      size="small"
                      onClick={() => openEdit(todo)}
                    >
                      编辑
                    </Button>
                    <Button
                      type="primary"
                      danger
                      size="small"
                      loading={deletingIds.has(todo.id)}
                      disabled={deletingIds.has(todo.id)}
                      onClick={() => void removeTodo(todo.id)}
                    >
                      删除
                    </Button>
                  </div>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}

      <Modal
        open={Boolean(editing)}
        title="编辑待办"
        typewriter={false}
        onClose={() => {
          if (!editSaving) setEditing(null);
        }}
        onOk={() => void saveEdit()}
        width="min(92vw, 480px)"
      >
        <div className="flex w-full flex-col gap-3 py-2">
          <Input
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            placeholder="标题"
          />
          <MultiSelectTags
            options={allTags}
            value={editTags}
            onChange={setEditTags}
            layout="panel"
            emptyHint="还没有标签，先去「标签管理」创建"
          />
          <IslandDuePicker
            key={editing?.id ?? "edit-due"}
            value={editDue}
            onChange={setEditDue}
            hint
          />
        </div>
      </Modal>
    </div>
  );
}
