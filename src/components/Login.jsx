import { useState } from "react";
import '../styles/Login.css';

export default function Login({ onLogin }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    // Simulate login delay
    setTimeout(() => {
      // Worker account
      if (username === "sanarworker" && password === "sanar123") {
        onLogin("worker", rememberMe);
        setLoading(false);
      }
      // Admin account
      else if (username === "SanarAdmin" && password === "Admin@sanar!") {
        onLogin("admin", rememberMe);
        setLoading(false);
      }
      // Invalid credentials
      else {
        setError("Invalid username or password");
        setLoading(false);
      }
    }, 500);
  };

  return (
    <div className="login-container">
      <div className="login-box">
        <div className="login-header">
          <h1>Sanar Freezer</h1>
          <p className="login-subtitle">Inventory Management System</p>
        </div>

        <form onSubmit={handleLogin} className="login-form">
          <div className="form-group">
            <label>Username</label>
            <input
              type="text"
              placeholder="Enter username"
              value={username}
              onChange={e => setUsername(e.target.value)}
              required
              disabled={loading}
            />
          </div>

          <div className="form-group">
            <label>Password</label>
            <input
              type="password"
              placeholder="Enter password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              disabled={loading}
            />
          </div>

          <div className="remember-me">
            <input
              type="checkbox"
              id="rememberMe"
              checked={rememberMe}
              onChange={e => setRememberMe(e.target.checked)}
              disabled={loading}
            />
            <label htmlFor="rememberMe">Stay signed in</label>
          </div>

          {error && <div className="error-message">{error}</div>}

          <button type="submit" disabled={loading}>
            {loading ? "Logging in..." : "Login"}
          </button>
        </form>
      </div>
    </div>
  );
}
