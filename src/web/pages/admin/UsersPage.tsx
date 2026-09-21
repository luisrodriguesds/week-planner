import React, { useEffect, useState, type FC, type FormEvent } from "react";
import { ApiError, adminApi } from "../../api/client.js";
import type { AdminUser } from "../../types.js";

const UsersPage: FC = () => {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({
    username: "",
    email: "",
    displayName: "",
    password: "",
    role: "user",
  });

  const load = async () => {
    setLoading(true);
    try {
      setUsers(await adminApi.listUsers());
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Erro ao carregar utilizadores");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const createUser = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    try {
      await adminApi.createUser(form);
      setShowModal(false);
      setForm({ username: "", email: "", displayName: "", password: "", role: "user" });
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Erro ao criar utilizador");
    }
  };

  const deactivate = async (id: number) => {
    setError("");
    try {
      await adminApi.deactivateUser(id);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Erro ao desactivar");
    }
  };

  return (
    <div className="stack">
      <div className="row" style={{ justifyContent: "space-between" }}>
        <h1>Utilizadores</h1>
        <button className="btn" onClick={() => setShowModal(true)} type="button">Criar utilizador</button>
      </div>

      {loading && <p>A carregar...</p>}
      {error && <p className="error-text">{error}</p>}

      {!loading && (
        <div className="card">
          <table className="table">
            <thead>
              <tr>
                <th>Utilizador</th>
                <th>Email</th>
                <th>Role</th>
                <th>GoGym</th>
                <th>Activo</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id}>
                  <td>{user.displayName} ({user.username})</td>
                  <td>{user.email}</td>
                  <td>{user.role}</td>
                  <td>{user.gogymLinked ? "Sim" : "Não"}</td>
                  <td>{user.active ? "Sim" : "Não"}</td>
                  <td>
                    {user.active === 1 && (
                      <button className="btn danger" onClick={() => deactivate(user.id)} type="button">
                        Desactivar
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <div className="modal-backdrop">
          <form className="card modal stack" onSubmit={createUser}>
            <h2>Novo utilizador</h2>
            <label className="field">
              Username
              <input onChange={(e) => setForm({ ...form, username: e.target.value })} required value={form.username} />
            </label>
            <label className="field">
              Email
              <input onChange={(e) => setForm({ ...form, email: e.target.value })} required type="email" value={form.email} />
            </label>
            <label className="field">
              Nome
              <input onChange={(e) => setForm({ ...form, displayName: e.target.value })} required value={form.displayName} />
            </label>
            <label className="field">
              Password
              <input onChange={(e) => setForm({ ...form, password: e.target.value })} required type="password" value={form.password} />
            </label>
            <label className="field">
              Role
              <select onChange={(e) => setForm({ ...form, role: e.target.value })} value={form.role}>
                <option value="user">user</option>
                <option value="admin">admin</option>
              </select>
            </label>
            <div className="row">
              <button className="btn" type="submit">Criar</button>
              <button className="btn secondary" onClick={() => setShowModal(false)} type="button">Cancelar</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

export default UsersPage;
