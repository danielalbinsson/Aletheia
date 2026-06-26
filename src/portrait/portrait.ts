// Generates the agent's portrait: a lit relief bust rendered in monospace
// glyphs. The figure is shaded like a sculpture lit from the front and slightly
// above; on Aletheia's near-black page the light strokes "surface from the
// dark" — the literal meaning of the name. Fully deterministic from signals.

import type { PortraitSignals } from "../model";
import { deriveSignals } from "./signals";
import type { AgentModel } from "../model";

interface Motif {
  accent: string;
  mote: string;
}

const MOTIFS: Record<string, Motif> = {
  correspondence: { accent: "─", mote: "·" },
  ledger: { accent: "│", mote: "·" },
  hearth: { accent: "◦", mote: "˙" },
  atlas: { accent: "∴", mote: "·" },
  form: { accent: "·", mote: "·" },
};

// Luminance ramp, deep-shadow -> full-light. Space is the deepest shadow,
// so the figure literally emerges from the page.
const RAMP = [" ", " ", "·", ":", "▒", "▒", "▓", "▓", "█"];

function mulberry32(a: number): () => number {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const W = 46;
const H = 26;
const ASPECT = 2.05; // monospace cell height : width

/** Generate the portrait as an array of equal-length rows. */
export function renderPortrait(sig: PortraitSignals): string[] {
  const rnd = mulberry32(sig.seed);
  const m = MOTIFS[sig.motif] ?? MOTIFS.form;

  // Seeded surface grain, mirrored across the vertical axis so the face reads
  // as a face rather than as noise.
  const half = Math.ceil(W / 2);
  const grain: number[][] = [];
  for (let y = 0; y < H; y++) {
    grain[y] = [];
    for (let x = 0; x < half; x++) grain[y][x] = rnd();
  }
  const grainAt = (x: number, y: number): number =>
    grain[y][x < half ? x : W - 1 - x];

  const cx = (W - 1) / 2;
  const headCy = H * 0.36;
  const headRx = W * 0.165;
  const headRy = (headRx / ASPECT) * 1.15;
  const shCy = H * 0.92;
  const shRx = W * (0.3 + 0.16 * sig.autonomy); // autonomy grounds the shoulders
  const shRy = H * 0.42;

  // Straight-on light, slightly from above -> symmetric and serene.
  const L = [0, -0.35, 0.94];
  const Ln = Math.hypot(L[0], L[1], L[2]);
  L[0] /= Ln; L[1] /= Ln; L[2] /= Ln;

  const auraR = 1.0 + 1.6 * sig.reach; // reach -> how far its touch extends

  const rows: string[] = [];
  for (let y = 0; y < H; y++) {
    let row = "";
    for (let x = 0; x < W; x++) {
      const nx = (x - cx) / headRx;
      const ny = (y - headCy) / headRy;
      const r2 = nx * nx + ny * ny;
      let ch = " ";

      if (r2 <= 1) {
        // On the head ellipsoid — Lambert shading.
        const nz = Math.sqrt(1 - r2);
        let lum = Math.max(0, nx * L[0] + ny * L[1] + nz * L[2]);
        lum = 0.15 + 0.85 * lum; // ambient floor
        lum *= 0.7 + 0.3 * sig.reach; // presence
        lum += (sig.autonomy - 0.4) * 0.18; // weight
        lum += (grainAt(x, y) - 0.5) * (0.1 + 0.3 * sig.range); // surface detail
        lum = Math.max(0, Math.min(0.999, lum));
        ch = RAMP[Math.floor(lum * RAMP.length)];
        if (
          ch !== " " &&
          grainAt(x, y) > 0.93 - 0.15 * sig.range &&
          r2 > 0.15 &&
          r2 < 0.8
        )
          ch = m.accent;
      } else {
        const sx = (x - cx) / shRx;
        const sy = (y - shCy) / shRy;
        const s2 = sx * sx + sy * sy;
        if (y > headCy + headRy * 0.6 && s2 <= 1) {
          // Shoulders: a smooth curved lower mass.
          const depth = Math.sqrt(1 - s2);
          let lum = 0.12 + 0.6 * depth * (0.6 + 0.4 * sig.autonomy);
          lum += (grainAt(x, y) - 0.5) * (0.08 + 0.16 * sig.range);
          lum = Math.max(0, Math.min(0.999, lum));
          ch = RAMP[Math.floor(lum * RAMP.length)];
        } else {
          // Aura: sparse motes that fall off with distance, scaled by reach.
          const d = Math.hypot(nx, ny);
          if (d < auraR && grainAt(x, y) > 0.9 + 0.08 * (d - 1)) ch = m.mote;
        }
      }
      row += ch;
    }
    rows.push(row);
  }
  return rows;
}

/** Convenience: derive signals from a model and render in one call. */
export function portraitFor(agent: AgentModel): {
  rows: string[];
  signals: PortraitSignals;
} {
  const signals = deriveSignals(agent);
  return { rows: renderPortrait(signals), signals };
}
