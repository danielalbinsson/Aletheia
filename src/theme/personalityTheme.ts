// Motif → accent palette. Each personality motif gets a distinct highlight color.

export interface PersonalityTheme {
  /** Primary highlight — essence, active tab, channel dots. */
  accent: string;
  /** 16% tint for pills and portrait glow. */
  accentDim: string;
  /** 5% tint for the page ambient wash. */
  accentGlow: string;
}

const MOTIF_THEMES: Record<string, PersonalityTheme> = {
  correspondence: {
    accent: "#d9a368",
    accentDim: "rgba(217, 163, 104, 0.16)",
    accentGlow: "rgba(217, 163, 104, 0.05)",
  },
  ledger: {
    accent: "#7fa89a",
    accentDim: "rgba(127, 168, 154, 0.16)",
    accentGlow: "rgba(127, 168, 154, 0.05)",
  },
  hearth: {
    accent: "#c9877a",
    accentDim: "rgba(201, 135, 122, 0.16)",
    accentGlow: "rgba(201, 135, 122, 0.05)",
  },
  atlas: {
    accent: "#8a9ec4",
    accentDim: "rgba(138, 158, 196, 0.16)",
    accentGlow: "rgba(138, 158, 196, 0.05)",
  },
  form: {
    accent: "#a89f94",
    accentDim: "rgba(168, 159, 148, 0.16)",
    accentGlow: "rgba(168, 159, 148, 0.05)",
  },
};

export function themeForMotif(motif: string): PersonalityTheme {
  return MOTIF_THEMES[motif] ?? MOTIF_THEMES.form;
}
