import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../api/api";

function Register() {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");

  const [error, setError] = useState("");

  const register = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      await api.post("/auth/register", {
        email,
        username,
        name,
        password,
      });

      navigate("/login");
    } catch {
      setError("Registration failed");
    }
  };

  return (
    <div className="auth-page">
      <form className="auth-card" onSubmit={register}>
        <h1>Create Account</h1>

        {error && <div className="error">{error}</div>}

        <input
          placeholder="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />

        <input
          placeholder="Username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
        />

        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />

        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />

        <button type="submit">
          Register
        </button>

        <p>
          Already have an account?{" "}
          <Link to="/login">
            Login
          </Link>
        </p>
      </form>
    </div>
  );
}

export default Register;
