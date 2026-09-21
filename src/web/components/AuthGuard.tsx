import React, { useEffect, useState, type FC, type ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { authApi } from "../api/client.js";
import type { AuthUser } from "../types.js";

interface AuthGuardProps {
  children: (user: AuthUser) => ReactNode;
}

const AuthGuard: FC<AuthGuardProps> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null | undefined>(undefined);

  useEffect(() => {
    authApi.me().then(setUser).catch(() => setUser(null));
  }, []);

  if (user === undefined) {
    return <div className="page">A carregar...</div>;
  }
  if (!user) {
    return <Navigate replace to="/login" />;
  }
  return <>{children(user)}</>;
};

export default AuthGuard;
