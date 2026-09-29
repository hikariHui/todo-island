"use client";

import { Button, Card, Switch, Tag } from "animal-island-ui";
import { tagColor } from "@/components/MultiSelectTags";
import {
  formatDueLabel,
  getScheduleState,
  isCalendarSyncable,
  scheduleStateLabel,
} from "@/lib/due";
import type { Todo } from "@/lib/types";
import { formatCompletedLabel } from "./format";

type TodoItemProps = {
  todo: Todo;
  deleting: boolean;
  retrying: boolean;
  onToggleCompleted: (checked: boolean) => void;
  onEdit: () => void;
  onAskDelete: () => void;
  onRetrySync: () => void;
  onTagClick: (tag: string) => void;
};

export function TodoItem({
  todo,
  deleting,
  retrying,
  onToggleCompleted,
  onEdit,
  onAskDelete,
  onRetrySync,
  onTagClick,
}: TodoItemProps) {
  const scheduleState = getScheduleState(todo.dueAt);

  return (
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
            onChange={onToggleCompleted}
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
            <Tag
              size="small"
              color={
                scheduleState === "scheduled"
                  ? "app-orange"
                  : scheduleState === "tentative"
                    ? "app-yellow"
                    : "default"
              }
              variant="soft"
            >
              {formatDueLabel(todo.dueAt)}
            </Tag>
            {scheduleState !== "unscheduled" ? (
              <Tag size="small" color="default" variant="outlined">
                {scheduleStateLabel(scheduleState)}
              </Tag>
            ) : null}
            {todo.completed && todo.completedAt ? (
              <Tag size="small" color="app-green" variant="outlined">
                {formatCompletedLabel(todo.completedAt)}
              </Tag>
            ) : null}
            {todo.tags.map((tag) => (
              <Tag
                key={tag}
                size="small"
                color={tagColor(tag)}
                variant="soft"
                onClick={() => onTagClick(tag)}
              >
                {tag}
              </Tag>
            ))}
            {todo.calendarSyncPending ? (
              <Tag size="small" color="app-yellow" variant="outlined">
                同步中
              </Tag>
            ) : null}
            {isCalendarSyncable(todo.dueAt) &&
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
                loading={retrying}
                disabled={retrying}
                onClick={onRetrySync}
              >
                重试同步
              </Button>
            ) : null}
          </div>
        </div>
        <div className="flex gap-2 self-end sm:self-start">
          <Button type="default" size="small" onClick={onEdit}>
            编辑
          </Button>
          <Button
            type="primary"
            danger
            size="small"
            loading={deleting}
            disabled={deleting}
            onClick={onAskDelete}
          >
            删除
          </Button>
        </div>
      </div>
    </Card>
  );
}
