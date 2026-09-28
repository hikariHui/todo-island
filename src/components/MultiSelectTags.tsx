"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Checkbox, Tag } from "animal-island-ui";
import { MAX_TAGS, normalizeTags } from "@/lib/tags";
import { toast } from "@/components/Toast";

type TagColor =
  | "app-pink"
  | "purple"
  | "app-blue"
  | "app-yellow"
  | "app-orange"
  | "app-teal"
  | "app-green"
  | "lime-green"
  | "brown"
  | "warm-peach-pink";

const TAG_COLORS: TagColor[] = [
  "app-teal",
  "app-blue",
  "app-pink",
  "purple",
  "app-yellow",
  "app-orange",
  "app-green",
  "lime-green",
  "brown",
  "warm-peach-pink",
];

export function tagColor(tag: string): TagColor {
  let hash = 0;
  for (let i = 0; i < tag.length; i += 1) {
    hash = (hash + tag.charCodeAt(i) * (i + 1)) % TAG_COLORS.length;
  }
  return TAG_COLORS[hash] ?? "app-teal";
}

export function MultiSelectTags({
  options,
  value,
  onChange,
  placeholder = "选择标签",
  emptyHint = "还没有标签，先去标签管理页创建",
  layout = "dropdown",
}: {
  options: string[];
  value: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
  emptyHint?: string;
  /** panel：选项在文档流内展开，避免被 Modal clip-path 裁切 */
  layout?: "dropdown" | "panel";
}) {
  const [open, setOpen] = useState(layout === "panel");
  const rootRef = useRef<HTMLDivElement>(null);
  const listId = useId();
  const isPanel = layout === "panel";

  useEffect(() => {
    if (!open || isPanel) return;
    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, isPanel]);

  const selected = normalizeTags(value);

  function toggleOpen() {
    if (isPanel) return;
    setOpen((prev) => !prev);
  }

  const optionList =
    open || isPanel ? (
      <div
        id={listId}
        role="listbox"
        aria-multiselectable
        className={
          isPanel
            ? "mt-2 max-h-56 overflow-auto rounded-2xl border-2 border-[#d8c4a8] bg-[#fffaf0] p-3"
            : "absolute left-0 right-0 z-30 mt-2 max-h-56 overflow-auto rounded-2xl border-2 border-[#d8c4a8] bg-[#fffaf0] p-3 shadow-lg"
        }
      >
        {options.length === 0 ? (
          <p className="px-1 py-2 text-sm text-[#7a6552]">{emptyHint}</p>
        ) : (
          <Checkbox
            direction="vertical"
            size="middle"
            options={options.map((tag) => ({
              label: tag,
              value: tag,
              disabled:
                selected.length >= MAX_TAGS &&
                !selected.some(
                  (item) => item.toLowerCase() === tag.toLowerCase(),
                ),
            }))}
            value={selected}
            onChange={(values) => {
              const next = normalizeTags(values.map(String));
              if (next.length > MAX_TAGS) {
                toast.warning({ message: `最多选择 ${MAX_TAGS} 个标签` });
                onChange(next.slice(0, MAX_TAGS));
                return;
              }
              onChange(next);
            }}
          />
        )}
      </div>
    ) : null;

  return (
    <div ref={rootRef} className="relative w-full">
      <div className="flex min-h-11 w-full items-center gap-2 rounded-2xl border-2 border-[#d8c4a8] bg-white px-3 py-2 transition hover:border-[#c4a882]">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
          {selected.length === 0 ? (
            isPanel ? (
              <span className="text-sm text-[#9a8b7a]">{placeholder}</span>
            ) : (
              <button
                type="button"
                className="text-sm text-[#9a8b7a]"
                aria-haspopup="listbox"
                aria-expanded={open}
                aria-controls={listId}
                onClick={toggleOpen}
              >
                {placeholder}
              </button>
            )
          ) : (
            selected.map((tag) => (
              <Tag
                key={tag}
                size="small"
                color={tagColor(tag)}
                variant="soft"
                closable
                onClose={() => {
                  onChange(selected.filter((item) => item !== tag));
                }}
              >
                {tag}
              </Tag>
            ))
          )}
        </div>
        {isPanel ? null : (
          <button
            type="button"
            className="shrink-0 rounded-lg px-2 py-1 text-xs text-[#7a6552] hover:bg-[#f3e6cf]"
            aria-haspopup="listbox"
            aria-expanded={open}
            aria-controls={listId}
            onClick={toggleOpen}
          >
            {open ? "收起" : "展开"}
          </button>
        )}
      </div>

      {optionList}
    </div>
  );
}
