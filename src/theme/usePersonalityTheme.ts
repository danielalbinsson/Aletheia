import { useEffect } from "react";
import type { PersonalityTheme } from "./personalityTheme";

/** Push an agent's personality theme onto :root CSS custom properties. */
export function usePersonalityTheme(theme: PersonalityTheme) {
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty("--accent", theme.accent);
    root.style.setProperty("--accent-dim", theme.accentDim);
    root.style.setProperty("--accent-glow", theme.accentGlow);
  }, [theme.accent, theme.accentDim, theme.accentGlow]);
}
