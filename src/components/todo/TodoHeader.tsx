"use client";

import { useEffect, useRef, useState } from "react";
import { Button, Title } from "animal-island-ui";
import Link from "next/link";

type TodoHeaderProps = {
  onLogout: () => void | Promise<void>;
};

export function TodoHeader({ onLogout }: TodoHeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    function onPointerDown(event: PointerEvent) {
      const root = menuRef.current;
      if (!root || root.contains(event.target as Node)) return;
      setMenuOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setMenuOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [menuOpen]);

  return (
    <header className="flex items-center justify-between gap-3">
      <div className="min-w-0">
        <Title color="app-orange" size="large" variant="ribbon">
          Todo Island
        </Title>
      </div>

      <div className="hidden gap-2 sm:flex">
        <Link href="/tags">
          <Button type="default">标签管理</Button>
        </Link>
        <Button type="default" onClick={() => void onLogout()}>
          退出
        </Button>
      </div>

      <div className="relative sm:hidden" ref={menuRef}>
        <Button
          type="default"
          size="small"
          aria-expanded={menuOpen}
          aria-haspopup="menu"
          onClick={() => setMenuOpen((open) => !open)}
        >
          菜单
        </Button>
        {menuOpen ? (
          <div
            role="menu"
            className="absolute right-0 z-20 mt-2 min-w-[9.5rem] overflow-hidden rounded-[18px] border-[1.5px] border-[#e8dcc8] bg-[#fffdf7] py-1 shadow-[0_8px_20px_rgba(61,52,40,0.14)]"
          >
            <Link
              href="/tags"
              role="menuitem"
              className="block px-4 py-2.5 text-sm font-medium text-[#725d42] hover:bg-[#ffd54f]"
              onClick={() => setMenuOpen(false)}
            >
              标签管理
            </Link>
            <button
              type="button"
              role="menuitem"
              className="block w-full px-4 py-2.5 text-left text-sm font-medium text-[#725d42] hover:bg-[#ffd54f]"
              onClick={() => {
                setMenuOpen(false);
                void onLogout();
              }}
            >
              退出
            </button>
          </div>
        ) : null}
      </div>
    </header>
  );
}
