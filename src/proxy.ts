import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  COOKIE_NAME,
  SESSION_REFRESH_REMAINING_MS,
  SESSION_TTL_MS,
  getSessionSecret,
} from "@/lib/session-config";

async function hmacSign(payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(getSessionSecret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(payload),
  );
  const bytes = new Uint8Array(sig);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function timingSafeEqualStr(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i += 1) {
    out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return out === 0;
}

type SessionInfo = { expiresAt: number };

async function parseValidSession(
  token: string | undefined,
): Promise<SessionInfo | null> {
  if (!token) return null;
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const [flag, expiresRaw, signature] = parts;
    if (flag !== "ok") return null;
    const expiresAt = Number(expiresRaw);
    if (!Number.isFinite(expiresAt) || Date.now() > expiresAt) return null;
    const payload = `${flag}.${expiresRaw}`;
    const expected = await hmacSign(payload);
    if (!timingSafeEqualStr(signature, expected)) return null;
    return { expiresAt };
  } catch {
    // Missing/weak SESSION_SECRET in production → reject all sessions
    return null;
  }
}

async function attachRefreshedSession(
  response: NextResponse,
  session: SessionInfo,
): Promise<void> {
  const remaining = session.expiresAt - Date.now();
  if (remaining > SESSION_REFRESH_REMAINING_MS) return;

  const expiresAt = Date.now() + SESSION_TTL_MS;
  const payload = `ok.${expiresAt}`;
  const signature = await hmacSign(payload);
  response.cookies.set(COOKIE_NAME, `${payload}.${signature}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: Math.floor(SESSION_TTL_MS / 1000),
  });
}

const PUBLIC_PATHS = new Set([
  "/login",
  "/~offline",
  "/manifest.webmanifest",
  "/favicon.ico",
]);

function isPublicAsset(pathname: string): boolean {
  return (
    PUBLIC_PATHS.has(pathname) ||
    pathname.startsWith("/serwist/") ||
    pathname.startsWith("/icons/") ||
    pathname.startsWith("/_next/")
  );
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get(COOKIE_NAME)?.value;
  const session = await parseValidSession(token);
  const loggedIn = Boolean(session);

  if (pathname.startsWith("/api/auth/login")) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/api/") && !loggedIn) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  if (pathname === "/login") {
    if (loggedIn) {
      const redirect = NextResponse.redirect(new URL("/", request.url));
      if (session) await attachRefreshedSession(redirect, session);
      return redirect;
    }
    return NextResponse.next();
  }

  if (!loggedIn && !isPublicAsset(pathname)) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const response = NextResponse.next();
  if (session) await attachRefreshedSession(response, session);
  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icons/|serwist/).*)",
  ],
};
