import type { BookPayload, GoGymClass } from "./types.js";

export function formatGoGymDateTime(raw: string): string {
  return raw.split(".")[0] ?? raw;
}

function num(value: string | number | null | undefined, fallback = "0"): string {
  if (value === null || value === undefined || value === "") return fallback;
  return String(value);
}

export function buildBookPayload(idcliente: string, slot: GoGymClass): BookPayload {
  return {
    idcliente,
    idgrelha: String(slot.IDgrelha),
    dataHoraAula: formatGoGymDateTime(slot.DataHoraAula),
    centroLocal: String(slot.CentroLocal),
    inicioMarcacao: formatGoGymDateTime(slot.DataHoraInicioMarcacao),
    fimMarcacao: formatGoGymDateTime(slot.DataHoraFimMarcacao),
    lotacaoReservaWeb: String(slot.LotacaoReservaWeb),
    fusoHorario: slot.NomeFuso,
    valorA: num(slot.ValorA),
    valorB: num(slot.ValorB),
    valorC: num(slot.ValorC),
    valorBNumAlunos: num(slot.ValorBNumAlunos),
    valorCNumAlunos: num(slot.ValorCNumAlunos),
  };
}
