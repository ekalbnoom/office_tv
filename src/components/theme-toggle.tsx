"use client";

import { Moon, Sun } from "lucide-react";
import { useSyncExternalStore } from "react";

type Theme = "dark" | "light";

const STORAGE_KEY = "office-tv-theme";

export function ThemeToggle() {
  const theme = useSyncExternalStore(
    subscribeToTheme,
    getCurrentTheme,
    getServerTheme,
  );
  const nextTheme = theme === "dark" ? "light" : "dark";

  function setTheme(value: Theme) {
    document.documentElement.dataset.theme = value;
    window.localStorage.setItem(STORAGE_KEY, value);
    window.dispatchEvent(new Event("office-tv-theme-change"));
  }

  return (
    <button
      aria-label={`Switch to ${nextTheme} mode`}
      className="grid h-10 w-10 place-items-center rounded-full border border-line text-foreground transition hover:border-signal hover:text-signal focus:outline-none focus:ring-2 focus:ring-signal"
      onClick={() => setTheme(nextTheme)}
      title={`Switch to ${nextTheme} mode`}
      type="button"
    >
      {theme === "dark" ? (
        <Sun className="h-4 w-4" aria-hidden />
      ) : (
        <Moon className="h-4 w-4" aria-hidden />
      )}
    </button>
  );
}

function subscribeToTheme(callback: () => void) {
  window.addEventListener("office-tv-theme-change", callback);
  window.addEventListener("storage", callback);

  return () => {
    window.removeEventListener("office-tv-theme-change", callback);
    window.removeEventListener("storage", callback);
  };
}

function getCurrentTheme(): Theme {
  const current = document.documentElement.dataset.theme;

  return current === "light" ? "light" : "dark";
}

function getServerTheme(): Theme {
  return "dark";
}
