"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "@/components/Toast";
import { findTodoInsertIndex, isCalendarSyncable } from "@/lib/due";
import type { Todo } from "@/lib/types";

export type IcloudInfo = {
  configured: boolean;
  calendarName: string | null;
};

function mergeTodoSorted(prev: Todo[], todo: Todo): Todo[] {
  const rest = prev.filter((t) => t.id !== todo.id);
  const index = findTodoInsertIndex(rest, todo);
  const next = [...rest];
  next.splice(index, 0, todo);
  return next;
}

function mergeCatalogTags(prev: string[], tags: string[]): string[] {
  if (tags.length === 0) return prev;
  const seen = new Set(prev.map((t) => t.toLowerCase()));
  const next = [...prev];
  for (const tag of tags) {
    if (!seen.has(tag.toLowerCase())) {
      seen.add(tag.toLowerCase());
      next.push(tag);
    }
  }
  return next;
}

export function useTodos() {
  const router = useRouter();
  const [todos, setTodos] = useState<Todo[]>([]);
  const [catalogTags, setCatalogTags] = useState<string[]>([]);
  const [icloud, setIcloud] = useState<IcloudInfo>({
    configured: false,
    calendarName: null,
  });
  const [loading, setLoading] = useState(true);
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());
  const [retryingIds, setRetryingIds] = useState<Set<string>>(new Set());

  const load = useCallback(
    async (options?: { silent?: boolean }) => {
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
        if (!options?.silent) toast.error({ message: "加载失败" });
      } finally {
        setLoading(false);
      }
    },
    [router],
  );

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/todos");
        if (cancelled) return;
        if (res.status === 401) {
          router.replace("/login");
          return;
        }
        const data = (await res.json()) as {
          todos: Todo[];
          tags?: string[];
          icloud: IcloudInfo;
        };
        if (cancelled) return;
        setTodos(data.todos);
        setCatalogTags(data.tags ?? []);
        setIcloud(data.icloud);
      } catch {
        if (!cancelled) toast.error({ message: "加载失败" });
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  useEffect(() => {
    const hasPending = todos.some((todo) => todo.calendarSyncPending);
    if (!hasPending) return;
    const timer = window.setInterval(() => {
      void load({ silent: true });
    }, 2000);
    return () => window.clearInterval(timer);
  }, [todos, load]);

  const allTags = useMemo(
    () => [...catalogTags].sort((a, b) => a.localeCompare(b, "zh-CN")),
    [catalogTags],
  );

  const createTodo = useCallback(
    async (input: {
      title: string;
      tags: string[];
      dueAt: string | null;
    }): Promise<Todo | null> => {
      try {
        const res = await fetch("/api/todos", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input),
        });
        const data = (await res.json()) as { todo?: Todo; error?: string };
        if (!res.ok || !data.todo) {
          toast.error({ message: data.error || "创建失败" });
          return null;
        }
        setTodos((prev) => mergeTodoSorted(prev, data.todo!));
        setCatalogTags((prev) => mergeCatalogTags(prev, data.todo!.tags));
        if (isCalendarSyncable(data.todo.dueAt) && icloud.configured) {
          toast.success({ message: "已添加，日历同步中" });
        } else {
          toast.success({ message: "已添加" });
        }
        return data.todo;
      } catch {
        toast.error({ message: "网络错误" });
        return null;
      }
    },
    [icloud.configured],
  );

  const patchTodo = useCallback(
    async (
      id: string,
      payload: Partial<Todo>,
      options?: { quietSuccess?: boolean },
    ): Promise<Todo | null> => {
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
      if (
        !options?.quietSuccess &&
        icloud.configured &&
        payload.dueAt !== undefined
      ) {
        toast.success({
          message: data.todo.calendarSyncPending
            ? "已保存，日历同步中"
            : "已保存",
        });
      }
      setTodos((prev) => mergeTodoSorted(prev, data.todo!));
      return data.todo;
    },
    [icloud.configured],
  );

  const retrySync = useCallback(async (id: string) => {
    let already = false;
    setRetryingIds((prev) => {
      if (prev.has(id)) {
        already = true;
        return prev;
      }
      return new Set(prev).add(id);
    });
    if (already) return;
    try {
      const res = await fetch(`/api/todos/${id}/sync`, { method: "POST" });
      const data = (await res.json()) as { todo?: Todo; error?: string };
      if (!res.ok || !data.todo) {
        toast.error({ message: data.error || "重试同步失败" });
        return;
      }
      setTodos((prev) => mergeTodoSorted(prev, data.todo!));
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
  }, []);

  const removeTodo = useCallback(
    async (id: string): Promise<boolean> => {
      let already = false;
      setDeletingIds((prev) => {
        if (prev.has(id)) {
          already = true;
          return prev;
        }
        return new Set(prev).add(id);
      });
      if (already) return false;
      try {
        const res = await fetch(`/api/todos/${id}`, { method: "DELETE" });
        const data = (await res.json().catch(() => ({}))) as {
          ok?: boolean;
          error?: string;
        };
        if (!res.ok) {
          toast.error({ message: data.error || "删除失败" });
          return false;
        }
        setTodos((prev) => prev.filter((t) => t.id !== id));
        toast.success({
          message: icloud.configured ? "已删除，日历同步中" : "已删除",
        });
        return true;
      } finally {
        setDeletingIds((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
      }
    },
    [icloud.configured],
  );

  const logout = useCallback(async () => {
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
  }, [router]);

  const mergeCatalogTagsFromTodo = useCallback((tags: string[]) => {
    setCatalogTags((prev) => mergeCatalogTags(prev, tags));
  }, []);

  return {
    todos,
    catalogTags,
    allTags,
    icloud,
    loading,
    deletingIds,
    retryingIds,
    createTodo,
    patchTodo,
    retrySync,
    removeTodo,
    logout,
    mergeCatalogTagsFromTodo,
  };
}
