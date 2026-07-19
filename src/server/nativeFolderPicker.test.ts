import { describe, it, expect } from "vitest";
import { isCancelMessage } from "./nativeFolderPicker";

describe("isCancelMessage", () => {
  it("detects the macOS osascript cancel signal", () => {
    expect(isCancelMessage("execution error: User canceled. (-128)")).toBe(true);
  });

  it("detects generic cancel wording", () => {
    expect(isCancelMessage("Command failed: dialog cancelled")).toBe(true);
    expect(isCancelMessage("User canceled")).toBe(true);
  });

  it("does not treat a real failure as cancel", () => {
    expect(isCancelMessage("osascript: command not found")).toBe(false);
    expect(isCancelMessage("EACCES: permission denied")).toBe(false);
  });
});
