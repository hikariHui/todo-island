"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Background,
  Button,
  Card,
  Input,
  Modal,
  Tag,
  Title,
} from "animal-island-ui";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "@/components/Toast";
import { tagColor } from "@/components/MultiSelectTags";

export function TagsManager() {
  const router = useRouter();
  const [tags, setTags] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [savingRename, setSavingRename] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/tags");
        if (cancelled) return;
        if (res.status === 401) {
          router.replace("/login");
          return;
        }
        const data = (await res.json()) as { tags: string[] };
        if (cancelled) return;
        setTags(data.tags);
      } catch {
        if (!cancelled) toast.error({ message: "加载标签失败" });
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  const sorted = useMemo(
    () => [...tags].sort((a, b) => a.localeCompare(b, "zh-CN")),
    [tags],
  );

  async function createTag() {
    const trimmed = name.trim();
    if (!trimmed) {
      toast.warning({ message: "先输入标签名" });
      return;
    }
    setCreating(true);
    try {
      const res = await fetch("/api/tags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      });
      if (res.status === 401) {
        router.replace("/login");
        return;
      }
      const data = (await res.json()) as { tag?: string; error?: string };
      if (!res.ok || !data.tag) {
        toast.error({ message: data.error || "创建失败" });
        return;
      }
      setTags((prev) =>
        prev.some((t) => t.toLowerCase() === data.tag!.toLowerCase())
          ? prev
          : [...prev, data.tag!],
      );
      setName("");
      toast.success({ message: `已添加「${data.tag}」` });
    } catch {
      toast.error({ message: "网络错误" });
    } finally {
      setCreating(false);
    }
  }

  async function saveRename() {
    if (!renaming) return;
    const trimmed = renameValue.trim();
    if (!trimmed) {
      toast.warning({ message: "标签名不能为空" });
      return;
    }
    setSavingRename(true);
    try {
      const res = await fetch("/api/tags", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ from: renaming, to: trimmed }),
      });
      if (res.status === 401) {
        router.replace("/login");
        return;
      }
      const data = (await res.json()) as {
        from?: string;
        to?: string;
        error?: string;
      };
      if (!res.ok || !data.to) {
        toast.error({ message: data.error || "重命名失败" });
        return;
      }
      setTags((prev) =>
        prev.map((tag) =>
          tag.toLowerCase() === (data.from ?? renaming).toLowerCase()
            ? data.to!
            : tag,
        ),
      );
      setRenaming(null);
      toast.success({ message: `已重命名为「${data.to}」` });
    } catch {
      toast.error({ message: "网络错误" });
    } finally {
      setSavingRename(false);
    }
  }

  async function removeTag(tag: string) {
    if (deleting) return;
    setDeleting(tag);
    try {
      const res = await fetch("/api/tags", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: tag }),
      });
      if (res.status === 401) {
        router.replace("/login");
        return;
      }
      const data = (await res.json()) as { tag?: string; error?: string };
      if (!res.ok) {
        toast.error({ message: data.error || "删除失败" });
        return;
      }
      setTags((prev) =>
        prev.filter((item) => item.toLowerCase() !== tag.toLowerCase()),
      );
      toast.success({ message: `已删除「${tag}」` });
    } catch {
      toast.error({ message: "网络错误" });
    } finally {
      setDeleting(null);
    }
  }

  return (
    <Background type="dots-teal" className="min-h-dvh">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 py-6 sm:gap-6 sm:px-6 sm:py-10">
        <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Title color="app-teal" size="large" variant="ribbon">
            标签管理
          </Title>
          <Link href="/">
            <Button type="default">返回待办</Button>
          </Link>
        </header>

        <Card color="app-teal" pattern="app-teal" className="p-4 sm:p-6">
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="min-w-0 flex-1">
              <Input
                size="large"
                placeholder="新标签名称"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    void createTag();
                  }
                }}
              />
            </div>
            <Button
              type="primary"
              size="large"
              loading={creating}
              onClick={() => void createTag()}
            >
              添加标签
            </Button>
          </div>
          <p className="mt-3 text-xs text-[#5c4a3a] sm:text-sm">
            在这里维护标签库；待办页通过下拉多选引用这些标签。删除会同步从所有待办中移除。
          </p>
        </Card>

        {loading ? (
          <Card className="p-8 text-center text-[#7a6552]">加载中…</Card>
        ) : sorted.length === 0 ? (
          <Card
            color="app-blue"
            pattern="app-blue"
            className="p-8 text-center text-[#5c4a3a]"
          >
            还没有标签，先添加一个吧
          </Card>
        ) : (
          <ul className="flex flex-col gap-3">
            {sorted.map((tag) => (
              <li key={tag}>
                <Card hoverable color="default" className="p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <Tag size="medium" color={tagColor(tag)} variant="soft">
                      {tag}
                    </Tag>
                    <div className="flex gap-2 self-end sm:self-auto">
                      <Button
                        type="default"
                        size="small"
                        onClick={() => {
                          setRenaming(tag);
                          setRenameValue(tag);
                        }}
                      >
                        重命名
                      </Button>
                      <Button
                        type="primary"
                        danger
                        size="small"
                        loading={deleting === tag}
                        disabled={Boolean(deleting)}
                        onClick={() => void removeTag(tag)}
                      >
                        删除
                      </Button>
                    </div>
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        )}

        <Modal
          open={Boolean(renaming)}
          title="重命名标签"
          typewriter={false}
          onClose={() => setRenaming(null)}
          onOk={() => void saveRename()}
          footer={
            <div className="flex justify-end gap-2">
              <Button type="default" onClick={() => setRenaming(null)}>
                取消
              </Button>
              <Button
                type="primary"
                loading={savingRename}
                onClick={() => void saveRename()}
              >
                保存
              </Button>
            </div>
          }
          width="min(92vw, 420px)"
        >
          <div className="py-2">
            <Input
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              placeholder="新名称"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void saveRename();
                }
              }}
            />
          </div>
        </Modal>
      </div>
    </Background>
  );
}
