export interface UserSettings {
  userId: number;
  digestEnabled: number;
  digestDay: number;
  digestHour: number;
  digestMinute: number;
  defaultClassFilter: string | null;
  centerId: number;
}

export interface AuthUser {
  id: number;
  username: string;
  email: string;
  role: string;
  displayName: string;
  gogymLinked: boolean;
  settings: UserSettings | null;
}

export interface ScheduleSlot {
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
  windowStatus: "FUTURE" | "OPEN" | "CLOSED";
  availableSpots: number;
  userPlanId: number | null;
  userPlanStatus: string | null;
  userHasReservation: boolean;
}

export interface Plan {
  id: number;
  status: string;
  idgrelha: number;
  nomeAula: string;
  nomeProfessor: string | null;
  nomeLocal: string | null;
  dataHoraAula: string;
  inicioMarcacao: string;
  fimMarcacao: string;
  idMarcacao: number | null;
  failureReason: string | null;
}

export interface GogymProfile {
  numcliente: string | null;
  idcliente: string | null;
  displayName: string | null;
}

export interface AdminUser {
  id: number;
  username: string;
  email: string;
  role: string;
  displayName: string;
  active: number;
  gogymLinked: boolean;
}
