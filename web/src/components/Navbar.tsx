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

      <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
        <button
          onClick={() => navigate("/create")}
          style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '20px' }}
          title="Create Post"
        >
          ＋
        </button>
        <button
          onClick={logout}
          className="top-logout"
        >
          Logout
        </button>
      </div>
    </header>
  );
}

export default Navbar;
