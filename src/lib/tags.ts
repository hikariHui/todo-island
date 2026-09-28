const MAX_TAG_LENGTH = 20;
const MAX_TAGS_PER_TODO = 8;

export function normalizeTagName(input: unknown): string {
  if (typeof input !== "string") return "";
  return input.trim().replace(/\s+/g, " ").slice(0, MAX_TAG_LENGTH);
}

/** 规范化标签：去空白、去重、限长限量 */
export function normalizeTags(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  const seen = new Set<string>();
  const result: string[] = [];
  for (const raw of input) {
    const tag = normalizeTagName(raw);
    if (!tag) continue;
    const key = tag.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(tag);
    if (result.length >= MAX_TAGS_PER_TODO) break;
  }
  return result;
}

export function collectAllTags(todos: { tags?: string[] }[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const todo of todos) {
    for (const tag of todo.tags ?? []) {
      const key = tag.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      result.push(tag);
    }
  }
  return result.sort((a, b) => a.localeCompare(b, "zh-CN"));
}

export { MAX_TAG_LENGTH, MAX_TAGS_PER_TODO as MAX_TAGS };
