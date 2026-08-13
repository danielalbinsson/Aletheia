import { AppFooter } from "../components/AppFooter";
import { AppNav } from "../components/AppNav";

export function PrivacyPage() {
  return (
    <main className="app privacy-app">
      <AppNav subtitle="privacy" />

      <article className="prose privacy">
        <h1>Privacy</h1>
        <p className="privacy-updated">Last updated: July 2026</p>

        <section>
          <h2>What this site collects</h2>
          <p>
            The hosted Aletheia showcase does <strong>not</strong> use analytics, advertising
            trackers, accounts, or cookies set by this application. We do not collect personal data
            through forms or sign-in on this site.
          </p>
        </section>

        <section>
          <h2>Third-party fonts</h2>
          <p>
            Pages load the Archivo typeface from{" "}
            <a href="https://fonts.google.com" target="_blank" rel="noreferrer">
              Google Fonts
            </a>
            . When your browser requests those files, Google may receive your IP address and basic
            request metadata under Google's own privacy policy. If you prefer to avoid that, use the
            local dev build or block third-party font requests in your browser.
          </p>
        </section>

        <section>
          <h2>Local tool (when you run <code>pnpm dev</code>)</h2>
          <p>
            The local Aletheia server reads eve agent files from folders you choose on your machine.
            That data stays on your computer. It is not uploaded to this website or to Aletheia's
            authors. Aletheia does not run, edit, or deploy your agents.
          </p>
          <p>
            The dev server may persist your last scan root in{" "}
            <code>~/.aletheia/workspaces.json</code> on your machine for convenience.
          </p>
        </section>

        <section>
          <h2>Hosting</h2>
          <p>
            This showcase is deployed on{" "}
            <a href="https://vercel.com/legal/privacy-policy" target="_blank" rel="noreferrer">
              Vercel
            </a>
            . Standard web server logs (IP, user agent, requested URL) may be retained by the host
            as part of normal operation.
          </p>
        </section>

        <section>
          <h2>Contact</h2>
          <p>
            Questions:{" "}
            <a href="mailto:daniel.albinsson@pm.me">daniel.albinsson@pm.me</a>
          </p>
        </section>
      </article>

      <AppFooter />
    </main>
  );
}
