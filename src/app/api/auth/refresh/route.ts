import { NextResponse } from "next/server";
import { createSessionCookie, requireAuth } from "@/lib/auth";
import { SESSION_TTL_MS } from "@/lib/session-config";

/** Sliding session: authenticated clients can extend cookie lifetime. */
export async function POST() {
  const denied = await requireAuth();
  if (denied) return denied;

  const { expiresAt } = await createSessionCookie();
  return NextResponse.json({
    ok: true,
    expiresAt,
    ttlMs: SESSION_TTL_MS,
  });
}
