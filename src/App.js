import { useState, useEffect } from "react";
import Dashboard from "./components/Dashboard";
import AddItem from "./components/AddItem";
import UpdateStock from "./components/UpdateStock";
import History from "./components/History";
import ManageItems from "./components/ManageItems";
import Login from "./components/Login";
import './App.css';

export default function App() {
  const [user, setUser] = useState(null);
  const [view, setView] = useState("dashboard");
  const [menuOpen, setMenuOpen] = useState(false);

  // Load user from localStorage on mount
  useEffect(() => {
    const savedUser = localStorage.getItem("user");
    if (savedUser) {
      const userData = JSON.parse(savedUser);
      setUser(userData);
      // Set appropriate initial view based on role
      if (userData.role === "worker") {
        setView("update");
      } else {
        setView("dashboard");
      }
    }
  }, []);

  const handleLogin = (role, rememberMe) => {
    const userData = { role };
    setUser(userData);
    // Set initial view based on role
    if (role === "worker") {
      setView("update"); // Workers start at Update Stock (Sales)
    } else {
      setView("dashboard"); // Admins start at Dashboard
    }
    if (rememberMe) {
      localStorage.setItem("user", JSON.stringify(userData));
    }
  };

  const handleLogout = () => {
    setUser(null);
    setMenuOpen(false);
    localStorage.removeItem("user");
  };

  const handleNavClick = (newView) => {
    setView(newView);
    setMenuOpen(false);
  };

  // Filter menu items based on user role
  const getMenuItems = () => {
    const baseItems = [
      { view: "manage", label: "Manage Items", icon: "➕", allRoles: true },
      { view: "add", label: "Update Stock", icon: "📦", allRoles: true },
      { view: "update", label: "Sales", icon: "🛒", allRoles: true },
    ];

    const adminOnlyItems = [
      { view: "dashboard", label: "Dashboard", icon: "📊", adminOnly: true },
      { view: "history", label: "Activity Logs", icon: "📋", adminOnly: true },
    ];

    if (user?.role === "admin") {
      return [adminOnlyItems[0], ...baseItems, adminOnlyItems[1]];
    } else {
      // Worker role - no dashboard or activity logs
      return baseItems;
    }
  };

  // Show login page if not authenticated
  if (!user) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <div className="App">
      <header className="app-header">
        <div className="header-container">
          <button className="hamburger-btn" onClick={() => setMenuOpen(!menuOpen)} aria-label="Toggle menu">
            <span></span>
            <span></span>
            <span></span>
          </button>
          <button className="header-brand" onClick={() => handleNavClick(user?.role === "worker" ? "update" : "dashboard")}>
            <h1>Sanar Freezer</h1>
            <p className="subtitle">Inventory System</p>
          </button>
        </div>
      </header>

      {menuOpen && <div className="menu-backdrop" onClick={() => setMenuOpen(false)}></div>}

      <nav className={`side-menu ${menuOpen ? "open" : ""}`}>
        <div className="menu-header">
          <div>
            <h2>Menu</h2>
            <p style={{ fontSize: '0.875rem', color: '#9ca3af', margin: '0.25rem 0 0 0' }}>
              {user?.role === "admin" ? "Admin" : "Worker"}
            </p>
          </div>
          <button className="close-btn" onClick={() => setMenuOpen(false)}>✕</button>
        </div>
        <div className="menu-items">
          {getMenuItems().map((item) => (
            <button 
              key={item.view}
              className={`menu-item ${view === item.view ? "active" : ""}`}
              onClick={() => handleNavClick(item.view)}
            >
              <span className="menu-icon">{item.icon}</span>
              <span className="menu-label">{item.label}</span>
            </button>
          ))}
          <button 
            className="menu-item logout-btn"
            onClick={handleLogout}
          >
            <span className="menu-icon">🚪</span>
            <span className="menu-label">Logout</span>
          </button>
        </div>
      </nav>

      <main className="main-content">
        {view === "dashboard" && user?.role === "admin" && <Dashboard />}
{view === "history" && user?.role === "admin" && <History />}
        {view === "manage" && <ManageItems />}
        {view === "add" && <AddItem />}
        {view === "update" && <UpdateStock />}
       
      </main>
    </div>
  );
}