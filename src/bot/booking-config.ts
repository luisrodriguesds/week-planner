import { z } from "zod";

const bookingEnvSchema = z.object({
  BOOK_MAX_ATTEMPTS: z.coerce.number().int().min(1).max(10).default(3),
  BOOK_RETRY_DELAY_MS: z.coerce.number().int().min(0).max(5_000).default(150),
  BOOK_RETRY_HTTP_STATUSES: z.string().default("500,502,503,504"),
});

export interface BookingConfig {
  maxAttempts: number;
  retryDelayMs: number;
  retryHttpStatuses: ReadonlySet<number>;
}

function parseHttpStatuses(raw: string): Set<number> {
  return new Set(
    raw
      .split(",")
      .map((part) => Number(part.trim()))
      .filter((status) => Number.isInteger(status) && status >= 100 && status <= 599),
  );
}

export function loadBookingConfig(env: NodeJS.ProcessEnv = process.env): BookingConfig {
  const parsed = bookingEnvSchema.parse(env);
  return {
    maxAttempts: parsed.BOOK_MAX_ATTEMPTS,
    retryDelayMs: parsed.BOOK_RETRY_DELAY_MS,
    retryHttpStatuses: parseHttpStatuses(parsed.BOOK_RETRY_HTTP_STATUSES),
  };
}
