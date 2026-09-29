import {
  isAllDayDue,
  isMonthDue,
  isTimedDue,
  isYearDue,
} from "./due";

export const MAX_TITLE_LENGTH = 500;

export function normalizeTitle(
  input: unknown,
): { ok: true; title: string } | { ok: false; error: string } {
  if (typeof input !== "string") {
    return { ok: false, error: "标题无效" };
  }
  const title = input.trim();
  if (!title) {
    return { ok: false, error: "标题不能为空" };
  }
  if (title.length > MAX_TITLE_LENGTH) {
    return { ok: false, error: `标题不能超过 ${MAX_TITLE_LENGTH} 字` };
  }
  return { ok: true, title };
}

/**
 * @param optional when true, `undefined` means “field omitted” (PATCH).
 */
export function normalizeDueAt(
  input: unknown,
  optional: boolean,
):
  | { ok: true; dueAt: string | null | undefined }
  | { ok: false; error: string } {
  if (input === undefined) {
    return optional
      ? { ok: true, dueAt: undefined }
      : { ok: true, dueAt: null };
  }
  if (input === null || input === "") {
    return { ok: true, dueAt: null };
  }
  if (typeof input !== "string") {
    return { ok: false, error: "日期格式无效" };
  }
  if (
    isYearDue(input) ||
    isMonthDue(input) ||
    isAllDayDue(input) ||
    isTimedDue(input)
  ) {
    return { ok: true, dueAt: input };
  }
  return {
    ok: false,
    error:
      "日期格式无效（需 YYYY、YYYY-MM、YYYY-MM-DD 或 YYYY-MM-DDTHH:mm[:ss]）",
  };
}
