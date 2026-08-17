import { Link } from "react-router-dom";

export function AppFooter() {
  return (
    <footer className="site-footer">
      <span>
        <a
          href="https://github.com/danielalbinsson/Aletheia/blob/main/LICENSE"
          target="_blank"
          rel="noreferrer"
          aria-label="MIT License (opens in a new tab)"
        >
          MIT License
        </a>
        {" · "}
        <Link to="/privacy">Privacy</Link>
        {" · "}
        <a
          href="https://github.com/danielalbinsson/Aletheia"
          target="_blank"
          rel="noreferrer"
          aria-label="Source (opens in a new tab)"
        >
          Source
        </a>
      </span>
    </footer>
  );
}
