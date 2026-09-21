import React, { type FC, type ReactNode } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { authApi } from "../api/client.js";
import type { AuthUser } from "../types.js";

interface LayoutProps {
  children: ReactNode;
  user: AuthUser;
}

const Layout: FC<LayoutProps> = ({ children, user }) => {
  const location = useLocation();
  const navigate = useNavigate();

  const logout = async () => {
    await authApi.logout();
    navigate("/login");
  };

  return (
    <div className="app-shell">
      <header className="topbar">
        <strong>GoGym Planner</strong>
        <nav>
          <Link className={location.pathname === "/" ? "active" : ""} to="/">Semana</Link>
          <Link className={location.pathname === "/planos" ? "active" : ""} to="/planos">Planos</Link>
          <Link className={location.pathname === "/conta" ? "active" : ""} to="/conta">Conta</Link>
          {user.role === "admin" && (
            <Link className={location.pathname === "/admin/users" ? "active" : ""} to="/admin/users">Admin</Link>
          )}
          <button className="link" onClick={logout} type="button">Sair</button>
        </nav>
      </header>
      <main className="page">{children}</main>
    </div>
  );
};

export default Layout;
