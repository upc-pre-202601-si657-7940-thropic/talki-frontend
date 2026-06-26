"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  return (
    <button
      type="button"
      aria-label="Cambiar tema"
      onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
      className="grid size-8 place-items-center rounded-md transition-colors hover:bg-secondary text-muted-foreground hover:text-foreground"
    >
      <Sun className="size-4 hidden dark:block" />
      <Moon className="size-4 dark:hidden" />
    </button>
  );
}
