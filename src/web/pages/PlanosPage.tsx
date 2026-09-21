import React, { useEffect, useState, type FC } from "react";
import { ApiError, plansApi } from "../api/client.js";
import type { Plan } from "../types.js";

const PlanosPage: FC = () => {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      setPlans(await plansApi.list());
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Erro ao carregar Planos");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const cancelPlan = async (id: number) => {
    setError("");
    try {
      await plansApi.cancel(id);
      setMessage("Plano cancelado");
      await load();
      setTimeout(() => setMessage(""), 2500);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Erro ao cancelar Plano");
    }
  };

  return (
    <div className="stack">
      <h1>Os meus Planos</h1>
      {loading && <p>A carregar...</p>}
      {error && <p className="error-text">{error}</p>}
      {message && <p className="success-text">{message}</p>}

      {!loading && plans.length === 0 && <p>Ainda não tens Planos.</p>}

      {!loading && plans.length > 0 && (
        <div className="card">
          <table className="table">
            <thead>
              <tr>
                <th>Aula</th>
                <th>Data/Hora</th>
                <th>Estado</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {plans.map((plan) => (
                <tr key={plan.id}>
                  <td>{plan.nomeAula}</td>
                  <td>{plan.dataHoraAula}</td>
                  <td><span className={`badge ${plan.status.toLowerCase()}`}>{plan.status}</span></td>
                  <td>
                    {(plan.status === "PLANNED" || plan.status === "BOOKED") && (
                      <button className="btn danger" onClick={() => cancelPlan(plan.id)} type="button">
                        Cancelar
                      </button>
                    )}
                    {plan.status === "FAILED" && plan.failureReason && (
                      <span className="meta">{plan.failureReason}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default PlanosPage;
