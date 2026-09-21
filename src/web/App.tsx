import React, { type FC } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import AuthGuard from "./components/AuthGuard.js";
import Layout from "./components/Layout.js";
import ContaPage from "./pages/ContaPage.js";
import LoginPage from "./pages/LoginPage.js";
import PlanosPage from "./pages/PlanosPage.js";
import WeekPage from "./pages/WeekPage.js";
import UsersPage from "./pages/admin/UsersPage.js";

const App: FC = () => {
  return (
    <Routes>
      <Route element={<LoginPage />} path="/login" />
      <Route
        element={
          <AuthGuard>
            {(user) => (
              <Layout user={user}>
                <WeekPage user={user} />
              </Layout>
            )}
          </AuthGuard>
        }
        path="/"
      />
      <Route
        element={
          <AuthGuard>
            {(user) => (
              <Layout user={user}>
                <PlanosPage />
              </Layout>
            )}
          </AuthGuard>
        }
        path="/planos"
      />
      <Route
        element={
          <AuthGuard>
            {(user) => (
              <Layout user={user}>
                <ContaPage />
              </Layout>
            )}
          </AuthGuard>
        }
        path="/conta"
      />
      <Route
        element={
          <AuthGuard>
            {(user) => (
              user.role === "admin" ? (
                <Layout user={user}>
                  <UsersPage />
                </Layout>
              ) : (
                <Navigate replace to="/" />
              )
            )}
          </AuthGuard>
        }
        path="/admin/users"
      />
      <Route element={<Navigate replace to="/" />} path="*" />
    </Routes>
  );
};

export default App;
