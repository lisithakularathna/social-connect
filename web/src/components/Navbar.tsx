import { Link, useNavigate, useLocation } from "react-router-dom";

function Navbar() {
  const navigate = useNavigate();
  const location = useLocation();

  const logout = () => {
    localStorage.removeItem("accessToken");
    navigate("/login");
  };

  const isActive = (path: string) => location.pathname === path;

  return (
    <nav className="navbar">
      <Link to="/" className="logo">
        Social Connect
      </Link>

      <div className="nav-links">
        <Link to="/" title="Home">
          {isActive("/") ? "⌂" : "⌂"}
        </Link>
        <Link to="/create" title="Create Post">
          {isActive("/create") ? "⊞" : "⊞"}
        </Link>
        <Link to="/profile" title="Profile">
          {isActive("/profile") ? "👤" : "👤"}
        </Link>

        <button onClick={logout} className="logout-btn" title="Logout">
          Logout
        </button>
      </div>
    </nav>
  );
}

export default Navbar;
