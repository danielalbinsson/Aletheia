import { Link } from "react-router-dom";

export function AppFooter() {
  return (
    <footer className="site-footer">
      <span>
        MIT License ·{" "}
        <Link to="/privacy">Privacy</Link>
        {" · "}
        <a href="https://github.com/danielalbinsson/Aletheia" target="_blank" rel="noreferrer">
          Source
        </a>
      </span>
    </footer>
  );
}
