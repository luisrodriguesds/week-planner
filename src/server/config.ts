import { z } from "zod";
import { loadDotEnv } from "./load-dotenv.js";

const logLevelSchema = z.enum(["fatal", "error", "warn", "info", "debug", "trace"]);

const envSchema = z.object({
  HOST: z.string().default("0.0.0.0"),
  PORT: z.coerce.number().int().positive().default(3847),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  SESSION_SECRET: z.string().min(32).optional(),
  DATABASE_PATH: z.string().default("data/planner.db"),
  GOGYM_BASE_URL: z.string().url().default("https://gogym.gomygym.com"),
  GOGYM_CENTER_ID: z.coerce.number().int().positive().default(1),
  GOGYM_TIMEZONE: z.string().default("Europe/Lisbon"),
  GOGYM_CLIENT_ID: z.string().optional(),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().positive().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM: z.string().optional(),
  APP_BASE_URL: z.string().url().optional(),
  LOG_LEVEL: logLevelSchema.default("info"),
});

export type AppConfig = {
  host: string;
  port: number;
  nodeEnv: "development" | "production" | "test";
  sessionSecret?: string;
  databasePath: string;
  gogymBaseUrl: string;
  gogymCenterId: number;
  gogymTimezone: string;
  gogymClientId?: string;
  smtp?: {
    host: string;
    port: number;
    user: string;
    pass: string;
    from: string;
  };
  appBaseUrl?: string;
  logLevel: z.infer<typeof logLevelSchema>;
};

function formatConfigError(error: z.ZodError): string {
  return error.issues
    .map((issue) => `${issue.path.join(".") || "env"}: ${issue.message}`)
    .join("\n");
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  loadDotEnv();

  const parsed = envSchema.safeParse(env);
  if (!parsed.success) {
    throw new Error(`Invalid environment configuration:\n${formatConfigError(parsed.error)}`);
  }

  const value = parsed.data;
  const smtpConfigured = value.SMTP_HOST && value.SMTP_PORT && value.SMTP_USER && value.SMTP_PASS && value.SMTP_FROM;

  return {
    host: value.HOST,
    port: value.PORT,
    nodeEnv: value.NODE_ENV,
    sessionSecret: value.SESSION_SECRET,
    databasePath: value.DATABASE_PATH,
    gogymBaseUrl: value.GOGYM_BASE_URL,
    gogymCenterId: value.GOGYM_CENTER_ID,
    gogymTimezone: value.GOGYM_TIMEZONE,
    gogymClientId: value.GOGYM_CLIENT_ID,
    smtp: smtpConfigured
      ? {
          host: value.SMTP_HOST!,
          port: value.SMTP_PORT!,
          user: value.SMTP_USER!,
          pass: value.SMTP_PASS!,
          from: value.SMTP_FROM!,
        }
      : undefined,
    appBaseUrl: value.APP_BASE_URL,
    logLevel: value.LOG_LEVEL,
  };
}
