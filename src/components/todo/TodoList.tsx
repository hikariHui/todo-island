"use client";

import { Card } from "animal-island-ui";
import type { Todo } from "@/lib/types";
import { TodoItem } from "./TodoItem";

type TodoListProps = {
  loading: boolean;
  todos: Todo[];
  visible: Todo[];
  deletingIds: Set<string>;
  retryingIds: Set<string>;
  onToggleCompleted: (todo: Todo, checked: boolean) => void;
  onEdit: (todo: Todo) => void;
  onAskDelete: (todo: Todo) => void;
  onRetrySync: (id: string) => void;
  onTagClick: (tag: string) => void;
};

export function TodoList({
  loading,
  todos,
  visible,
  deletingIds,
  retryingIds,
  onToggleCompleted,
  onEdit,
  onAskDelete,
  onRetrySync,
  onTagClick,
}: TodoListProps) {
  if (loading) {
    return <Card className="p-8 text-center text-[#7a6552]">加载中…</Card>;
  }

  if (visible.length === 0) {
    return (
      <Card
        color="app-blue"
        pattern="app-blue"
        className="p-8 text-center text-[#5c4a3a]"
      >
        {todos.length === 0
          ? "小岛上还没有待办，先加一条吧"
          : "当前筛选下没有待办"}
      </Card>
    );
  }

  return (
    <ul className="flex flex-col gap-3">
      {visible.map((todo) => (
        <li key={todo.id}>
          <TodoItem
            todo={todo}
            deleting={deletingIds.has(todo.id)}
            retrying={retryingIds.has(todo.id)}
            onToggleCompleted={(checked) => onToggleCompleted(todo, checked)}
            onEdit={() => onEdit(todo)}
            onAskDelete={() => onAskDelete(todo)}
            onRetrySync={() => onRetrySync(todo.id)}
            onTagClick={onTagClick}
          />
        </li>
      ))}
    </ul>
  );
}
