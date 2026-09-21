import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  username: text("username").notNull().unique(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: text("role").notNull(),
  displayName: text("display_name").notNull(),
  active: integer("active").notNull().default(1),
  gogymNumcliente: text("gogym_numcliente"),
  gogymIdcliente: text("gogym_idcliente"),
  gogymDisplayName: text("gogym_display_name"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, (table) => [
  index("users_role_idx").on(table.role),
]);

export const userSettings = sqliteTable("user_settings", {
  userId: integer("user_id").primaryKey().references(() => users.id),
  digestEnabled: integer("digest_enabled").notNull().default(1),
  digestDay: integer("digest_day").notNull().default(0),
  digestHour: integer("digest_hour").notNull().default(20),
  digestMinute: integer("digest_minute").notNull().default(0),
  defaultClassFilter: text("default_class_filter"),
  centerId: integer("center_id").notNull().default(1),
});

export const plans = sqliteTable("plans", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").notNull().references(() => users.id),
  status: text("status").notNull(),
  idgrelha: integer("idgrelha").notNull(),
  idaula: integer("idaula").notNull(),
  nomeAula: text("nome_aula").notNull(),
  nomeProfessor: text("nome_professor"),
  nomeLocal: text("nome_local"),
  dataHoraAula: text("data_hora_aula").notNull(),
  inicioMarcacao: text("inicio_marcacao").notNull(),
  fimMarcacao: text("fim_marcacao").notNull(),
  centroLocal: integer("centro_local").notNull(),
  lotacaoReservaWeb: integer("lotacao_reserva_web").notNull(),
  fusoHorario: text("fuso_horario").notNull(),
  valorA: text("valor_a").notNull(),
  valorB: text("valor_b").notNull(),
  valorC: text("valor_c").notNull(),
  valorBNumAlunos: integer("valor_b_num_alunos").notNull(),
  valorCNumAlunos: integer("valor_c_num_alunos").notNull(),
  idMarcacao: integer("id_marcacao"),
  failureReason: text("failure_reason"),
  scheduledExecuteAt: text("scheduled_execute_at").notNull(),
  executedAt: text("executed_at"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, (table) => [
  index("plans_user_status_idx").on(table.userId, table.status),
  index("plans_status_execute_idx").on(table.status, table.scheduledExecuteAt),
  uniqueIndex("plans_user_slot_unique").on(table.userId, table.idgrelha, table.dataHoraAula),
]);

export const planExecutionLogs = sqliteTable("plan_execution_logs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  planId: integer("plan_id").notNull().references(() => plans.id),
  attemptAt: text("attempt_at").notNull(),
  success: integer("success").notNull(),
  httpStatus: integer("http_status"),
  responseBody: text("response_body"),
  errorMessage: text("error_message"),
});

export const appMeta = sqliteTable("app_meta", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});
