"use client";

import { Modal } from "animal-island-ui";
import type { IcloudInfo } from "@/hooks/useTodos";
import type { Todo } from "@/lib/types";

type TodoDeleteModalProps = {
  todo: Todo | null;
  icloud: IcloudInfo;
  deleting: boolean;
  onConfirm: (id: string) => Promise<boolean>;
  onClose: () => void;
};

export function TodoDeleteModal({
  todo,
  icloud,
  deleting,
  onConfirm,
  onClose,
}: TodoDeleteModalProps) {
  return (
    <Modal
      open={Boolean(todo)}
      title="确认删除"
      typewriter={false}
      onClose={() => {
        if (todo && deleting) return;
        onClose();
      }}
      onOk={() => {
        if (todo) void onConfirm(todo.id).then((ok) => {
          if (ok) onClose();
        });
      }}
      width="min(92vw, 420px)"
    >
      <p className="py-2 text-sm text-[#5c4a3a]">
        确定删除「{todo?.title}」吗？此操作不可撤销
        {icloud.configured && todo?.calendarObjectUrl
          ? "，并会同步从日历移除。"
          : "。"}
      </p>
    </Modal>
  );
}
