"use client";

import { Background } from "animal-island-ui";
import { LoginForm } from "@/components/LoginForm";

export default function LoginPage() {
  return (
    <Background
      type="sprinkles"
      className="flex min-h-dvh items-center justify-center px-4 py-10"
    >
      <LoginForm />
    </Background>
  );
}
