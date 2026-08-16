import type { ReactNode } from "react";
import { Link, NavLink } from "react-router-dom";

const ROUTES = [
  { to: "/", label: "About", end: true },
  { to: "/portrait", label: "Portrait" },
  { to: "/review", label: "Authority" },
  { to: "/gallery", label: "Gallery" },
  { to: "/manifesto", label: "Manifesto" },
  { to: "/privacy", label: "Privacy" },
] as const;

interface AppNavProps {
  /** Center slot — workspace switcher on portrait/review when the dev API is up. */
  center?: ReactNode;
}

export function AppNav({ center }: AppNavProps) {
  return (
    <nav className="topbar" aria-label="Main">
      <div className="wordmark">
        <Link to="/" className="wordmark-link">
          Aletheia
        </Link>
      </div>
      {center ? <div className="topbar-center">{center}</div> : null}
      <div className="topbar-nav">
        {ROUTES.map(({ to, label, ...rest }) => (
          <NavLink
            key={to}
            to={to}
            end={"end" in rest ? rest.end : false}
            className={({ isActive }) =>
              isActive ? "topbar-nav-link active" : "topbar-nav-link"
            }
          >
            {label}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
