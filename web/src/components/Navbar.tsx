import { useNavigate } from "react-router-dom";

function Navbar() {
  const navigate = useNavigate();

  const logout = () => {
    localStorage.removeItem("accessToken");
    navigate("/login");
  };

  return (
    <header className="top-navbar">
      <div
        className="top-logo"
        onClick={() => navigate("/")}
      >
        Social Connect
      </div>

      <button
        onClick={logout}
        className="top-logout"
      >
        Logout
      </button>
    </header>
  );
}

export default Navbar;
