export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { assertAuthEnv } = await import("./lib/session-config");
    assertAuthEnv();

    const { startCleanupScheduler } = await import("./lib/cleanup");
    const { startIcloudQueueWorker } = await import("./lib/icloud-queue");
    startCleanupScheduler();
    startIcloudQueueWorker();
  }
}
