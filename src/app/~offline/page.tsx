"use client";

import { Background, Card, Title } from "animal-island-ui";

export default function OfflinePage() {
  return (
    <Background
      type="dots-orange"
      className="flex min-h-dvh items-center justify-center px-4 py-10"
    >
      <Card color="app-orange" pattern="app-orange" className="w-full max-w-md p-6 text-center">
        <Title color="app-orange" size="large" variant="ribbon">
          离线中
        </Title>
        <p className="mt-4 text-sm text-[#5c4a3a] sm:text-base">
          当前没有网络连接。连上后再打开 Todo Island 即可继续使用。
        </p>
      </Card>
    </Background>
  );
}
