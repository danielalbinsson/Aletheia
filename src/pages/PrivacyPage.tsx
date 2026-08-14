import { AppFooter } from "../components/AppFooter";
import { AppNav } from "../components/AppNav";

export function PrivacyPage() {
  return (
    <main className="app privacy-app">
      <AppNav subtitle="privacy" />

      <article className="prose privacy">
        <h1>Privacy</h1>
        <p className="privacy-updated">Last updated: August 2026</p>

        <section>
          <h2>What this site collects</h2>
          <p>
            The hosted showcase does <strong>not</strong> use analytics, advertising trackers,
            accounts, cookies, or forms that collect personal data.
          </p>
        </section>

        <section>
          <h2>Third-party fonts</h2>
          <p>
            Pages load Archivo from{" "}
            <a href="https://fonts.google.com" target="_blank" rel="noreferrer">
              Google Fonts
            </a>
            . Google may receive your IP address and request metadata. Use the local build or
            block third-party fonts to avoid that.
          </p>
        </section>

        <section>
          <h2>Local tool (when you run <code>pnpm dev</code>)</h2>
          <p>
            The local server reads folders you choose. That data stays on your computer; it is not
            uploaded. The last scan root may be saved in{" "}
            <code>~/.aletheia/workspaces.json</code>.
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
