"use client";

import { useEffect, useState } from "react";

import { buttonClass } from "@/components/shared/button";

export function ThemeToggle() {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"));
  }, []);

  function toggle() {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem("antra-theme", next ? "dark" : "light");
    } catch {
      // localStorage unavailable (private mode) — theme just won't persist
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      // The secondary button's shape, so it sits level with the links beside it
      // in the nav; uppercase only because a toggle reads better as a state.
      className={`${buttonClass()} uppercase tracking-wide`}
      title="Toggle light and dark theme"
    >
      {dark ? "Light" : "Dark"}
    </button>
  );
}
