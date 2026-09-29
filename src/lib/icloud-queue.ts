import { promises as fs } from "fs";
import path from "path";
import {
  icloudConfigured,
  removeTodoFromIcloud,
  syncTodoToIcloud,
} from "./icloud";
import { getTodo, updateTodoSyncMeta } from "./store";
import type { Todo } from "./types";

const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), "data");
const QUEUE_FILE = path.join(DATA_DIR, "icloud-queue.json");
const MAX_ATTEMPTS = 5;
const RETRY_BASE_MS = 1500;
/** Job stays leased this long; crash recovery reclaims after expiry. */
const LEASE_MS = 2 * 60 * 1000;
const MAX_DEAD_LETTERS = 50;

type UpsertJob = {
  id: string;
  kind: "upsert";
  todoId: string;
  enqueuedAt: string;
  attempts: number;
  availableAt: string;
  leasedAt?: string | null;
};

type DeleteJob = {
  id: string;
  kind: "delete";
  todoId: string;
  calendarUid: string | null;
  calendarObjectUrl: string | null;
  enqueuedAt: string;
  attempts: number;
  availableAt: string;
  leasedAt?: string | null;
};

type QueueJob = UpsertJob | DeleteJob;

type DeadLetter = QueueJob & {
  failedAt: string;
  lastError: string;
};

type QueueState = {
  jobs: QueueJob[];
  deadLetters?: DeadLetter[];
};

let writeChain: Promise<unknown> = Promise.resolve();
let pumping = false;
/** 泵运行期间又有入队时置位，避免退出后任务卡住 */
let pumpWakeRequested = false;

function withLock<T>(fn: () => Promise<T>): Promise<T> {
  const run = writeChain.then(fn, fn);
  writeChain = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

async function ensureQueueFile(): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    await fs.access(QUEUE_FILE);
  } catch {
    const initial: QueueState = { jobs: [], deadLetters: [] };
    await fs.writeFile(QUEUE_FILE, JSON.stringify(initial, null, 2), "utf8");
  }
}

async function readQueue(): Promise<QueueState> {
  await ensureQueueFile();
  const raw = await fs.readFile(QUEUE_FILE, "utf8");
  const parsed = JSON.parse(raw) as QueueState;
  if (!parsed.jobs || !Array.isArray(parsed.jobs)) {
    return { jobs: [], deadLetters: [] };
  }
  return {
    jobs: parsed.jobs,
    deadLetters: Array.isArray(parsed.deadLetters) ? parsed.deadLetters : [],
  };
}

