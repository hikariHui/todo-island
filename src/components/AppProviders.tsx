"use client";

import type { ReactNode } from "react";
import { SerwistProvider } from "@serwist/turbopack/react";
import { SessionKeepAlive } from "@/components/SessionKeepAlive";
import { ToastHost } from "@/components/Toast";

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <SerwistProvider swUrl="/serwist/sw.js">
      <SessionKeepAlive />
      {children}
      <ToastHost />
    </SerwistProvider>
  );
}
