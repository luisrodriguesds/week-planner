import { buildBookPayload } from "./book.js";
import type {
  BookResult,
  CancelResult,
  ClientInfo,
  GoGymClass,
  Reservation,
} from "./types.js";

export interface GoGymClientConfig {
  baseUrl: string;
  centerId: number;
}

export function createGoGymClient(config: GoGymClientConfig) {
  const postForm = async <T>(path: string, body: Record<string, string>): Promise<T> => {
    const params = new URLSearchParams(body);
    const res = await fetch(`${config.baseUrl}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params,
    });
    if (!res.ok) throw new Error(`GoGym ${path} HTTP ${res.status}`);
    return res.json() as Promise<T>;
  };

  return {
    async fetchWeekSchedule(): Promise<GoGymClass[]> {
      return postForm("/app/php/mapa_aulas.php", {
        centrolocal: String(config.centerId),
      });
    },

    async getServerTime(): Promise<Date> {
      const data = await this.fetchWeekSchedule();
      const raw = data[0]?.HoraAtualServidor ?? new Date().toISOString().slice(0, 19).replace("T", " ");
      return new Date(raw.replace(" ", "T"));
    },

    async validateClient(idcliente: string): Promise<ClientInfo> {
      return postForm("/app/php/ler_cliente.php", { idcliente });
    },

    async listReservations(idcliente: string): Promise<Reservation[]> {
      return postForm("/app/php/listar_reservas.php", { idcliente });
    },

    async bookClass(idcliente: string, slot: GoGymClass): Promise<BookResult> {
      const payload = buildBookPayload(idcliente, slot);
      const body: Record<string, string> = { ...payload };
      return postForm("/app/php/insert_marcacao.php", body);
    },

    async cancelReservation(idMarcacao: number): Promise<CancelResult> {
      return postForm("/app/php/desmarcar_aula.php", {
        id: String(idMarcacao),
      });
    },
  };
}

export type GoGymClient = ReturnType<typeof createGoGymClient>;
