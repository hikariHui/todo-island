import { NextResponse } from "next/server";
import {
  createSessionCookie,
  isAuthenticated,
  validatePassword,
} from "@/lib/auth";
import { clientIp, rateLimit } from "@/lib/rate-limit";

const LOGIN_LIMIT = 10;
const LOGIN_WINDOW_MS = 15 * 60 * 1000; // 15 minutes

export async function POST(request: Request) {
  const ip = clientIp(request);
  const limited = rateLimit(`login:${ip}`, LOGIN_LIMIT, LOGIN_WINDOW_MS);
  if (!limited.ok) {
    return NextResponse.json(
      { error: "尝试过于频繁，请稍后再试" },
      {
        status: 429,
        headers: { "Retry-After": String(limited.retryAfterSec) },
      },
    );
  }

  try {
    const body = (await request.json()) as { password?: string };
    const password = typeof body.password === "string" ? body.password : "";
    if (!validatePassword(password)) {
      return NextResponse.json({ error: "密码错误" }, { status: 401 });
    }
    await createSessionCookie();
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[auth/login]", error);
    return NextResponse.json({ error: "登录失败" }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ authenticated: await isAuthenticated() });
}
