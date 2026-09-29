"use client";

import { useState } from "react";
import { Button, Card, Input } from "animal-island-ui";
import { MultiSelectTags } from "@/components/MultiSelectTags";
import { IslandDuePicker } from "@/components/IslandDuePicker";
import { toast } from "@/components/Toast";
import { emptyDueDraft, validateDueDraftForSubmit } from "@/lib/due";
import type { DueDraft } from "@/lib/due";
import type { Todo } from "@/lib/types";

type TodoComposerProps = {
  allTags: string[];
  onCreate: (input: {
    title: string;
    tags: string[];
    dueAt: string | null;
  }) => Promise<Todo | null>;
};

export function TodoComposer({ allTags, onCreate }: TodoComposerProps) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [due, setDue] = useState<DueDraft>(emptyDueDraft);
  const [submitting, setSubmitting] = useState(false);

  async function handleCreate() {
    const trimmed = title.trim();
    if (!trimmed) {
      toast.warning({ message: "先写一下要做什么吧" });
      return;
    }
    const dueResult = validateDueDraftForSubmit(due);
    if (!dueResult.ok) {
      toast.warning({ message: dueResult.message });
      return;
    }
    setSubmitting(true);
    try {
      const created = await onCreate({
        title: trimmed,
        tags,
        dueAt: dueResult.dueAt,
      });
      if (!created) return;
      setTitle("");
      setTags([]);
      setDue(emptyDueDraft());
      setOpen(false);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card color="app-yellow" pattern="app-yellow" className="p-4 sm:p-6">
      {open ? (
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-bold text-[#725d42]">新建待办</span>
            <Button
              type="default"
              size="small"
              disabled={submitting}
              onClick={() => setOpen(false)}
            >
              收起
            </Button>
          </div>
          <Input
            size="large"
            placeholder="今天要做什么？"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void handleCreate();
              }
            }}
            autoFocus
          />
          <MultiSelectTags
            options={allTags}
            value={tags}
            onChange={setTags}
            emptyHint="还没有标签，先去「标签管理」创建"
          />
          <IslandDuePicker value={due} onChange={setDue} hint />
          <Button
            type="primary"
            size="large"
            loading={submitting}
            onClick={() => void handleCreate()}
            block
          >
            添加
          </Button>
        </div>
      ) : (
        <button
          type="button"
          className="flex w-full items-center justify-between gap-3 rounded-full border-2 border-[#e8dcc8] bg-[#fffbe7] px-4 py-3 text-left transition hover:border-[#d4c4a8] hover:shadow-[0_3px_0_#c4b89e]"
          onClick={() => setOpen(true)}
        >
          <span className="text-base font-medium text-[#c4b89e]">
            今天要做什么？
          </span>
          <span className="shrink-0 rounded-full bg-[#ffb400] px-3 py-1 text-sm font-bold text-white shadow-[0_2px_0_#c4a000]">
            添加
          </span>
        </button>
      )}
    </Card>
  );
}
