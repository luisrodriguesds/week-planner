import React, { useState, type FC, type FormEvent } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { ApiError, authApi } from "../api/client.js";

const LoginPage: FC = () => {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [checking, setChecking] = useState(true);
  const [authed, setAuthed] = useState(false);

  React.useEffect(() => {
    authApi.me().then(() => setAuthed(true)).catch(() => {}).finally(() => setChecking(false));
  }, []);

  if (checking) return <div className="login-page">A carregar...</div>;
  if (authed) return <Navigate replace to="/" />;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    try {
      await authApi.login(username, password);
      navigate("/");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Falha no login");
    }
  };

  return (
    <div className="login-page">
      <form className="card login-card stack" onSubmit={submit}>
        <h1>GoGym Planner</h1>
        <p>Inicia sessão para planear a tua semana.</p>
        <label className="field">
          Utilizador
          <input onChange={(e) => setUsername(e.target.value)} required value={username} />
        </label>
        <label className="field">
          Password
          <input onChange={(e) => setPassword(e.target.value)} required type="password" value={password} />
        </label>
        {error && <p className="error-text">{error}</p>}
        <button className="btn" type="submit">Entrar</button>
      </form>
    </div>
  );
};

export default LoginPage;
