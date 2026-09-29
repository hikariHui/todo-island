"use client";

import { useMemo, useState } from "react";
import { Button } from "animal-island-ui";
import type { DueDraft } from "@/lib/due";
import { emptyDueDraft } from "@/lib/due";

export type { DueDraft };

const WEEKDAYS = ["日", "一", "二", "三", "四", "五", "六"];

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function toDateKey(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function parseDateKey(key: string | null): Date | null {
  if (!key) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(d.getTime()) ? null : d;
}

function formatSummary(draft: DueDraft): string {
  if (draft.kind === "none") return "未排期";
  if (draft.kind === "year" && draft.year) return `${draft.year}年（待确定）`;
  if (draft.kind === "month" && draft.year && draft.month) {
    return `${draft.year}年${Number(draft.month)}月（待确定）`;
  }
  if (draft.kind === "day" && draft.date) {
    const d = parseDateKey(draft.date);
    if (!d) return "选择具体日期";
    const base = `${d.getMonth() + 1}月${d.getDate()}日`;
    if (draft.timed && draft.time) return `${base} ${draft.time.slice(0, 5)}`;
    return `${base} · 全天`;
  }
  return "设置时间";
}

function formatTimeLabel(time: string | null): string {
  if (!time) return "选择时间";
  return time.slice(0, 5);
}

function buildMonthCells(view: Date): Array<{
  key: string;
  day: number;
  outside: boolean;
  dateKey: string;
}> {
  const year = view.getFullYear();
  const month = view.getMonth();
  const first = new Date(year, month, 1);
  const startPad = first.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const prevDays = new Date(year, month, 0).getDate();
  const cells: Array<{
    key: string;
    day: number;
    outside: boolean;
    dateKey: string;
  }> = [];

  for (let i = 0; i < startPad; i += 1) {
    const day = prevDays - startPad + i + 1;
    const d = new Date(year, month - 1, day);
    cells.push({
      key: `p-${day}`,
      day,
      outside: true,
      dateKey: toDateKey(d),
    });
  }
  for (let day = 1; day <= daysInMonth; day += 1) {
    const d = new Date(year, month, day);
    cells.push({
      key: `c-${day}`,
      day,
      outside: false,
      dateKey: toDateKey(d),
    });
  }
  while (cells.length % 7 !== 0 || cells.length < 42) {
    const day = cells.length - startPad - daysInMonth + 1;
    const d = new Date(year, month + 1, day);
    cells.push({
      key: `n-${day}`,
      day,
      outside: true,
      dateKey: toDateKey(d),
    });
  }
  return cells;
}

const triggerClass =
  "flex h-10 w-full items-center justify-between gap-2 rounded-full border-2 border-[#e8dcc8] bg-[#fffbe7] px-4 text-left text-sm font-medium text-[#725d42] transition hover:border-[#d4c4a8] hover:shadow-[0_3px_0_#c4b89e]";

const panelClass =
  "w-full rounded-[20px] border-[1.5px] border-[#e8dcc8] bg-[#fffdf7] p-3 shadow-[0_6px_18px_rgba(61,52,40,0.12)]";

const navBtnClass =
  "flex h-8 w-8 items-center justify-center rounded-full text-[#725d42] hover:bg-[#ffd54f]";

const monthTitleClass = "text-sm font-bold text-[#725d42]";
const weekdayClass = "text-center text-[11px] font-bold text-[#a09080]";
const valueTextClass = "text-[#725d42]";
const placeholderTextClass = "text-[#c4b89e]";
const mutedActionClass = "text-xs text-[#a0936e]";
const todayBtnClass =
  "rounded-xl px-3 py-1.5 text-xs font-bold text-[#8a7b66] hover:bg-[#725d421a]";
const columnTitleClass =
  "mb-2 text-center text-[11px] font-bold tracking-wider text-[#a09080]";
const dayBaseClass =
  "flex h-9 items-center justify-center rounded-2xl text-sm font-medium transition";
const dayOutsideClass = "text-[#c4b89e]";
const dayNormalClass = "text-[#725d42]";
const daySelectedClass = "bg-[#ffb400] font-bold text-white";
const dayTodayClass = "bg-[#ffd54f]";
const dayHoverClass = "hover:bg-[#ffd54f]";
const timeOptionBaseClass =
  "h-8 shrink-0 rounded-2xl text-sm font-medium transition";
const timeOptionIdleClass = "text-[#725d42] hover:bg-[#ffd54f]";

const hintClass = "text-xs text-[#7a6552]";

const modeBtnClass = (active: boolean) =>
  [
    "rounded-full px-3 py-1.5 text-xs font-bold transition",
    active
      ? "bg-[#ffb400] text-white shadow-[0_2px_0_#c4a000]"
      : "bg-[#fffbe7] text-[#725d42] border border-[#e8dcc8] hover:bg-[#ffd54f]",
  ].join(" ");

export function IslandDuePicker({
  value,
  onChange,
  hint,
}: {
  value: DueDraft;
  onChange: (next: DueDraft) => void;
  hint?: boolean;
}) {
  const now = new Date();
  const initialYear = value.year ?? String(now.getFullYear());
  const initialMonthView =
    value.kind === "month" && value.year && value.month
      ? new Date(Number(value.year), Number(value.month) - 1, 1)
      : value.kind === "day" && value.date
        ? parseDateKey(value.date) ?? now
        : now;

  const [yearView, setYearView] = useState(() => Number(initialYear));
  const [view, setView] = useState(
    () =>
      new Date(initialMonthView.getFullYear(), initialMonthView.getMonth(), 1),
  );
  const [panelOpen, setPanelOpen] = useState(value.kind === "none");

  const todayKey = toDateKey(new Date());
  const cells = useMemo(() => buildMonthCells(view), [view]);
  const hour = value.time ? Number(value.time.slice(0, 2)) : 9;
  const minute = value.time ? Number(value.time.slice(3, 5)) : 0;
  const [timeOpen, setTimeOpen] = useState(false);

  function setKind(kind: DueDraft["kind"]) {
    if (kind === "none") {
      onChange(emptyDueDraft());
      setPanelOpen(true);
      return;
    }
    if (kind === "year") {
      onChange({
        kind: "year",
        year: String(yearView),
        month: null,
        date: null,
        timed: false,
        time: null,
      });
      setPanelOpen(true);
      return;
    }
    if (kind === "month") {
      const y = String(view.getFullYear());
      const m = pad(view.getMonth() + 1);
      onChange({
        kind: "month",
        year: y,
        month: m,
        date: null,
        timed: false,
        time: null,
      });
      setPanelOpen(true);
      return;
    }
    onChange({
      kind: "day",
      year: String(view.getFullYear()),
      month: pad(view.getMonth() + 1),
      date: null,
      timed: false,
      time: null,
    });
    setPanelOpen(true);
  }

  return (
    <div className="flex w-full flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        {(
          [
            ["none", "未排期"],
            ["year", "按年"],
            ["month", "按月"],
            ["day", "具体日"],
          ] as const
        ).map(([kind, label]) => (
          <button
            key={kind}
            type="button"
            className={modeBtnClass(value.kind === kind)}
            onClick={() => setKind(kind)}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-start">
        <div className="min-w-0 flex-1">
          <button
            type="button"
            className={triggerClass}
            onClick={() => setPanelOpen((prev) => !prev)}
          >
            <span
              className={
                value.kind === "none" ? placeholderTextClass : valueTextClass
              }
            >
              {formatSummary(value)}
            </span>
            <span className={mutedActionClass}>
              {panelOpen ? "收起" : "调整"}
            </span>
          </button>
        </div>
        {value.kind !== "none" ? (
          <Button
            type="default"
            size="middle"
            onClick={() => {
              onChange(emptyDueDraft());
              setPanelOpen(true);
              setTimeOpen(false);
            }}
          >
            清除
          </Button>
        ) : null}
      </div>

      {panelOpen && value.kind === "year" ? (
        <div className={panelClass}>
          <div className="mb-2 flex items-center justify-between gap-2">
            <button
              type="button"
              className={navBtnClass}
              aria-label="上一年"
              onClick={() => {
                const next = yearView - 1;
                setYearView(next);
                onChange({ ...value, kind: "year", year: String(next) });
              }}
            >
              ‹
            </button>
            <div className={monthTitleClass}>{yearView}年</div>
            <button
              type="button"
              className={navBtnClass}
              aria-label="下一年"
              onClick={() => {
                const next = yearView + 1;
                setYearView(next);
                onChange({ ...value, kind: "year", year: String(next) });
              }}
            >
              ›
            </button>
          </div>
          <div className="flex justify-end">
            <button
              type="button"
              className={todayBtnClass}
              onClick={() => {
                const y = new Date().getFullYear();
                setYearView(y);
                onChange({
                  kind: "year",
                  year: String(y),
                  month: null,
                  date: null,
                  timed: false,
                  time: null,
                });
              }}
            >
              今年
            </button>
          </div>
        </div>
      ) : null}

      {panelOpen && value.kind === "month" ? (
        <div className={panelClass}>
          <div className="mb-2 flex items-center justify-between gap-2">
            <button
              type="button"
              className={navBtnClass}
              aria-label="上一年"
              onClick={() => setView(new Date(view.getFullYear() - 1, 0, 1))}
            >
              ‹
            </button>
            <div className={monthTitleClass}>{view.getFullYear()}年</div>
            <button
              type="button"
              className={navBtnClass}
              aria-label="下一年"
              onClick={() => setView(new Date(view.getFullYear() + 1, 0, 1))}
            >
              ›
            </button>
          </div>
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
            {Array.from({ length: 12 }, (_, i) => {
              const m = pad(i + 1);
              const selected =
                value.month === m &&
                value.year === String(view.getFullYear());
              return (
                <button
                  key={m}
                  type="button"
                  className={[
                    dayBaseClass,
                    selected ? daySelectedClass : dayHoverClass,
                    dayNormalClass,
                  ].join(" ")}
                  onClick={() => {
                    onChange({
                      kind: "month",
                      year: String(view.getFullYear()),
                      month: m,
                      date: null,
                      timed: false,
                      time: null,
                    });
                  }}
                >
                  {i + 1}月
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      {panelOpen && value.kind === "day" ? (
        <>
          <div className={panelClass}>
            <div className="mb-2 flex items-center justify-between gap-2">
              <button
                type="button"
                className={navBtnClass}
                aria-label="上个月"
                onClick={() =>
                  setView(new Date(view.getFullYear(), view.getMonth() - 1, 1))
                }
              >
                ‹
              </button>
              <div className={monthTitleClass}>
                {view.getFullYear()}年{view.getMonth() + 1}月
              </div>
              <button
                type="button"
                className={navBtnClass}
                aria-label="下个月"
                onClick={() =>
                  setView(new Date(view.getFullYear(), view.getMonth() + 1, 1))
                }
              >
                ›
              </button>
            </div>

            <div className="mb-1 grid grid-cols-7 gap-1">
              {WEEKDAYS.map((day) => (
                <div key={day} className={weekdayClass}>
                  {day}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-1">
              {cells.map((cell) => {
                const selected = value.date === cell.dateKey;
                const isToday = cell.dateKey === todayKey;
                return (
                  <button
                    key={cell.key}
                    type="button"
                    className={[
                      dayBaseClass,
                      cell.outside ? dayOutsideClass : dayNormalClass,
                      selected
                        ? daySelectedClass
                        : isToday
                          ? dayTodayClass
                          : dayHoverClass,
                    ].join(" ")}
                    onClick={() => {
                      onChange({
                        kind: "day",
                        year: cell.dateKey.slice(0, 4),
                        month: cell.dateKey.slice(5, 7),
                        date: cell.dateKey,
                        timed: value.timed,
                        time: value.timed
                          ? value.time || "09:00:00"
                          : null,
                      });
                    }}
                  >
                    {cell.day}
                  </button>
                );
              })}
            </div>

            <div className="mt-2 flex justify-end">
              <button
                type="button"
                className={todayBtnClass}
                onClick={() => {
                  const today = new Date();
                  const key = toDateKey(today);
                  onChange({
                    kind: "day",
                    year: key.slice(0, 4),
                    month: key.slice(5, 7),
                    date: key,
                    timed: value.timed,
                    time: value.timed ? value.time || "09:00:00" : null,
                  });
                  setView(
                    new Date(today.getFullYear(), today.getMonth(), 1),
                  );
                }}
              >
                今天
              </button>
            </div>
          </div>

          {value.date ? (
            <div className="flex shrink-0 flex-wrap gap-2">
              <Button
                type={value.timed ? "primary" : "default"}
                size="middle"
                onClick={() => {
                  if (value.timed) {
                    setTimeOpen(false);
                    onChange({ ...value, timed: false, time: null });
                  } else {
                    const nextTime = value.time || "09:00:00";
                    onChange({ ...value, timed: true, time: nextTime });
                    setTimeOpen(true);
                  }
                }}
              >
                {value.timed ? "改为全天" : "设定具体时间"}
              </Button>
            </div>
          ) : null}

          {value.date && value.timed ? (
            <div className="flex flex-col gap-2">
              <button
                type="button"
                className={triggerClass}
                onClick={() => setTimeOpen((prev) => !prev)}
              >
                <span>{formatTimeLabel(value.time)}</span>
                <span className={mutedActionClass}>
                  {timeOpen ? "收起" : "选时间"}
                </span>
              </button>

              {timeOpen ? (
                <div className={panelClass}>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <div className={columnTitleClass}>时</div>
                      <div className="flex max-h-48 flex-col gap-1 overflow-y-auto p-0.5">
                        {Array.from({ length: 24 }, (_, h) => (
                          <button
                            key={h}
                            type="button"
                            className={[
                              timeOptionBaseClass,
                              h === hour
                                ? daySelectedClass
                                : timeOptionIdleClass,
                            ].join(" ")}
                            onClick={() =>
                              onChange({
                                ...value,
                                time: `${pad(h)}:${pad(minute)}:00`,
                              })
                            }
                          >
                            {pad(h)}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <div className={columnTitleClass}>分</div>
                      <div className="flex max-h-48 flex-col gap-1 overflow-y-auto p-0.5">
                        {Array.from({ length: 12 }, (_, i) => {
                          const m = i * 5;
                          return (
                            <button
                              key={m}
                              type="button"
                              className={[
                                timeOptionBaseClass,
                                m === minute
                                  ? daySelectedClass
                                  : timeOptionIdleClass,
                              ].join(" ")}
                              onClick={() =>
                                onChange({
                                  ...value,
                                  time: `${pad(hour)}:${pad(m)}:00`,
                                })
                              }
                            >
                              {pad(m)}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}
        </>
      ) : null}

      {hint ? (
        <p className={hintClass}>
          {value.kind === "none"
            ? "未排期：不设时间，不同步日历"
            : value.kind === "year" || value.kind === "month"
              ? "待确定：仅精确到年或月，暂不同步日历"
              : value.timed
                ? "已排期：将同步为 iCloud 定点事件（默认 1 小时）"
                : "已排期：默认全天，将同步为 iCloud 全天事件"}
        </p>
      ) : null}
    </div>
  );
}
