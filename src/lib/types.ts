export type Todo = {
  id: string;
  title: string;
  /** 用户标签，用于列表筛选 */
  tags: string[];
  completed: boolean;
  /** 完成时间 ISO；未完成时为 null */
  completedAt: string | null;
  /**
   * 截止时间：
   * - null：待定（不同步日历）
   * - YYYY-MM-DD：全天（同步为 iCloud 全天事件）
   * - YYYY-MM-DDTHH:mm:ss：定点（同步为带时间的事件）
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
  /** 标签库（独立管理） */
  tags: string[];
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
