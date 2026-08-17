import type { Capability } from "../model";

/** Fields needed to split an inventory row. Snapshot rows omit `origin`. */
export interface InventoryCap {
  label: string;
  source?: string;
  origin?: Capability["origin"];
}

export interface InventoryReach {
  label: string;
  detail?: string;
}

/** eve harness tools that write or run a shell — grouped apart from delegation. */
const WRITE_SHELL_SLUGS = new Set(["bash", "write_file", "edit_file"]);

function toolSlug(item: InventoryCap): string {
  const file = (item.source ?? "").replace(/\\/g, "/").split("/").pop() ?? "";
  return file.replace(/\.ts$/i, "").replace(/-/g, "_").toLowerCase();
}

export function isDelegateCap(item: InventoryCap): boolean {
  if (item.origin === "subagent") return true;
  return /^delegates to\s+/i.test(item.label);
}

export function isWriteOrShellCap(item: InventoryCap): boolean {
  if (WRITE_SHELL_SLUGS.has(toolSlug(item))) return true;
  const fromLabel = item.label.trim().toLowerCase().replace(/\s+/g, "_");
  return WRITE_SHELL_SLUGS.has(fromLabel);
}

export function delegateDisplayName(label: string): string {
  return label.replace(/^delegates to\s+/i, "").trim() || label;
}

export function groupCapabilities<T extends InventoryCap>(items: T[]): {
  delegates: T[];
  writeShell: T[];
  other: T[];
} {
  const delegates: T[] = [];
  const writeShell: T[] = [];
  const other: T[] = [];
  for (const item of items) {
    if (isDelegateCap(item)) delegates.push(item);
    else if (isWriteOrShellCap(item)) writeShell.push(item);
    else other.push(item);
  }
  return { delegates, writeShell, other };
}

export function executeAndReachHeading(writeShellCount: number, reachCount: number): string {
  if (writeShellCount > 0 && reachCount > 0) return "Write, shell, and reach";
  if (writeShellCount > 0) return "Write and shell";
  return "Reach";
}
