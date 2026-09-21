import type { AdminUser, AuthUser, GogymProfile, Plan, ScheduleSlot, UserSettings } from "../types.js";

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  if (options.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  const res = await fetch(path, {
    ...options,
    credentials: "include",
    headers,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: "unknown", message: res.statusText }));
    throw new ApiError(res.status, body.error ?? "unknown", body.message ?? "Request failed");
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const authApi = {
  login: (username: string, password: string) =>
    api<{ id: number; username: string; role: string }>("/api/v1/auth/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    }),
  logout: () => api<void>("/api/v1/auth/logout", { method: "POST" }),
  me: () => api<AuthUser>("/api/v1/auth/me"),
};

export const scheduleApi = {
  week: (filter?: string) => {
    const params = new URLSearchParams({ center: "1" });
    if (filter?.trim()) params.set("filter", filter.trim());
    return api<ScheduleSlot[]>(`/api/v1/schedule/week?${params}`);
  },
};

export const plansApi = {
  list: (status?: string) => {
    const query = status ? `?status=${encodeURIComponent(status)}` : "";
    return api<Plan[]>(`/api/v1/plans${query}`);
  },
  create: (idgrelha: number) =>
    api<Plan>("/api/v1/plans", { method: "POST", body: JSON.stringify({ idgrelha }) }),
  cancel: (id: number) => api<Plan>(`/api/v1/plans/${id}`, { method: "DELETE" }),
};

export const profileApi = {
  getGogym: () => api<GogymProfile>("/api/v1/profile/gogym"),
  saveGogym: (data: { numcliente?: string; idcliente: string }) =>
    api<GogymProfile>("/api/v1/profile/gogym", { method: "PUT", body: JSON.stringify(data) }),
  validateGogym: () =>
    api<{ status: string; nome: string; inativo: number; naoMarcaAulas: number | null }>(
      "/api/v1/profile/gogym/validate",
      { method: "POST" },
    ),
  getSettings: () => api<UserSettings>("/api/v1/profile/settings"),
  saveSettings: (data: Partial<UserSettings>) =>
    api<UserSettings>("/api/v1/profile/settings", { method: "PUT", body: JSON.stringify(data) }),
};

export const adminApi = {
  listUsers: () => api<AdminUser[]>("/api/v1/admin/users"),
  createUser: (data: {
    username: string;
    email: string;
    displayName: string;
    password: string;
    role?: string;
  }) => api<AdminUser>("/api/v1/admin/users", { method: "POST", body: JSON.stringify(data) }),
  updateUser: (id: number, data: { active?: number; email?: string; password?: string }) =>
    api<AdminUser>(`/api/v1/admin/users/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  deactivateUser: (id: number) => api<AdminUser>(`/api/v1/admin/users/${id}`, { method: "DELETE" }),
};
