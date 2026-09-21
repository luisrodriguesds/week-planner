import { z } from "zod";

export const gogymEnvSchema = z.object({
  GOGYM_BASE_URL: z.string().url().default("https://gogym.gomygym.com"),
  GOGYM_CENTER_ID: z.coerce.number().default(1),
});

export type GoGymConfig = z.infer<typeof gogymEnvSchema>;
