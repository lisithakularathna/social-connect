import { useNavigate } from "react-router-dom";

function Navbar() {
  const navigate=useNavigate();
  const logout=()=>{localStorage.removeItem("accessToken");navigate("/login");};
  return <header className="top-navbar">
    <div className="top-logo" onClick={()=>navigate("/")}>Social Connect</div>
    <div className="top-nav-actions">
      <button onClick={()=>navigate("/create")} className="top-create-btn">＋ Create</button>
      <button onClick={logout} className="top-logout">Logout</button>
    </div>
  </header>;
}
export default Navbar;