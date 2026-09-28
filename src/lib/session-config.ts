export const COOKIE_NAME = "todo_session";

/** Absolute session lifetime from last refresh / login. */
export const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30; // 30 days

/**
 * When remaining TTL falls below this, proxy silently issues a fresh cookie.
 * Combined with client refresh-on-focus, active use keeps the session alive.
 */
export const SESSION_REFRESH_REMAINING_MS = 1000 * 60 * 60 * 24 * 15; // 15 days

const WEAK_SECRETS = new Set([
  "dev-secret",
  "please-change-this-to-a-long-random-string",
  "change-me",
]);

const MIN_SECRET_LENGTH = 16;

function isWeakSecret(value: string): boolean {
  return value.length < MIN_SECRET_LENGTH || WEAK_SECRETS.has(value);
}

/**
 * Session HMAC secret.
 * Production: SESSION_SECRET is required (no fallback).
 * Development: SESSION_SECRET → AUTH_PASSWORD → "dev-secret".
 */
export function getSessionSecret(): string {
  const secret = process.env.SESSION_SECRET?.trim();
  if (secret) {
    if (process.env.NODE_ENV === "production" && isWeakSecret(secret)) {
      throw new Error(
        "SESSION_SECRET 过弱：生产环境请使用至少 16 字符的随机字符串",
      );
    }
    return secret;
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error("生产环境必须设置 SESSION_SECRET");
  }

  return process.env.AUTH_PASSWORD?.trim() || "dev-secret";
}

/** Fail-fast at Node startup in production. */
export function assertAuthEnv(): void {
  if (process.env.NODE_ENV !== "production") return;

  getSessionSecret();

  const password = process.env.AUTH_PASSWORD?.trim();
  if (!password || WEAK_SECRETS.has(password)) {
    throw new Error(
      "生产环境必须设置非默认的 AUTH_PASSWORD（勿使用 change-me / dev-secret）",
    );
  }
}
