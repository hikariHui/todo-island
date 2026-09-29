"use client";

import { useCallback, useSyncExternalStore } from "react";
import type { ScheduleState } from "@/lib/due";

export type StatusFilter = "all" | "active" | "done";
export type ScheduleFilter = "all" | ScheduleState;

export type StoredFilters = {
  filter: StatusFilter;
  scheduleFilter: ScheduleFilter;
  tagFilter: string | null;
};

const FILTERS_STORAGE_KEY = "todo-island:filters";
const DEFAULT_FILTERS: StoredFilters = {
  filter: "all",
  scheduleFilter: "all",
  tagFilter: null,
};

function isStatusFilter(value: unknown): value is StatusFilter {
  return value === "all" || value === "active" || value === "done";
}

function isScheduleFilter(value: unknown): value is ScheduleFilter {
  return (
    value === "all" ||
    value === "unscheduled" ||
    value === "tentative" ||
    value === "scheduled"
  );
}

function parseStoredFilters(raw: string | null): StoredFilters {
  if (!raw) return DEFAULT_FILTERS;
  try {
    const parsed = JSON.parse(raw) as {
      filter?: unknown;
      scheduleFilter?: unknown;
      tagFilter?: unknown;
    };
    return {
      filter: isStatusFilter(parsed.filter) ? parsed.filter : "all",
      scheduleFilter: isScheduleFilter(parsed.scheduleFilter)
        ? parsed.scheduleFilter
        : "all",
      tagFilter:
        typeof parsed.tagFilter === "string" && parsed.tagFilter.trim()
          ? parsed.tagFilter
          : null,
    };
  } catch {
    return DEFAULT_FILTERS;
  }
}

/** Same-tab + cross-tab localStorage subscription for filters. */
const filtersListeners = new Set<() => void>();
let filtersCacheRaw: string | null | undefined;
let filtersCacheValue: StoredFilters = DEFAULT_FILTERS;

function subscribeFilters(onStoreChange: () => void): () => void {
  filtersListeners.add(onStoreChange);
  const onStorage = (event: StorageEvent) => {
    if (event.key === FILTERS_STORAGE_KEY || event.key === null) {
      onStoreChange();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    filtersListeners.delete(onStoreChange);
    window.removeEventListener("storage", onStorage);
  };
}

function getFiltersSnapshot(): StoredFilters {
  try {
    const raw = window.localStorage.getItem(FILTERS_STORAGE_KEY);
    if (raw === filtersCacheRaw) return filtersCacheValue;
    filtersCacheRaw = raw;
    filtersCacheValue = parseStoredFilters(raw);
    return filtersCacheValue;
  } catch {
    return DEFAULT_FILTERS;
  }
}

function getFiltersServerSnapshot(): StoredFilters {
  return DEFAULT_FILTERS;
}

function writeStoredFilters(next: StoredFilters): void {
  const raw = JSON.stringify(next);
  try {
    window.localStorage.setItem(FILTERS_STORAGE_KEY, raw);
  } catch {
    // ignore quota / private mode
  }
  filtersCacheRaw = raw;
  filtersCacheValue = next;
  for (const listener of filtersListeners) listener();
}

export function useTodoFilters() {
  const storedFilters = useSyncExternalStore(
    subscribeFilters,
    getFiltersSnapshot,
    getFiltersServerSnapshot,
  );

  const setFilter = useCallback((next: StatusFilter) => {
    writeStoredFilters({ ...getFiltersSnapshot(), filter: next });
  }, []);
  const setScheduleFilter = useCallback((next: ScheduleFilter) => {
    writeStoredFilters({ ...getFiltersSnapshot(), scheduleFilter: next });
  }, []);
  const setTagFilter = useCallback((next: string | null) => {
    writeStoredFilters({ ...getFiltersSnapshot(), tagFilter: next });
  }, []);

  return {
    filter: storedFilters.filter,
    scheduleFilter: storedFilters.scheduleFilter,
    tagFilter: storedFilters.tagFilter,
    setFilter,
    setScheduleFilter,
    setTagFilter,
  };
}
