import { createHash, createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import {
  COOKIE_NAME,
  SESSION_TTL_MS,
  getSessionSecret,
} from "./session-config";

export { COOKIE_NAME, SESSION_TTL_MS };

function getAuthPassword(): string {
  const password = process.env.AUTH_PASSWORD;
  if (!password) {
    throw new Error("AUTH_PASSWORD 环境变量未设置");
  }
  return password;
}

function sessionCookieOptions(maxAge: number) {
  return {
    httpOnly: true as const,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge,
  };
}

function sign(payload: string): string {
  return createHmac("sha256", getSessionSecret())
    .update(payload)
    .digest("base64url");
}

function buildToken(expiresAt: number): string {
  const payload = `ok.${expiresAt}`;
  return `${payload}.${sign(payload)}`;
}

function verifyToken(token: string): boolean {
  const parts = token.split(".");
  if (parts.length !== 3) return false;
  const [flag, expiresRaw, signature] = parts;
  if (flag !== "ok") return false;
  const expiresAt = Number(expiresRaw);
  if (!Number.isFinite(expiresAt) || Date.now() > expiresAt) return false;

  const payload = `${flag}.${expiresRaw}`;
  const expected = sign(payload);
  try {
    const a = Buffer.from(signature);
    const b = Buffer.from(expected);
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

/** Constant-time compare via SHA-256 digests (avoids length early-return leak). */
export function validatePassword(password: string): boolean {
  const expected = getAuthPassword();
  const a = createHash("sha256").update(password, "utf8").digest();
  const b = createHash("sha256").update(expected, "utf8").digest();
  return timingSafeEqual(a, b);
}

export async function createSessionCookie(): Promise<{ expiresAt: number }> {
  const expiresAt = Date.now() + SESSION_TTL_MS;
  const token = buildToken(expiresAt);
  const jar = await cookies();
  jar.set(
    COOKIE_NAME,
    token,
    sessionCookieOptions(Math.floor(SESSION_TTL_MS / 1000)),
  );
  return { expiresAt };
}

export async function clearSessionCookie(): Promise<void> {
  const jar = await cookies();
  jar.set(COOKIE_NAME, "", sessionCookieOptions(0));
}

export async function isAuthenticated(): Promise<boolean> {
  const jar = await cookies();
  const token = jar.get(COOKIE_NAME)?.value;
  if (!token) return false;
  return verifyToken(token);
}

export async function requireAuth(): Promise<Response | null> {
  if (await isAuthenticated()) return null;
  return Response.json({ error: "未登录" }, { status: 401 });
}
