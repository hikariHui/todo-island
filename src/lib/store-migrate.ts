import { compareTodoOrder } from "./due";
import type { Todo, TodoStore } from "./types";

/** 持久化 JSON 的 schema 版本；大改数据结构时递增并在此注册迁移。 */
export const CURRENT_STORE_SCHEMA_VERSION = 3;

export type RawStoreFile = {
  schemaVersion?: unknown;
  tags?: unknown;
  todos?: unknown;
};

function sortTodosInPlace(todos: Todo[]): void {
  todos.sort((a, b) => compareTodoOrder(a, b));
}

/**
 * v1 → v2：写入 schemaVersion；dueAt 仍兼容 null / YYYY / YYYY-MM / 日 / 定点；
 * 列表顺序改为持久化排序（不再在查询时重排）。
 */
function migrateV1ToV2(store: TodoStore): TodoStore {
  sortTodosInPlace(store.todos);
  return { ...store, schemaVersion: 2 };
}

/** v2 → v3：已过期排序改为越早过期越靠前，全量重排。 */
function migrateV2ToV3(store: TodoStore): TodoStore {
  sortTodosInPlace(store.todos);
  return { ...store, schemaVersion: 3 };
}

const STEPS: Array<(store: TodoStore) => TodoStore> = [
  migrateV1ToV2, // index 0: 1→2
  migrateV2ToV3, // index 1: 2→3
];

/**
 * 将磁盘上的原始 JSON 迁移到 CURRENT_STORE_SCHEMA_VERSION。
 * @returns migrated 为 true 时表示需要回写磁盘。
 */
export function migrateStoreFile(
  raw: RawStoreFile,
  todos: Todo[],
  tags: string[],
): { store: TodoStore; migrated: boolean } {
  let version =
    typeof raw.schemaVersion === "number" &&
    Number.isFinite(raw.schemaVersion) &&
    raw.schemaVersion >= 1
      ? Math.floor(raw.schemaVersion)
      : 1;

  let store: TodoStore = {
    schemaVersion: version,
    tags,
    todos,
  };

  if (version >= CURRENT_STORE_SCHEMA_VERSION) {
    return { store, migrated: false };
  }

  while (version < CURRENT_STORE_SCHEMA_VERSION) {
    const step = STEPS[version - 1];
    if (!step) {
      throw new Error(
        `缺少 schema 迁移：${version} → ${version + 1}（当前目标 ${CURRENT_STORE_SCHEMA_VERSION}）`,
      );
    }
    store = step(store);
    version += 1;
  }

  store.schemaVersion = CURRENT_STORE_SCHEMA_VERSION;
  return { store, migrated: true };
}
