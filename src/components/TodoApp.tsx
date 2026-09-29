"use client";

import { useMemo, useState } from "react";
import { getScheduleState } from "@/lib/due";
import type { Todo } from "@/lib/types";
import { useTodoFilters } from "@/hooks/useTodoFilters";
import { useTodos } from "@/hooks/useTodos";
import { TodoComposer } from "@/components/todo/TodoComposer";
import { TodoDeleteModal } from "@/components/todo/TodoDeleteModal";
import { TodoEditModal } from "@/components/todo/TodoEditModal";
import { TodoFilters } from "@/components/todo/TodoFilters";
import { TodoHeader } from "@/components/todo/TodoHeader";
import { TodoList } from "@/components/todo/TodoList";

export function TodoApp() {
  const {
    filter,
    scheduleFilter,
    tagFilter,
    setFilter,
    setScheduleFilter,
    setTagFilter,
  } = useTodoFilters();
  const {
    todos,
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
  } = useTodos();

  const [editing, setEditing] = useState<Todo | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Todo | null>(null);

  const resolvedTagFilter = useMemo(() => {
    if (!tagFilter) return null;
    const exists = allTags.some(
      (tag) => tag.toLowerCase() === tagFilter.toLowerCase(),
    );
    return exists ? tagFilter : null;
  }, [allTags, tagFilter]);

  const visible = useMemo(() => {
    return todos.filter((todo) => {
      if (filter === "active" && todo.completed) return false;
      if (filter === "done" && !todo.completed) return false;
      if (
        scheduleFilter !== "all" &&
        getScheduleState(todo.dueAt) !== scheduleFilter
      ) {
        return false;
      }
      if (
        resolvedTagFilter &&
        !todo.tags.some(
          (tag) => tag.toLowerCase() === resolvedTagFilter.toLowerCase(),
        )
      ) {
        return false;
      }
      return true;
    });
  }, [todos, filter, scheduleFilter, resolvedTagFilter]);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 py-6 sm:gap-6 sm:px-6 sm:py-10">
      <TodoHeader onLogout={logout} />

      <TodoComposer allTags={allTags} onCreate={createTodo} />

      <TodoFilters
        filter={filter}
        scheduleFilter={scheduleFilter}
        resolvedTagFilter={resolvedTagFilter}
        allTags={allTags}
        visibleCount={visible.length}
        onFilterChange={setFilter}
        onScheduleFilterChange={setScheduleFilter}
        onTagFilterChange={setTagFilter}
      />

      <TodoList
        loading={loading}
        todos={todos}
        visible={visible}
        deletingIds={deletingIds}
        retryingIds={retryingIds}
        onToggleCompleted={(todo, checked) => {
          void patchTodo(
            todo.id,
            { completed: checked },
            { quietSuccess: true },
          );
        }}
        onEdit={setEditing}
        onAskDelete={setPendingDelete}
        onRetrySync={(id) => void retrySync(id)}
        onTagClick={setTagFilter}
      />

      <TodoEditModal
        todo={editing}
        allTags={allTags}
        icloud={icloud}
        onSave={(id, payload) =>
          patchTodo(id, payload, { quietSuccess: true })
        }
        onSaved={(updated) => {
          setEditing(null);
          mergeCatalogTagsFromTodo(updated.tags);
        }}
        onClose={() => setEditing(null)}
      />

      <TodoDeleteModal
        todo={pendingDelete}
        icloud={icloud}
        deleting={
          pendingDelete ? deletingIds.has(pendingDelete.id) : false
        }
        onConfirm={removeTodo}
        onClose={() => setPendingDelete(null)}
      />
    </div>
  );
}