async function writeQueue(state: QueueState): Promise<void> {
  await ensureQueueFile();
  const tmp = `${QUEUE_FILE}.${process.pid}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(state, null, 2), "utf8");
  await fs.rename(tmp, QUEUE_FILE);
}

function nowIso() {
  return new Date().toISOString();
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isLeaseExpired(job: QueueJob, now: number): boolean {
  if (!job.leasedAt) return true;
  const leased = Date.parse(job.leasedAt);
  if (Number.isNaN(leased)) return true;
  return now - leased >= LEASE_MS;
}

function pushDeadLetter(
  state: QueueState,
  job: QueueJob,
  lastError: string,
): void {
  const letters = state.deadLetters ?? [];
  letters.push({
    ...job,
    leasedAt: null,
    failedAt: nowIso(),
    lastError,
  });
  state.deadLetters = letters.slice(-MAX_DEAD_LETTERS);
}

/**
 * Enqueue upsert. Coalesces pending upserts for the same todo.
 * A later delete for the same id cancels pending upserts.
 */
export async function enqueueIcloudUpsert(todoId: string): Promise<void> {
  if (!icloudConfigured()) return;

  await updateTodoSyncMeta(todoId, {
    calendarSyncPending: true,
    calendarSyncError: null,
  }).catch(() => undefined);

  await withLock(async () => {
    const state = await readQueue();
    state.jobs = state.jobs.filter(
      (job) => !(job.kind === "upsert" && job.todoId === todoId),
    );
    const hasDelete = state.jobs.some(
      (job) => job.kind === "delete" && job.todoId === todoId,
    );
    if (!hasDelete) {
      state.jobs.push({
        id: crypto.randomUUID(),
        kind: "upsert",
        todoId,
        enqueuedAt: nowIso(),
        attempts: 0,
        availableAt: nowIso(),
        leasedAt: null,
      });
    }
    await writeQueue(state);
  });

  wakeIcloudQueue();
}

/**
 * Enqueue delete with calendar snapshot. Cancels pending upserts for the same todo.
 */
export async function enqueueIcloudDelete(
  snapshot: Pick<Todo, "id" | "calendarUid" | "calendarObjectUrl">,
): Promise<void> {
  if (!icloudConfigured()) return;
  if (!snapshot.calendarUid && !snapshot.calendarObjectUrl) return;

  await withLock(async () => {
    const state = await readQueue();
    state.jobs = state.jobs.filter((job) => job.todoId !== snapshot.id);
    state.jobs.push({
      id: crypto.randomUUID(),
      kind: "delete",
      todoId: snapshot.id,
      calendarUid: snapshot.calendarUid,
      calendarObjectUrl: snapshot.calendarObjectUrl,
      enqueuedAt: nowIso(),
      attempts: 0,
      availableAt: nowIso(),
      leasedAt: null,
    });
    await writeQueue(state);
  });

  wakeIcloudQueue();
}

function wakeIcloudQueue(): void {
  if (pumping) {
    pumpWakeRequested = true;
    return;
  }
  void pumpIcloudQueue();
}

/** Claim next ready job (lease); expired leases are reclaimable. */
async function claimNextJob(): Promise<QueueJob | null> {
  return withLock(async () => {
    const state = await readQueue();
    const now = Date.now();

    for (const job of state.jobs) {
      if (job.leasedAt && isLeaseExpired(job, now)) {
        job.leasedAt = null;
      }
    }

    const index = state.jobs.findIndex(
      (job) =>
        Date.parse(job.availableAt) <= now &&
        (!job.leasedAt || isLeaseExpired(job, now)),
    );
    if (index < 0) {
      await writeQueue(state);
      return null;
    }

    const job = state.jobs[index];
    job.leasedAt = nowIso();
    await writeQueue(state);
    return { ...job };
  });
}

async function completeJob(jobId: string): Promise<void> {
  await withLock(async () => {
    const state = await readQueue();
    state.jobs = state.jobs.filter((job) => job.id !== jobId);
    await writeQueue(state);
  });
}

async function failJob(job: QueueJob, message: string): Promise<void> {
  await withLock(async () => {
    const state = await readQueue();
    const index = state.jobs.findIndex((item) => item.id === job.id);
    if (index < 0) return;

    const current = state.jobs[index];
    const nextAttempts = current.attempts + 1;

    if (nextAttempts >= MAX_ATTEMPTS) {
      state.jobs.splice(index, 1);
      pushDeadLetter(state, { ...current, attempts: nextAttempts }, message);
      console.error(
        "[icloud-queue] dead-letter",
        current.kind,
        current.todoId,
        message,
      );
      await writeQueue(state);
      return;
    }

    const delay = RETRY_BASE_MS * 2 ** current.attempts;
    state.jobs[index] = {
      ...current,
      leasedAt: null,
      attempts: nextAttempts,
      availableAt: new Date(Date.now() + delay).toISOString(),
    };
    await writeQueue(state);
  });
}

async function processJob(job: QueueJob): Promise<void> {
  if (job.kind === "delete") {
    const result = await removeTodoFromIcloud({
      calendarUid: job.calendarUid,
      calendarObjectUrl: job.calendarObjectUrl,
    });
    if (result.calendarSyncError) {
      throw new Error(result.calendarSyncError);
    }
    return;
  }

  const todo = await getTodo(job.todoId);
  if (!todo) {
    // Deleted before sync — nothing to upsert
    return;
  }

  const sync = await syncTodoToIcloud(todo);
  const updated = await updateTodoSyncMeta(job.todoId, {
    calendarSyncPending: false,
    calendarSyncError: sync.calendarSyncError,
    calendarUid: sync.calendarUid,
    calendarObjectUrl: sync.calendarObjectUrl,
    calendarSequence: sync.calendarSequence,
  });
  if (!updated) {
    // Deleted while syncing — do not resurrect
    return;
  }

  if (sync.calendarSyncError) {
    throw new Error(sync.calendarSyncError);
  }
}

export async function pumpIcloudQueue(): Promise<void> {
  if (pumping) {
    pumpWakeRequested = true;
    return;
  }
  pumping = true;
  try {
    do {
      pumpWakeRequested = false;
      for (;;) {
        const job = await claimNextJob();
        if (!job) {
          const state = await readQueue();
          const now = Date.now();
          const waiting = state.jobs.filter(
            (item) => !item.leasedAt || isLeaseExpired(item, now),
          );
          if (waiting.length === 0 && state.jobs.length === 0) break;
          if (waiting.length === 0) {
            // All jobs leased by a stuck worker — wait for lease expiry
            await sleep(Math.min(LEASE_MS, 5000));
            continue;
          }
          const nextAt = Math.min(
            ...waiting.map((item) => Date.parse(item.availableAt)),
          );
          const wait = Math.max(50, nextAt - Date.now());
          await sleep(Math.min(wait, 5000));
          continue;
        }

        try {
          await processJob(job);
          await completeJob(job.id);
        } catch (error) {
          const message =
            error instanceof Error ? error.message : "iCloud 同步失败";
          console.error("[icloud-queue]", job.kind, job.todoId, message);

          if (job.kind === "upsert") {
            await updateTodoSyncMeta(job.todoId, {
              calendarSyncPending: false,
              calendarSyncError: message,
            }).catch(() => undefined);
          }

          await failJob(job, message);
        }
      }
    } while (pumpWakeRequested);
  } finally {
    pumping = false;
  }

  // 退出瞬间又有入队：再拉起一轮，避免任务永久挂起
  if (pumpWakeRequested) {
    pumpWakeRequested = false;
    void pumpIcloudQueue();
    return;
  }
  const leftover = await readQueue();
  if (leftover.jobs.length > 0) {
    void pumpIcloudQueue();
  }
}

/** Resume unfinished / leased jobs after process start */
export function startIcloudQueueWorker(): void {
  void withLock(async () => {
    const state = await readQueue();
    let changed = false;
    for (const job of state.jobs) {
      if (job.leasedAt) {
        job.leasedAt = null;
        changed = true;
      }
    }
    if (changed) await writeQueue(state);
  }).then(() => pumpIcloudQueue());
}

/**
 * 丢弃指定待办的队列任务（不入队 delete，避免误删 iCloud）。
 * 用于本地定时清理等「只删本地」场景。
 */
export async function dropIcloudJobsForTodos(
  todoIds: string[],
): Promise<number> {
  if (todoIds.length === 0) return 0;
  const idSet = new Set(todoIds);
  return withLock(async () => {
    const state = await readQueue();
    const before = state.jobs.length;
    state.jobs = state.jobs.filter((job) => !idSet.has(job.todoId));
    const dropped = before - state.jobs.length;
    if (dropped > 0) await writeQueue(state);
    return dropped;
  });
}
