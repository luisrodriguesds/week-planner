import { describe, it, expect, vi, beforeEach } from "vitest";
import { createGoGymClient } from "./client.js";
import type { GoGymClass } from "./types.js";

const baseSlot: GoGymClass = {
  IDgrelha: 11701,
  IDaula: 401,
  NomeAula: "Zumba 45",
  NomeProfessor: "Marta",
  NomeLocal: "Estudio 1",
  DataHoraAula: "2026-09-21 21:15:00",
  DataHoraInicioMarcacao: "2026-09-21 09:15:00.000000",
  DataHoraFimMarcacao: "2026-09-21 21:00:00.000000",
  LotacaoReservaWeb: 25,
  TotalMarcacoes: 10,
  CentroLocal: 1,
  NomeFuso: "Europe/Lisbon",
  ValorA: "13.65",
  ValorB: "16.00",
  ValorC: null,
  ValorBNumAlunos: 16,
  ValorCNumAlunos: null,
  HoraAtualServidor: "2026-09-21 15:00:00",
};

describe("createGoGymClient", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("should fetch week schedule from mapa_aulas.php", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [{ IDgrelha: 1, HoraAtualServidor: "2026-09-21 15:00:00" }],
    }));

    const client = createGoGymClient({
      baseUrl: "https://gogym.gomygym.com",
      centerId: 1,
    });
    const schedule = await client.fetchWeekSchedule();
    expect(schedule).toHaveLength(1);
    expect(schedule[0].IDgrelha).toBe(1);
  });

  it("should POST insert_marcacao.php with urlencoded body", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ sucesso: true, idMarcacao: 179112, mensagem: "ok", tipo: "sucesso" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const client = createGoGymClient({ baseUrl: "https://gogym.gomygym.com", centerId: 1 });
    const result = await client.bookClass("999", baseSlot);
    expect(result.sucesso).toBe(true);
    expect(result.idMarcacao).toBe(179112);
    expect(fetchMock.mock.calls[0][0]).toContain("insert_marcacao.php");
  });
});
