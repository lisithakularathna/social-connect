import { NavLink, useNavigate } from "react-router-dom";

function BottomNav() {
  const navigate = useNavigate();

  const navItemClass = ({ isActive }: { isActive: boolean }) =>
    `bottom-nav-item ${isActive ? "active" : ""}`;

  const logout = () => {
    localStorage.removeItem("accessToken");
    navigate("/login");
  };

  return (
    <nav className="bottom-nav">
      <NavLink to="/" className={navItemClass} title="Home">
        <span className="nav-icon">⌂</span>
        <span className="nav-label">Home</span>
      </NavLink>

      <NavLink to="/search" className={navItemClass} title="Search">
        <span className="nav-icon">⌕</span>
        <span className="nav-label">Search</span>
      </NavLink>

      <NavLink to="/create" className={navItemClass} title="Create">
        <span className="create-icon">＋</span>
        <span className="nav-label">Create</span>
      </NavLink>

      <NavLink to="/activity" className={navItemClass} title="Activity">
        <span className="nav-icon">♡</span>
        <span className="nav-label">Activity</span>
      </NavLink>

      <NavLink to="/profile" className={navItemClass} title="Profile">
        <span className="nav-icon">◉</span>
        <span className="nav-label">Profile</span>
      </NavLink>

      <button
        onClick={logout}
        className="bottom-nav-item logout-mobile"
        title="Logout"
      >
        <span className="nav-icon">⇥</span>
        <span className="nav-label">Logout</span>
      </button>
    </nav>
  );
}

export default BottomNav;
