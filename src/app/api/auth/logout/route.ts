import { NextResponse } from "next/server";
import { clearSessionCookie, requireAuth } from "@/lib/auth";

export async function POST() {
  const denied = await requireAuth();
  if (denied) return denied;

  await clearSessionCookie();
  return NextResponse.json({ ok: true });
}
