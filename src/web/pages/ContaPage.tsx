import React, { useEffect, useState, type FC, type FormEvent } from "react";
import { ApiError, profileApi } from "../api/client.js";
import type { GogymProfile, UserSettings } from "../types.js";

const DAY_OPTIONS = [
  { value: 0, label: "Domingo" },
  { value: 1, label: "Segunda" },
  { value: 2, label: "Terça" },
  { value: 3, label: "Quarta" },
  { value: 4, label: "Quinta" },
  { value: 5, label: "Sexta" },
  { value: 6, label: "Sábado" },
];

const ContaPage: FC = () => {
  const [profile, setProfile] = useState<GogymProfile | null>(null);
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [numcliente, setNumcliente] = useState("");
  const [idcliente, setIdcliente] = useState("");
  const [validateResult, setValidateResult] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([profileApi.getGogym(), profileApi.getSettings()])
      .then(([gogym, userSettings]) => {
        setProfile(gogym);
        setSettings(userSettings);
        setNumcliente(gogym.numcliente ?? "");
        setIdcliente(gogym.idcliente ?? "");
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : "Erro ao carregar conta"));
  }, []);

  const saveGogym = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    try {
      const saved = await profileApi.saveGogym({ numcliente, idcliente });
      setProfile(saved);
      setMessage("Conta GoGym guardada");
      setTimeout(() => setMessage(""), 2500);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Erro ao guardar");
    }
  };

  const validate = async () => {
    setError("");
    setValidateResult("");
    try {
      const result = await profileApi.validateGogym();
      setValidateResult(`Validado: ${result.nome} (NaoMarcaAulas=${result.naoMarcaAulas ?? "?"})`);
      const refreshed = await profileApi.getGogym();
      setProfile(refreshed);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Validação falhou");
    }
  };

  const saveSettings = async (event: FormEvent) => {
    event.preventDefault();
    if (!settings) return;
    setError("");
    try {
      const saved = await profileApi.saveSettings(settings);
      setSettings(saved);
      setMessage("Definições guardadas");
      setTimeout(() => setMessage(""), 2500);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Erro ao guardar definições");
    }
  };

  return (
    <div className="stack">
      <h1>Conta GoGym</h1>
      {error && <p className="error-text">{error}</p>}
      {message && <p className="success-text">{message}</p>}

      <form className="card stack" onSubmit={saveGogym}>
        <h2>Credenciais GoGym</h2>
        {profile?.displayName && <p>Nome cache: {profile.displayName}</p>}
        <label className="field">
          Nº sócio (numcliente)
          <input onChange={(e) => setNumcliente(e.target.value)} value={numcliente} />
        </label>
        <label className="field">
          ID interno (idcliente)
          <input onChange={(e) => setIdcliente(e.target.value)} required value={idcliente} />
        </label>
        <div className="row">
          <button className="btn" type="submit">Guardar</button>
          <button className="btn secondary" onClick={validate} type="button">Validar</button>
        </div>
        {validateResult && <p className="success-text">{validateResult}</p>}
      </form>

      {settings && (
        <form className="card stack" onSubmit={saveSettings}>
          <h2>Digest semanal</h2>
          <label className="field">
            <span>Activar digest</span>
            <select
              onChange={(e) => setSettings({ ...settings, digestEnabled: Number(e.target.value) })}
              value={settings.digestEnabled}
            >
              <option value={1}>Sim</option>
              <option value={0}>Não</option>
            </select>
          </label>
          <label className="field">
            Dia
            <select
              onChange={(e) => setSettings({ ...settings, digestDay: Number(e.target.value) })}
              value={settings.digestDay}
            >
              {DAY_OPTIONS.map((day) => (
                <option key={day.value} value={day.value}>{day.label}</option>
              ))}
            </select>
          </label>
          <label className="field">
            Hora
            <input
              max={23}
              min={0}
              onChange={(e) => setSettings({ ...settings, digestHour: Number(e.target.value) })}
              type="number"
              value={settings.digestHour}
            />
          </label>
          <label className="field">
            Minuto
            <input
              max={59}
              min={0}
              onChange={(e) => setSettings({ ...settings, digestMinute: Number(e.target.value) })}
              type="number"
              value={settings.digestMinute}
            />
          </label>
          <button className="btn" type="submit">Guardar definições</button>
        </form>
      )}
    </div>
  );
};

export default ContaPage;
