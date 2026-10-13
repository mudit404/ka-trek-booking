import "dotenv/config";
import { z } from "zod";

const bool = z
  .string()
  .transform((v) => ["1", "true", "yes"].includes(v.toLowerCase()));

const schema = z.object({
  PORTAL_BASE_URL: z.string().url().default("https://aranyavihaara.karnataka.gov.in"),
  PORTAL_AVAILABILITY_PATH: z.string().default("/TODO/availability"),
  PORTAL_BOOKING_PATH: z.string().default("/TODO/booking"),

  RELEASE_DAYS_AHEAD: z.coerce.number().int().positive().default(15),
  RELEASE_TIME_IST: z
    .string()
    .regex(/^\d{2}:\d{2}:\d{2}$/, "expected HH:MM:SS")
    .default("00:00:00"),
  RELEASE_LEAD_SECONDS: z.coerce.number().nonnegative().default(5),

  WATCH_IDLE_INTERVAL_MS: z.coerce.number().int().positive().default(30_000),
  WATCH_TIGHT_INTERVAL_MS: z.coerce.number().int().positive().default(250),

  TELEGRAM_BOT_TOKEN: z.string().optional(),
  TELEGRAM_CHAT_ID: z.string().optional(),

  DATABASE_URL: z.string().default("postgres://ktb:ktb@localhost:5432/ktb"),
  REDIS_URL: z.string().default("redis://localhost:6379"),

  DRY_RUN: bool.default("true"),
  LOG_LEVEL: z.enum(["trace", "debug", "info", "warn", "error"]).default("info"),
});

export type Config = z.infer<typeof schema>;

let cached: Config | undefined;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  if (cached) return cached;
  const parsed = schema.safeParse(env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(`Invalid configuration:\n${issues}`);
  }
  cached = parsed.data;
  return cached;
}
