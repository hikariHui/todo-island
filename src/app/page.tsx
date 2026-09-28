"use client";

import { Background } from "animal-island-ui";
import { TodoApp } from "@/components/TodoApp";

export default function HomePage() {
  return (
    <Background type="dots-yellow" className="min-h-dvh">
      <TodoApp />
    </Background>
  );
}
