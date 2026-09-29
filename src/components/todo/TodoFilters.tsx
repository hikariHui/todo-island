"use client";

import { useState } from "react";
import { Tag } from "animal-island-ui";
import { tagColor } from "@/components/MultiSelectTags";
import type {
  ScheduleFilter,
  StatusFilter,
} from "@/hooks/useTodoFilters";

type TodoFiltersProps = {
  filter: StatusFilter;
  scheduleFilter: ScheduleFilter;
  resolvedTagFilter: string | null;
  allTags: string[];
  visibleCount: number;
  onFilterChange: (next: StatusFilter) => void;
  onScheduleFilterChange: (next: ScheduleFilter) => void;
  onTagFilterChange: (next: string | null) => void;
};

export function TodoFilters({
  filter,
  scheduleFilter,
  resolvedTagFilter,
  allTags,
  visibleCount,
  onFilterChange,
  onScheduleFilterChange,
  onTagFilterChange,
}: TodoFiltersProps) {
  const [panelOpen, setPanelOpen] = useState(false);

  const statusFilterLabel =
    filter === "active" ? "待办" : filter === "done" ? "已完成" : "全部";
  const scheduleFilterLabel =
    scheduleFilter === "unscheduled"
      ? "未排期"
      : scheduleFilter === "tentative"
        ? "待确定"
        : scheduleFilter === "scheduled"
          ? "已排期"
          : "全部";
  const filtersActive =
    filter !== "all" ||
    scheduleFilter !== "all" ||
    resolvedTagFilter !== null;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2 sm:hidden">
        <button
          type="button"
          className="flex min-w-0 flex-1 items-center justify-between gap-2 rounded-full border-2 border-[#e8dcc8] bg-[#fffbe7] px-4 py-2.5 text-left transition hover:border-[#d4c4a8]"
          aria-expanded={panelOpen}
          onClick={() => setPanelOpen((open) => !open)}
        >
          <span className="flex min-w-0 flex-wrap items-center gap-1.5">
            <span className="text-xs font-bold text-[#725d42]">筛选</span>
            {filtersActive ? (
              <>
                {filter !== "all" ? (
                  <Tag size="small" color="app-green" variant="soft">
                    {statusFilterLabel}
                  </Tag>
                ) : null}
                {scheduleFilter !== "all" ? (
                  <Tag
                    size="small"
                    color={
                      scheduleFilter === "scheduled"
                        ? "app-orange"
                        : "app-yellow"
                    }
                    variant="soft"
                  >
                    {scheduleFilterLabel}
                  </Tag>
                ) : null}
                {resolvedTagFilter ? (
                  <Tag
                    size="small"
                    color={tagColor(resolvedTagFilter)}
                    variant="soft"
                  >
                    {resolvedTagFilter}
                  </Tag>
                ) : null}
              </>
            ) : (
              <span className="text-xs text-[#c4b89e]">状态 · 排期 · 标签</span>
            )}
          </span>
          <span className="shrink-0 text-xs font-bold text-[#a0936e]">
            {panelOpen ? "收起" : "展开"}
          </span>
        </button>
        <span className="shrink-0 text-xs text-[#7a6552]">
          {visibleCount} 项
        </span>
      </div>

      <div
        className={[
          "flex-col gap-3",
          panelOpen ? "flex" : "hidden",
          "sm:flex",
        ].join(" ")}
      >
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-[#7a6552]">状态：</span>
          {(
            [
              ["all", "全部"],
              ["active", "待办"],
              ["done", "已完成"],
            ] as const
          ).map(([key, label]) => (
            <Tag
              key={key}
              size="small"
              color={
                key === "active"
                  ? "app-green"
                  : key === "done"
                    ? "app-teal"
                    : "default"
              }
              variant={filter === key ? "solid" : "outlined"}
              onClick={() => onFilterChange(key)}
            >
              {label}
            </Tag>
          ))}
          <span className="ml-auto hidden text-xs text-[#7a6552] sm:inline sm:text-sm">
            {visibleCount} 项
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-[#7a6552]">排期：</span>
          {(
            [
              ["all", "全部"],
              ["unscheduled", "未排期"],
              ["tentative", "待确定"],
              ["scheduled", "已排期"],
            ] as const
          ).map(([key, label]) => (
            <Tag
              key={key}
              size="small"
              color={
                key === "scheduled"
                  ? "app-orange"
                  : key === "tentative"
                    ? "app-yellow"
                    : "default"
              }
              variant={scheduleFilter === key ? "solid" : "outlined"}
              onClick={() => onScheduleFilterChange(key)}
            >
              {label}
            </Tag>
          ))}
        </div>

        {allTags.length > 0 ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-[#7a6552]">标签：</span>
            <Tag
              size="small"
              color="default"
              variant={resolvedTagFilter === null ? "solid" : "outlined"}
              onClick={() => onTagFilterChange(null)}
            >
              全部
            </Tag>
            {allTags.map((tag) => {
              const active =
                resolvedTagFilter?.toLowerCase() === tag.toLowerCase();
              return (
                <Tag
                  key={tag}
                  size="small"
                  color={tagColor(tag)}
                  variant={active ? "solid" : "outlined"}
                  onClick={() => onTagFilterChange(active ? null : tag)}
                >
                  {tag}
                </Tag>
              );
            })}
          </div>
        ) : null}
      </div>
    </div>
  );
}
