import { dropIcloudJobsForTodos } from "./icloud-queue";
import { purgeCompletedBefore } from "./store";

const DAY_MS = 24 * 60 * 60 * 1000;

function readPositiveNumber(raw: string | undefined, fallback: number): number {
  if (!raw) return fallback;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

/** 保留天数，默认 30（超过即清理） */
export function cleanupRetentionDays(): number {
  return readPositiveNumber(process.env.CLEANUP_COMPLETED_DAYS, 30);
}

/** 定时间隔（小时），默认 24 */
export function cleanupIntervalMs(): number {
  const hours = readPositiveNumber(process.env.CLEANUP_INTERVAL_HOURS, 24);
  return hours * 60 * 60 * 1000;
}

export type CleanupResult = {
  removed: number;
  droppedJobs: number;
  cutoffIso: string;
  retentionDays: number;
};

/**
 * 清理超过保留期的已完成事项：只删本地 JSON，不入队 iCloud delete。
 */
export async function runCompletedCleanup(): Promise<CleanupResult> {
  const retentionDays = cleanupRetentionDays();
  const cutoff = new Date(Date.now() - retentionDays * DAY_MS);
  const cutoffIso = cutoff.toISOString();
  const removedTodos = await purgeCompletedBefore(cutoffIso);
  const droppedJobs = await dropIcloudJobsForTodos(
    removedTodos.map((todo) => todo.id),
  );

  if (removedTodos.length > 0) {
    console.info(
      `[cleanup] purged ${removedTodos.length} completed todo(s) older than ${retentionDays}d (cutoff ${cutoffIso}); dropped ${droppedJobs} queue job(s); iCloud untouched`,
    );
  }

  return {
    removed: removedTodos.length,
    droppedJobs,
    cutoffIso,
    retentionDays,
  };
}

let started = false;
let timer: ReturnType<typeof setInterval> | null = null;

/** 进程内启动定时清理（启动时先跑一轮） */
export function startCleanupScheduler(): void {
  if (started) return;
  started = true;

  void runCompletedCleanup().catch((error) => {
    console.error("[cleanup] initial run failed", error);
  });

  const intervalMs = cleanupIntervalMs();
  timer = setInterval(() => {
    void runCompletedCleanup().catch((error) => {
      console.error("[cleanup] scheduled run failed", error);
    });
  }, intervalMs);

  // 不阻止进程退出
  if (typeof timer === "object" && timer && "unref" in timer) {
    timer.unref();
  }

  console.info(
    `[cleanup] scheduler started: every ${intervalMs / (60 * 60 * 1000)}h, retention ${cleanupRetentionDays()}d`,
  );
}
