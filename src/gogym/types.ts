export interface GoGymClass {
  IDgrelha: number;
  IDaula: number;
  NomeAula: string;
  NomeProfessor: string;
  NomeLocal: string;
  DataHoraAula: string;
  DataHoraInicioMarcacao: string;
  DataHoraFimMarcacao: string;
  LotacaoReservaWeb: number;
  TotalMarcacoes: number;
  CentroLocal: number;
  NomeFuso: string;
  ValorA: string | null;
  ValorB: string | null;
  ValorC: string | null;
  ValorBNumAlunos: number | null;
  ValorCNumAlunos: number | null;
  HoraAtualServidor: string;
}

export interface BookPayload {
  idcliente: string;
  idgrelha: string;
  dataHoraAula: string;
  centroLocal: string;
  inicioMarcacao: string;
  fimMarcacao: string;
  lotacaoReservaWeb: string;
  fusoHorario: string;
  valorA: string;
  valorB: string;
  valorC: string;
  valorBNumAlunos: string;
  valorCNumAlunos: string;
}

export interface BookResult {
  sucesso: boolean;
  mensagem: string;
  tipo: string;
  idMarcacao?: number;
}

export interface Reservation {
  ID: number;
  NomeAula: string;
  DataHoraAula: string;
}

export interface ClientInfo {
  status: string;
  numcliente: string;
  nome: string;
  email: string;
  centrolocal: number;
  inativo: number;
  settingsJSON: string;
}

export interface CancelResult {
  sucesso: boolean;
  mensagem: string;
  tipo: string;
}
