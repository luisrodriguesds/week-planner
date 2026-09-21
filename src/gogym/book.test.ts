import { describe, it, expect } from "vitest";
import { buildBookPayload, formatGoGymDateTime } from "./book.js";
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

describe("formatGoGymDateTime", () => {
  it("should strip microseconds", () => {
    expect(formatGoGymDateTime("2026-09-21 09:15:00.000000")).toBe("2026-09-21 09:15:00");
  });
});

describe("buildBookPayload", () => {
  it("should use NomeFuso and zero for null ValorC", () => {
    const payload = buildBookPayload("12345", baseSlot);
    expect(payload.fusoHorario).toBe("Europe/Lisbon");
    expect(payload.valorC).toBe("0");
    expect(payload.valorCNumAlunos).toBe("0");
    expect(payload.idgrelha).toBe("11701");
  });
});
