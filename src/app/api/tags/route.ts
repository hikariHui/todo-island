import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import {
  createTag,
  deleteTag,
  listTags,
  renameTag,
} from "@/lib/store";

export async function GET() {
  const denied = await requireAuth();
  if (denied) return denied;

  const tags = await listTags();
  return NextResponse.json({ tags });
}

export async function POST(request: Request) {
  const denied = await requireAuth();
  if (denied) return denied;

  try {
    const body = (await request.json()) as { name?: string };
    const tag = await createTag(body.name ?? "");
    return NextResponse.json({ tag }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "创建失败";
    const status = message.includes("已存在") ? 409 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function PATCH(request: Request) {
  const denied = await requireAuth();
  if (denied) return denied;

  try {
    const body = (await request.json()) as { from?: string; to?: string };
    const result = await renameTag(body.from ?? "", body.to ?? "");
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "重命名失败";
    const status = message.includes("不存在")
      ? 404
      : message.includes("已存在")
        ? 409
        : 400;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function DELETE(request: Request) {
  const denied = await requireAuth();
  if (denied) return denied;

  try {
    const body = (await request.json()) as { name?: string };
    const tag = await deleteTag(body.name ?? "");
    return NextResponse.json({ tag });
  } catch (error) {
    const message = error instanceof Error ? error.message : "删除失败";
    const status = message.includes("不存在") ? 404 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
