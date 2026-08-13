import { describe, it, expect } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Aletheia's honesty contract says it never presents a guess as a fact. That
// obligation applies to Aletheia's own documentation, not just to the portraits
// it renders. `aletheia diff` invokes `eve build` by default (see
// src/cli/aletheia.ts and cliCore.ts `build: true`), so any doc claiming it
// never builds is exactly the kind of unverified claim the tool exists to catch.
//
// This test locks that in. It failed against four files before 28 Jul 2026:
// AGENTS.md, skills/aletheia-eve-trust/SKILL.md, README.md, and
// public/docs/quickstart.md — the last of which is mirrored into llms-full.txt,
// so the claim was being served to other agents as fact.

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const DOC_GLOBS = [
  "AGENTS.md",
  "README.md",
  "MANIFESTO.md",
  "GALLERY.md",
  "skills/aletheia-eve-trust/SKILL.md",
  "public/docs/quickstart.md",
  "public/docs/glossary.md",
  "public/AGENTS.md",
  "public/llms.txt",
  "public/llms-full.txt",
  "public/manifesto.md",
  "public/privacy.md",
];

async function readIfPresent(rel: string): Promise<string | null> {
  try {
    return await fs.readFile(path.join(repoRoot, rel), "utf8");
  } catch {
    return null;
  }
}

describe("honesty contract — Aletheia's docs must not overclaim", () => {
  it("the CLI really does build by default, so the docs have something to be honest about", async () => {
    const cliCore = await readIfPresent("src/cli/cliCore.ts");
    expect(cliCore, "src/cli/cliCore.ts should exist").not.toBeNull();
    // If this ever flips to `build: false`, the doc rules below can relax.
    expect(cliCore).toMatch(/build:\s*true/);

    const cli = await readIfPresent("src/cli/aletheia.ts");
    expect(cli).toMatch(/runEveBuild\(/);
  });

  it.each(DOC_GLOBS)("%s does not claim Aletheia never builds", async (rel) => {
    const text = await readIfPresent(rel);
    if (text === null) return; // file is optional; absence is not a failure

    // Structural match, not prose sniffing: "build" appearing as a verb inside
    // a comma-separated never-list, e.g.
    //   "never runs, edits, builds, or deploys"
    //   "does not run, edit, build, or deploy"
    //   "never builds, runs, or edits"
    //
    // Does NOT match, correctly: "verified from build", "build-verified",
    // "`pnpm build`", "Fact taken from eve's compiled manifest after eve build",
    // or a never-list with no build in it at all.
    // The trailing (?!-) matters: "never build-verified" is a correct statement
    // about provenance labels, not a claim that Aletheia never builds.
    const NEVER_LIST_WITH_BUILD =
      /\b(never|does not|doesn't|do not)\s+(?:\w+,\s*(?:or\s+)?)*builds?\b(?!-)/i;

    // Compare per paragraph, not per line. These docs are hard-wrapped at ~80
    // columns, so a single claim — and the scope qualifier that makes it honest
    // — routinely straddle a line break.
    const withoutFences = text.replace(/```[\s\S]*?```/g, "");
    const paragraphs = withoutFences
      .split(/\n\s*\n/)
      .map((p) =>
        p
          .split("\n")
          .filter((l) => !l.trim().startsWith("|")) // table rows are not claims
          .join(" ")
          // Strip markdown emphasis. Without this, the real claim in AGENTS.md
          // — "It does **not** run, edit, build, or deploy agents." — slips
          // past a plain /does not/ match and the test passes vacuously.
          .replace(/[*_`]/g, "")
          .replace(/\s+/g, " ")
          .trim()
      )
      .filter(Boolean);

    const offenders = paragraphs.filter((p) => {
      if (!NEVER_LIST_WITH_BUILD.test(p)) return false;
      // Honest phrasings are allowed: an explicit exception, or a claim scoped
      // to the read-only surfaces.
      return !/--no-build|by default|one exception|web UI|dev server|read-only/i.test(p);
    });

    expect(
      offenders,
      `${rel} claims Aletheia never builds. It does: \`aletheia diff\` runs \`eve build\` unless --no-build is passed. Either scope the claim (web UI / inspection) or state the exception.`
    ).toEqual([]);
  });

  it("the quickstart and its llms-full.txt mirror agree", async () => {
    const quickstart = await readIfPresent("public/docs/quickstart.md");
    const llmsFull = await readIfPresent("public/llms-full.txt");
    expect(quickstart).not.toBeNull();
    expect(llmsFull).not.toBeNull();

    // llms-full.txt is a hand-maintained concatenation of public/docs/*.md.
    // Take the quickstart's opening claim and require it to appear verbatim.
    const firstPara = quickstart!.split("\n\n").find((p) => p.startsWith("Aletheia is a local-first"));
    expect(firstPara, "quickstart should open with the positioning paragraph").toBeTruthy();
    expect(
      llmsFull,
      "public/llms-full.txt has drifted from public/docs/quickstart.md. Aletheia has no generate/check:sync step (trust-kit and agentic-ux.com both do), so these are kept in sync by hand."
    ).toContain(firstPara!.trim());
  });
});
