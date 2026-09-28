"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { Card } from "animal-island-ui";

type ToastType = "success" | "info" | "warning" | "error";

type ToastItem = {
  key: string;
  type: ToastType;
  message: string;
};

type ToastInput = string | { message: string };

const DEFAULT_DURATION_MS = 3500;

const EMPTY_TOASTS: ToastItem[] = [];

let toasts: ToastItem[] = [];
let seq = 0;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot() {
  return toasts;
}

function getServerSnapshot(): ToastItem[] {
  return EMPTY_TOASTS;
}

function normalize(input: ToastInput): string {
  return typeof input === "string" ? input : input.message;
}

function dismiss(key: string) {
  const next = toasts.filter((item) => item.key !== key);
  if (next.length === toasts.length) return;
  toasts = next;
  emit();
}

function push(type: ToastType, input: ToastInput) {
  const message = normalize(input).trim();
  if (!message) return;

  seq += 1;
  const item: ToastItem = {
    key: `toast-${Date.now()}-${seq}`,
    type,
    message,
  };
  toasts = [...toasts, item];
  emit();

  window.setTimeout(() => {
    dismiss(item.key);
  }, DEFAULT_DURATION_MS);
}

export const toast = {
  success: (input: ToastInput) => push("success", input),
  info: (input: ToastInput) => push("info", input),
  warning: (input: ToastInput) => push("warning", input),
  error: (input: ToastInput) => push("error", input),
  dismiss,
};

const CARD_COLOR: Record<
  ToastType,
  "app-green" | "app-blue" | "app-orange" | "app-red"
> = {
  success: "app-green",
  info: "app-blue",
  warning: "app-orange",
  error: "app-red",
};

export function ToastHost() {
  const items = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted || items.length === 0) return null;

  return createPortal(
    <div
      className="pointer-events-none fixed inset-x-0 top-4 z-[4000] flex flex-col items-center gap-2 px-4"
      aria-live="polite"
    >
      {items.map((item) => (
        <button
          key={item.key}
          type="button"
          className="pointer-events-auto w-full max-w-md text-left"
          onClick={() => dismiss(item.key)}
        >
          <Card color={CARD_COLOR[item.type]} className="px-4 py-3 shadow-md">
            <div className="text-sm font-semibold text-[#3d2f24] sm:text-base">
              {item.message}
            </div>
          </Card>
        </button>
      ))}
    </div>,
    document.body,
  );
}
