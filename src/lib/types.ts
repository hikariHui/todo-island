export type Todo = {
  id: string;
  title: string;
  /** 用户标签，用于列表筛选 */
  tags: string[];
  completed: boolean;
  /** 完成时间 ISO；未完成时为 null */
  completedAt: string | null;
  /**
   * 排期时间（见 `getScheduleState`）：
   * - null：未排期
   * - YYYY / YYYY-MM：待确定（不同步日历）
   * - YYYY-MM-DD / YYYY-MM-DDTHH:mm:ss：已排期（同步日历）
   */
  dueAt: string | null;
  /** CalDAV VEVENT UID */
  calendarUid: string | null;
  /** CalDAV object URL for update/delete */
  calendarObjectUrl: string | null;
  /** iCal SEQUENCE last written to calendar */
  calendarSequence: number;
  /** Last sync error message, if any */
  calendarSyncError: string | null;
  /** 是否仍有待处理的 iCloud 同步任务 */
  calendarSyncPending: boolean;
  createdAt: string;
  updatedAt: string;
};

export type TodoStore = {
  /** 持久化 schema 版本，见 store-migrate.ts */
  schemaVersion: number;
  /** 标签库（独立管理） */
  tags: string[];
  /** 已按 compareTodoOrder 排好序，查询时不重排 */
  todos: Todo[];
};

export type CreateTodoInput = {
  title: string;
  tags?: string[];
  dueAt?: string | null;
};

export type UpdateTodoInput = {
  title?: string;
  tags?: string[];
  completed?: boolean;
  dueAt?: string | null;
};
