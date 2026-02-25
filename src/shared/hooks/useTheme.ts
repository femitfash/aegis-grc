"use client";

import { useState, useEffect } from "react";

export type Theme = "light" | "dark" | "system";

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const shouldBeDark = theme === "dark" || (theme === "system" && prefersDark);
  root.classList.toggle("dark", shouldBeDark);
}

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>("dark");

  // Read from localStorage on mount
  useEffect(() => {
    const stored = (localStorage.getItem("fastgrc-theme") as Theme) || "dark";
    setThemeState(stored);
    applyTheme(stored);
  }, []);

  // Listen for system preference changes when in "system" mode
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => {
      if (theme === "system") applyTheme("system");
    };
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [theme]);

  const setTheme = (t: Theme) => {
    setThemeState(t);
    localStorage.setItem("fastgrc-theme", t);
    applyTheme(t);
  };

  const isDark =
    theme === "dark" ||
    (theme === "system" &&
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches);

  return { theme, setTheme, isDark };
}
