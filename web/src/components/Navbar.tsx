import { Link, useNavigate } from "react-router-dom";

function Navbar() {
  const navigate = useNavigate();

  const logout = () => {
    localStorage.removeItem("accessToken");
    navigate("/login");
  };

  return (
    <nav className="navbar">
      <Link to="/" className="logo">
        Social Connect
      </Link>

      <div className="nav-links">
        <Link to="/">Home</Link>
        <Link to="/create">Create</Link>
        <Link to="/profile">Profile</Link>

        <button onClick={logout} className="logout-btn">
          Logout
        </button>
      </div>
    </nav>
  );
}

export default Navbar;
