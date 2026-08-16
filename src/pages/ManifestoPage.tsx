import type { ReactNode } from "react";
import { AppFooter } from "../components/AppFooter";
import { AppNav } from "../components/AppNav";
import manifestoMd from "../../MANIFESTO.md?raw";

/** Inline markdown: **bold**, *em*, `code`, [text](url). Controlled content. */
function inline(text: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const re = /\*\*([^*]+)\*\*|\*([^*]+)\*|`([^`]+)`|\[([^\]]+)\]\(([^)]+)\)/g;
  let last = 0;
  let key = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (m.index > last) nodes.push(text.slice(last, m.index));
    if (m[1]) nodes.push(<strong key={key++}>{m[1]}</strong>);
    else if (m[2]) nodes.push(<em key={key++}>{m[2]}</em>);
    else if (m[3]) nodes.push(<code key={key++}>{m[3]}</code>);
    else if (m[4]) {
      const external = /^https?:/.test(m[5]);
      nodes.push(
        <a
          key={key++}
          href={m[5]}
          {...(external ? { target: "_blank", rel: "noreferrer" } : {})}
        >
          {m[4]}
        </a>
      );
    }
    last = re.lastIndex;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

/** Minimal block markdown → React for this manifesto's subset. */
function renderMarkdown(md: string): ReactNode[] {
  return md
    .split(/\n{2,}/)
    .map((raw, i) => {
      const b = raw.trim();
      if (!b) return null;
      if (b === "---") return <hr key={i} />;
      if (b.startsWith("### ")) return <h3 key={i}>{inline(b.slice(4))}</h3>;
      if (b.startsWith("## ")) return <h2 key={i}>{inline(b.slice(3))}</h2>;
      if (b.startsWith("# ")) return <h1 key={i}>{inline(b.slice(2))}</h1>;
      if (b.split("\n").every((l) => l.startsWith("- "))) {
        return (
          <ul key={i}>
            {b.split("\n").map((l, j) => (
              <li key={j}>{inline(l.slice(2))}</li>
            ))}
          </ul>
        );
      }
      return <p key={i}>{inline(b.replace(/\n/g, " "))}</p>;
    })
    .filter(Boolean);
}

export function ManifestoPage() {
  return (
    <main className="app manifesto-app">
      <AppNav />
      <article className="manifesto">{renderMarkdown(manifestoMd)}</article>
      <AppFooter />
    </main>
  );
}
