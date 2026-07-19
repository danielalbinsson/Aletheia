// nativeFolderPicker: open the OS's real "choose folder" dialog from the dev
// server and return the absolute path the user picked. A browser can't hand the
// server a filesystem path, but because Aletheia runs against a local Node dev
// server we can shell out to the native picker (osascript on macOS, zenity or
// kdialog on Linux). Local-tool only — there's no picker in a static build.

import { execFile } from "node:child_process";
import os from "node:os";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export interface PickResult {
  /** Absolute path chosen by the user. */
  path?: string;
  /** True when the user dismissed the dialog. */
  canceled?: boolean;
  /** Set when no picker is available (e.g. unsupported platform). */
  error?: string;
}

/** Native pickers exit non-zero on cancel; detect that so it isn't an error. */
export function isCancelMessage(message: string): boolean {
  return /user canceled|cancell?ed|\(-128\)/i.test(message);
}

async function pickMac(prompt: string): Promise<PickResult> {
  const script = `POSIX path of (choose folder with prompt "${prompt.replace(/["\\]/g, "\\$&")}")`;
  const { stdout } = await execFileAsync("osascript", ["-e", script]);
  const p = stdout.trim();
  return p ? { path: p } : { canceled: true };
}

async function pickLinux(prompt: string): Promise<PickResult> {
  try {
    const { stdout } = await execFileAsync("zenity", [
      "--file-selection",
      "--directory",
      "--title",
      prompt,
    ]);
    const p = stdout.trim();
    return p ? { path: p } : { canceled: true };
  } catch {
    const { stdout } = await execFileAsync("kdialog", [
      "--getexistingdirectory",
      os.homedir(),
    ]);
    const p = stdout.trim();
    return p ? { path: p } : { canceled: true };
  }
}

/** Open the native folder chooser. Resolves with the path, cancel, or an error. */
export async function pickFolder(
  prompt = "Select a folder to scan for eve agents"
): Promise<PickResult> {
  try {
    if (process.platform === "darwin") return await pickMac(prompt);
    if (process.platform === "linux") return await pickLinux(prompt);
    return {
      error: `Native folder picker isn't supported on ${process.platform}. Type a path instead.`,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (isCancelMessage(message)) return { canceled: true };
    return {
      error: "Couldn't open the folder picker. Type a path instead.",
    };
  }
}
