import { NavLink, useNavigate } from "react-router-dom";

function BottomNav() {
  const navigate = useNavigate();

  const navItemClass = ({
    isActive,
  }: {
    isActive: boolean;
  }) =>
    `bottom-nav-item ${
      isActive ? "active" : ""
    }`;

  return (
    <nav className="bottom-nav">
      <NavLink
        to="/"
        className={navItemClass}
      >
        <span className="nav-icon">⌂</span>
        <span className="nav-label">Home</span>
      </NavLink>

      <NavLink
        to="/search"
        className={navItemClass}
      >
        <span className="nav-icon">⌕</span>
        <span className="nav-label">Search</span>
      </NavLink>

      <NavLink
        to="/create"
        className={navItemClass}
      >
        <span className="create-icon">
          ＋
        </span>
        <span className="nav-label">Create</span>
      </NavLink>

      <NavLink
        to="/activity"
        className={navItemClass}
      >
        <span className="nav-icon">♡</span>
        <span className="nav-label">
          Activity
        </span>
      </NavLink>

      <NavLink
        to="/messages"
        className={navItemClass}
      >
        <span className="nav-icon">✉</span>
        <span className="nav-label">
          Messages
        </span>
      </NavLink>

      <NavLink
        to="/profile"
        className={navItemClass}
      >
        <span className="nav-icon">◉</span>
        <span className="nav-label">
          Profile
        </span>
      </NavLink>
    </nav>
  );
}

export default BottomNav;
