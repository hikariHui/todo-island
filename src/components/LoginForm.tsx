"use client";

import { useState } from "react";
import { Button, Card, Input, Title } from "animal-island-ui";
import { useRouter } from "next/navigation";
import { toast } from "@/components/Toast";

export function LoginForm() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        toast.error({ message: data.error || "登录失败" });
        return;
      }
      toast.success({ message: "欢迎回来" });
      router.replace("/");
      router.refresh();
    } catch {
      toast.error({ message: "网络错误" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card color="app-teal" pattern="app-teal" className="w-full max-w-md p-6 sm:p-8">
      <div className="mb-6 flex flex-col items-center gap-3 text-center">
        <Title color="app-teal" size="large" variant="ribbon">
          Todo Island
        </Title>
        <p className="text-sm text-[#5c4a3a] sm:text-base">
          输入环境变量中配置的登录密码
        </p>
      </div>
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <Input
          type="password"
          size="large"
          placeholder="登录密码"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoFocus
        />
        <Button type="primary" htmlType="submit" block size="large" loading={loading}>
          进入小岛
        </Button>
      </form>
    </Card>
  );
}
