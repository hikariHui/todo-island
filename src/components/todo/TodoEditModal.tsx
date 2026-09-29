"use client";

import { useState } from "react";
import { Input, Modal } from "animal-island-ui";
import { MultiSelectTags } from "@/components/MultiSelectTags";
import { IslandDuePicker } from "@/components/IslandDuePicker";
import { toast } from "@/components/Toast";
import {
  dueDraftFromDueAt,
  validateDueDraftForSubmit,
  type DueDraft,
} from "@/lib/due";
import type { Todo } from "@/lib/types";
import type { IcloudInfo } from "@/hooks/useTodos";

type TodoEditModalProps = {
  todo: Todo | null;
  allTags: string[];
  icloud: IcloudInfo;
  onSave: (
    id: string,
    payload: { title: string; tags: string[]; dueAt: string | null },
  ) => Promise<Todo | null>;
  onSaved: (todo: Todo) => void;
  onClose: () => void;
};

type EditFormProps = {
  todo: Todo;
  allTags: string[];
  icloud: IcloudInfo;
  onSave: TodoEditModalProps["onSave"];
  onSaved: TodoEditModalProps["onSaved"];
  onClose: () => void;
};

function TodoEditForm({
  todo,
  allTags,
  icloud,
  onSave,
  onSaved,
  onClose,
}: EditFormProps) {
  const [title, setTitle] = useState(todo.title);
  const [tags, setTags] = useState(() => [...todo.tags]);
  const [due, setDue] = useState<DueDraft>(() => dueDraftFromDueAt(todo.dueAt));
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (saving) return;
    const trimmed = title.trim();
    if (!trimmed) {
      toast.warning({ message: "标题不能为空" });
      return;
    }
    const dueResult = validateDueDraftForSubmit(due);
    if (!dueResult.ok) {
      toast.warning({ message: dueResult.message });
      return;
    }
    setSaving(true);
    try {
      const updated = await onSave(todo.id, {
        title: trimmed,
        tags,
        dueAt: dueResult.dueAt,
      });
      if (updated) {
        onSaved(updated);
        if (icloud.configured && updated.calendarSyncPending) {
          toast.success({ message: "已保存，日历同步中" });
        } else {
          toast.success({ message: "已保存" });
        }
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open
      title="编辑待办"
      typewriter={false}
      onClose={() => {
        if (!saving) onClose();
      }}
      onOk={() => void handleSave()}
      width="min(92vw, 480px)"
    >
      <div className="flex w-full flex-col gap-3 py-2">
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="标题"
        />
        <MultiSelectTags
          options={allTags}
          value={tags}
          onChange={setTags}
          layout="panel"
          emptyHint="还没有标签，先去「标签管理」创建"
        />
        <IslandDuePicker
          key={todo.id}
          value={due}
          onChange={setDue}
          hint
        />
      </div>
    </Modal>
  );
}

export function TodoEditModal({
  todo,
  allTags,
  icloud,
  onSave,
  onSaved,
  onClose,
}: TodoEditModalProps) {
  if (!todo) return null;

  return (
    <TodoEditForm
      key={todo.id}
      todo={todo}
      allTags={allTags}
      icloud={icloud}
      onSave={onSave}
      onSaved={onSaved}
      onClose={onClose}
    />
  );
}
